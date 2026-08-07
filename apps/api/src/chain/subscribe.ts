import { NewBlockEvent, Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { TxEvent } from '@cosmjs/tendermint-rpc/build/tendermint37'
import { Subscription } from 'xstream'

type ErrorHandler = (err: Error) => void

export function subscribeNewBlock(
  tmClient: Tendermint37Client,
  callback: (event: NewBlockEvent) => void,
  onError?: ErrorHandler
): Subscription {
  const stream = tmClient.subscribeNewBlock()
  const subscription = stream.subscribe({
    next: (event) => {
      callback(event)
    },
    error: (err) => {
      console.error('Block subscription error:', err)
      if (onError) {
        onError(err as Error)
      }
      subscription.unsubscribe()
    },
  })

  return subscription
}

export function subscribeTx(
  tmClient: Tendermint37Client,
  callback: (event: TxEvent) => void,
  onError?: ErrorHandler
): Subscription {
  const stream = tmClient.subscribeTx()
  const subscription = stream.subscribe({
    next: (event) => {
      callback(event)
    },
    error: (err) => {
      console.error('Transaction subscription error:', err)
      if (onError) {
        onError(err as Error)
      }
      subscription.unsubscribe()
    },
  })

  return subscription
}
