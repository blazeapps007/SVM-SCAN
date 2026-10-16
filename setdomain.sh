#!/usr/bin/env bash
# Points a domain at the SVM Scan container and gets it a Let's Encrypt
# certificate:
#   1. installs nginx and certbot if they're missing
#   2. writes a plain port-80 nginx site proxying to the app's host port
#      (docker-compose.yml's HOST_PORT, default 85)
#   3. runs `certbot --nginx`, which issues the certificate and adds the HTTPS
#      listener plus the HTTP->HTTPS redirect to that site
# Certbot's systemd timer renews the certificate automatically afterwards.
# Safe to re-run, e.g. to add www or after moving servers.
#
# Usage: sudo bash setdomain.sh [domain] [email]

# `sh setdomain.sh` runs dash on Debian/Ubuntu, which ignores the shebang and
# lacks the bash features used below — re-run under bash instead. POSIX-only
# syntax up to here.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

info() { echo "==> $*"; }
warn() { echo "WARNING: $*" >&2; }
die() {
  echo "ERROR: $*" >&2
  exit 1
}
confirm() {
  local reply
  read -rp "$1 [y/N] " reply
  [[ "${reply,,}" == y* ]]
}

[[ $EUID -eq 0 ]] || die "run as root: sudo $0 $*"

# --- Inputs -----------------------------------------------------------------

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  read -rp "Domain name (e.g. explorer.example.com): " DOMAIN
fi
# Accept a pasted URL too: lowercase, strip scheme and any path.
DOMAIN="${DOMAIN,,}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%%/*}"
[[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]] ||
  die "not a valid domain name: '$DOMAIN'"

NAMES=("$DOMAIN")
if [[ "$DOMAIN" != www.* ]] && confirm "Also serve www.$DOMAIN?"; then
  NAMES+=("www.$DOMAIN")
fi

EMAIL="${2:-}"
if [[ -z "$EMAIL" ]]; then
  read -rp "Email for Let's Encrypt expiry notices (blank to skip): " EMAIL
fi

# sudo drops the caller's environment, so read HOST_PORT from the repo-root
# .env that docker compose uses, falling back to compose's own default.
APP_PORT=""
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  APP_PORT="$(grep -E '^[[:space:]]*HOST_PORT[[:space:]]*=' "$SCRIPT_DIR/.env" |
    tail -n1 | cut -d= -f2- | tr -d "\"' \r" || true)"
fi
APP_PORT="${APP_PORT:-85}"
[[ "$APP_PORT" =~ ^[0-9]+$ ]] || die "HOST_PORT in $SCRIPT_DIR/.env is not a number: '$APP_PORT'"

# --- Packages ---------------------------------------------------------------

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y epel-release || true # certbot lives in EPEL on RHEL-likes
    dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y epel-release || true
    yum install -y "$@"
  else
    die "no supported package manager (apt/dnf/yum) — install $* manually"
  fi
}

if ! command -v curl >/dev/null 2>&1; then
  install_packages curl
fi

if ! command -v nginx >/dev/null 2>&1; then
  info "Installing nginx"
  install_packages nginx
  systemctl enable --now nginx
fi

if ! command -v certbot >/dev/null 2>&1; then
  info "Installing certbot"
  install_packages certbot python3-certbot-nginx
elif ! certbot plugins 2>/dev/null | grep -qw nginx; then
  info "Installing certbot's nginx plugin"
  install_packages python3-certbot-nginx
fi

# --- Pre-flight checks ------------------------------------------------------

if ! curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:${APP_PORT}/api/health"; then
  warn "the app isn't answering on 127.0.0.1:${APP_PORT} — start it with 'docker compose up -d'." \
    "The certificate can still be issued; the site will show 502 until the app is up."
fi

# Let's Encrypt validates over plain HTTP, so every name must already resolve
# to this server.
PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org || true)"
DNS_OK=1
for name in "${NAMES[@]}"; do
  resolved="$(getent ahostsv4 "$name" | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
  if [[ -z "$resolved" ]]; then
    warn "$name doesn't resolve yet — add a DNS A record pointing at ${PUBLIC_IP:-this server}."
    DNS_OK=0
  elif [[ -n "$PUBLIC_IP" && " $resolved " != *" $PUBLIC_IP "* ]]; then
    warn "$name resolves to ${resolved% }, not this server ($PUBLIC_IP)."
    DNS_OK=0
  fi
done
if [[ $DNS_OK -eq 0 ]]; then
  cat >&2 <<'EOF'
If the domain is proxied through Cloudflare (orange cloud), set it to
"DNS only" while issuing, and afterwards use SSL mode "Full (strict)" —
"Flexible" plus this server's HTTPS redirect causes an endless redirect loop.
EOF
  confirm "Continue anyway?" || exit 1
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  info "Opening ports 80 and 443 in ufw"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

# --- nginx site -------------------------------------------------------------

