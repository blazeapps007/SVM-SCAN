import { toBech32, fromBech32 } from '@cosmjs/encoding'
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

// Derive a validator's bech32 "valcons" consensus address from its
// consensusPubkey (Cosmos SDK: sha256(rawEd25519Key)[0:20], bech32-encoded
// with the chain's valcons prefix).
export const pubkeyToValconsAddress = (
  consensusPubkey: { typeUrl: string; value: Uint8Array } | undefined,
  operatorAddress: string
): string | null => {
  if (
    !consensusPubkey ||
    consensusPubkey.typeUrl !== '/cosmos.crypto.ed25519.PubKey'
  ) {
    return null
  }
  const { key } = Ed25519PubKey.decode(consensusPubkey.value)
  const addressBytes = sha256(key).slice(0, 20)
  const { prefix } = fromBech32(operatorAddress)
  const valconsPrefix = prefix.replace(/valoper$/, 'valcons')
  return toBech32(valconsPrefix, addressBytes)
}
