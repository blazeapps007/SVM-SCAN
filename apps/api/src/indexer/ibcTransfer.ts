import type { TxEventDoc } from '@dexplorer/shared'

export interface IBCTransferFields {
  sender: string
  receiver: string
  sourceChannel: string
  sourcePort: string
  destinationChannel: string
  destinationPort: string
  amount: string
  denom: string
  memo: string
}

// Ported from apps/web's former useIBCTransfers.ts client-side scan, now run
// once per transaction at index time. Channel/port routing data lives on the
// packet lifecycle events (send_packet on the source chain, acknowledge_packet
// once the ack lands back, recv_packet/timeout_packet on other legs), all
// keyed with a "packet_" prefix. Sender/receiver/denom/amount/memo live as
// separate attributes on fungible_token_packet (relayed transfers) or
// ibc_transfer (locally-initiated transfers) — confirmed against live chain
// data, these are NOT concatenated Coin strings there.
export function extractIBCTransfer(
  events: TxEventDoc[]
): IBCTransferFields | null {
  let sender = ''
  let receiver = ''
  let sourceChannel = ''
  let sourcePort = ''
  let destinationChannel = ''
  let destinationPort = ''
  let amount = ''
  let denom = ''
  let memo = ''

  for (const event of events) {
    if (
      event.type === 'send_packet' ||
      event.type === 'recv_packet' ||
      event.type === 'acknowledge_packet' ||
      event.type === 'timeout_packet' ||
      event.type === 'write_acknowledgement'
    ) {
      for (const attr of event.attributes) {
        if (attr.key === 'packet_src_channel') sourceChannel = attr.value
        if (attr.key === 'packet_src_port') sourcePort = attr.value
        if (attr.key === 'packet_dst_channel') destinationChannel = attr.value
        if (attr.key === 'packet_dst_port') destinationPort = attr.value
      }
    }

    if (
      event.type === 'fungible_token_packet' ||
      event.type === 'ibc_transfer'
    ) {
      for (const attr of event.attributes) {
        if (attr.key === 'sender') sender = attr.value
        if (attr.key === 'receiver') receiver = attr.value
        if (attr.key === 'denom') denom = attr.value
        if (attr.key === 'amount') amount = attr.value
        if (attr.key === 'memo') memo = attr.value
      }
    }
  }

  // Fallback: if we picked up an amount but never found a separate denom
  // attribute, the amount may be a combined Coin string like "73325uosmo".
  if (amount && !denom) {
    const match = amount.match(/^(\d+)(.+)$/)
    if (match) {
      amount = match[1]
      denom = match[2]
    }
  }

  // When a voucher is sent back to its origin chain (or forwarded onward),
  // ICS-20 puts the full denom trace path in the packet, e.g.
  // "transfer/channel-0/usteem" instead of bare "usteem" — the receiving
  // chain's bank module unwinds this internally when crediting the
  // balance, but the raw packet attribute we read it from doesn't. Take
  // the trailing segment so amount/decimals display correctly.
  if (denom.includes('/')) {
    denom = denom.slice(denom.lastIndexOf('/') + 1)
  }

  if (!sourceChannel && !sourcePort && !sender && !receiver) {
    return null
  }

  return {
    sender,
    receiver,
    sourceChannel,
    sourcePort,
    destinationChannel,
    destinationPort,
    amount,
    denom,
    memo,
  }
}
