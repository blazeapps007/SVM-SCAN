// pm2 config for local dev — runs the same two dev servers `pnpm dev:api` /
// `pnpm dev:web` would, just process-supervised instead of two terminals.
// .cjs (not .js) because the root package.json has "type": "module" and
// pm2's ecosystem loader expects CommonJS.
module.exports = {
  apps: [
    {
      name: 'svm-scan-api',
      script: 'pnpm',
      args: 'dev:api',
      interpreter: 'none',
      cwd: __dirname,
      // apps/api's own dev script (tsx watch) already restarts on file
      // changes — pm2's watch would double-restart on top of that.
      watch: false,
    },
    {
      name: 'svm-scan-web',
      script: 'pnpm',
      args: 'dev:web',
      interpreter: 'none',
      cwd: __dirname,
      watch: false,
    },
  ],
}
