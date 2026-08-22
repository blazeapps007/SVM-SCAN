import { toBech32, fromBech32, toHex } from '@cosmjs/encoding'
import { sha256 } from '@cosmjs/crypto'
import { PubKey as Ed25519PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys'

export const replaceHTTPtoWebsocket = (url: string): string => {
  return url.replace('http', 'ws')
}

export const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

// The raw 20-byte consensus address (Cosmos SDK: sha256(rawEd25519Key)[0:20])
// derived from a validator's consensusPubkey — shared by pubkeyToValconsAddress
// (bech32-encoded) and pubkeyToConsAddressHex (hex-encoded) below, since a
// block header's own proposer_address field is this same hash in *hex*, not
// bech32, so matching a block's proposer to a validator needs the hex form.
function consensusPubkeyToAddressBytes(
  consensusPubkey: { typeUrl: string; value: Uint8Array } | undefined
): Uint8Array | null {
  if (
    !consensusPubkey ||
    consensusPubkey.typeUrl !== '/cosmos.crypto.ed25519.PubKey'
  ) {
    return null
  }
  const { key } = Ed25519PubKey.decode(consensusPubkey.value)
  return sha256(key).slice(0, 20)
}

// Derive a validator's bech32 "valcons" consensus address from its
// consensusPubkey, bech32-encoded with the chain's valcons prefix.
export const pubkeyToValconsAddress = (
  consensusPubkey: { typeUrl: string; value: Uint8Array } | undefined,
  operatorAddress: string
): string | null => {
  const addressBytes = consensusPubkeyToAddressBytes(consensusPubkey)
  if (!addressBytes) return null
  const { prefix } = fromBech32(operatorAddress)
  const valconsPrefix = prefix.replace(/valoper$/, 'valcons')
  return toBech32(valconsPrefix, addressBytes)
}

// Same derivation, hex-encoded instead of bech32 — this is the form a block
// header's proposer_address field (and lastCommit's signature addresses)
// actually use, so resolving "which validator proposed/signed this block"
// needs this, not the bech32 valcons address.
export const pubkeyToConsAddressHex = (
  consensusPubkey: { typeUrl: string; value: Uint8Array } | undefined
): string | null => {
  const addressBytes = consensusPubkeyToAddressBytes(consensusPubkey)
  return addressBytes ? toHex(addressBytes).toUpperCase() : null
}

// This chain's bech32 account addresses are exactly the same 20 bytes as
// the account's EVM address, just bech32-encoded instead of hex — verified
// against a live account (eth_getBalance on the derived address matches the
// cosmos-side balance exactly), not assumed from spec.
export const bech32ToEvmAddress = (address: string): string | null => {
  try {
    const { data } = fromBech32(address)
    if (data.length !== 20) return null
    return `0x${toHex(data)}`
  } catch {
    return null
  }
}

// A validator's operator address is the same underlying bytes as its
// self-delegation account address, just re-prefixed with "valoper" (a
// standard Cosmos SDK convention) — verified against a real validator on
// this chain (blaze.apps), not assumed from spec.
export const accountToValoperAddress = (address: string): string | null => {
  try {
    const { prefix, data } = fromBech32(address)
    return toBech32(`${prefix}valoper`, data)
  } catch {
    return null
  }
}

// The reverse of accountToValoperAddress — a validator's operator address
// re-prefixed back to its plain self-delegation account address. Needed to
// look up a validator's own transactions (e.g. oracle vote/prevote
// submissions), which are indexed keyed by account-form sender addresses,
// not the operator address.
export const valoperToAccountAddress = (address: string): string | null => {
  try {
    const { prefix, data } = fromBech32(address)
    return toBech32(prefix.replace(/valoper$/, ''), data)
  } catch {
    return null
  }
}