if [[ -d /etc/nginx/sites-available ]]; then
  CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
  LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"
else
  CONF="/etc/nginx/conf.d/${DOMAIN}.conf"
  LINK=""
fi

# Another enabled site already claiming one of these names would win over
# (or clash with) the new one — e.g. an older hand-written config. nginx
# loads everything in sites-enabled but only *.conf in conf.d.
pattern="server_name[^;]*[[:space:]]($(printf '%s|' "${NAMES[@]}" | sed 's/\./\\./g; s/|$//'))([[:space:];]|$)"
own_conf="$(readlink -f "$CONF" 2>/dev/null || echo "$CONF")"
conflicts=()
while IFS= read -r file; do
  if [[ "$(readlink -f "$file")" != "$own_conf" ]]; then
    conflicts+=("$file")
  fi
done < <(
  {
    # -R, not -r: sites-enabled is normally all symlinks, which -r skips.
    [[ ! -d /etc/nginx/sites-enabled ]] || grep -RlE "$pattern" /etc/nginx/sites-enabled
    [[ ! -d /etc/nginx/conf.d ]] || grep -RlE --include='*.conf' "$pattern" /etc/nginx/conf.d
  } 2>/dev/null || true
)
backup_dir=""
if [[ ${#conflicts[@]} -gt 0 ]]; then
  warn "these enabled nginx configs already serve ${NAMES[*]}:"
  printf '  %s\n' "${conflicts[@]}" >&2
  confirm "Disable them (moved to /etc/nginx/setdomain-disabled/, nothing deleted)?" ||
    die "remove or edit those configs first, then re-run"
  backup_dir="/etc/nginx/setdomain-disabled/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$backup_dir"
  for file in "${conflicts[@]}"; do
    if [[ -L "$file" ]]; then
      rm "$file" # just the sites-enabled symlink; its target stays put
    else
      mv "$file" "$backup_dir/"
    fi
  done
  info "Disabled ${#conflicts[@]} config(s); file copies are in $backup_dir"
fi

CF_INCLUDE=""
if [[ -f /etc/nginx/cloudflare/cloudflare-ips.conf ]]; then
  CF_INCLUDE="    include /etc/nginx/cloudflare/cloudflare-ips.conf;"
fi

BACKUP=""
if [[ -f "$CONF" ]]; then
  BACKUP="${CONF}.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$CONF" "$BACKUP"
fi

info "Writing $CONF"
cat >"$CONF" <<EOF
# Generated by setdomain.sh — plain HTTP proxy to the SVM Scan container.
# certbot adds the HTTPS listener, certificate paths and the HTTP->HTTPS
# redirect to this file; re-run setdomain.sh instead of editing it by hand.
server {
    listen 80;
    listen [::]:80;
    server_name ${NAMES[*]};

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy no-referrer-when-downgrade;
${CF_INCLUDE}
    access_log /var/log/nginx/${DOMAIN}-access.log;
    error_log /var/log/nginx/${DOMAIN}-error.log warn;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

if [[ -n "$LINK" ]]; then
  ln -sfn "$CONF" "$LINK"
fi

if ! nginx -t; then
  # Put things back the way they were rather than leave nginx unloadable.
  if [[ -n "$BACKUP" ]]; then
    mv "$BACKUP" "$CONF"
  else
    rm -f "$CONF"
    [[ -z "$LINK" ]] || rm -f "$LINK"
  fi
  [[ -z "$backup_dir" ]] || warn "configs disabled earlier in this run are in $backup_dir"
  die "nginx rejected the generated config (see above); this domain's previous config was restored"
fi
systemctl reload-or-restart nginx

# --- Certificate ------------------------------------------------------------

CERTBOT_ARGS=(
  --nginx --non-interactive --agree-tos
  --redirect --hsts
  --keep-until-expiring # re-running reuses a still-valid certificate
  --expand              # ...but adding a name (e.g. www later) re-issues it
  --cert-name "$DOMAIN"
)
for name in "${NAMES[@]}"; do
  CERTBOT_ARGS+=(-d "$name")
done
if [[ -n "$EMAIL" ]]; then
  CERTBOT_ARGS+=(-m "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

info "Requesting a Let's Encrypt certificate for ${NAMES[*]}"
certbot "${CERTBOT_ARGS[@]}" ||
  die "certbot failed (see its message above) — the site is still served over plain HTTP. Usual causes: DNS not pointing here yet, or port 80 not reachable from the internet. Fix it and re-run."

if ! systemctl list-timers 2>/dev/null | grep -q certbot; then
  warn "no certbot renewal timer found — add a cron job running 'certbot renew -q' twice a day."
fi

echo
info "Done: https://${DOMAIN}"
cat <<EOF
Renewal is automatic. To test it: sudo certbot renew --dry-run
Set CORS_ORIGIN="https://${DOMAIN}" in apps/api/.env, then
'docker compose up -d --force-recreate app'.
EOF
