import type { FastifyInstance } from 'fastify'
import type { EvmTokenTransfer, EvmTransactionDetails } from '@dexplorer/shared'
import { env } from '../config/env'
import {
  decodeTokenTransferLogs,
  getErc20Metadata,
  getEthCode,
  getEthTransaction,
  getEthTransactionReceipt,
  resolveMethodLabel,
} from '../chain/evmRpc'

const EVM_TX_CACHE_TTL_MS = 10 * 60_000
const evmTxCache = new Map<
  string,
  { fetchedAt: number; data: EvmTransactionDetails }
>()

export function registerEvmRoutes(app: FastifyInstance): void {
  app.get<{ Params: { hash: string } }>(
    '/evm/tx/:hash',
    async (request, reply) => {
      if (!env.EVM_RPC_URL) {
        return reply.status(404).send({ error: 'EVM RPC not configured' })
      }

      const hash = request.params.hash.toLowerCase()
      if (!/^0x[0-9a-f]{64}$/.test(hash)) {
        return reply.status(400).send({ error: 'Invalid EVM transaction hash' })
      }

      const cached = evmTxCache.get(hash)
      if (cached && Date.now() - cached.fetchedAt < EVM_TX_CACHE_TTL_MS) {
        return cached.data
      }

      try {
        const rpcUrl = env.EVM_RPC_URL
        const [tx, receipt] = await Promise.all([
          getEthTransaction(rpcUrl, hash),
          getEthTransactionReceipt(rpcUrl, hash),
        ])

        if (!tx || !receipt) {
          return reply.status(404).send({ error: 'EVM transaction not found' })
        }

        const decodedTransfers = decodeTokenTransferLogs(receipt.logs)
        const uniqueTokens = [
          ...new Set(decodedTransfers.map((t) => t.tokenAddress)),
        ]
        const tokenMetadata = new Map(
          await Promise.all(
            uniqueTokens.map(
              async (address) =>
                [address, await getErc20Metadata(rpcUrl, address)] as const
            )
          )
        )

        const tokenTransfers: EvmTokenTransfer[] = decodedTransfers.map((t) => {
          const meta = tokenMetadata.get(t.tokenAddress)
          return {
            type: t.type,
            from: t.from,
            to: t.to,
            tokenAddress: t.tokenAddress,
            tokenName: meta?.name ?? null,
            tokenSymbol: meta?.symbol ?? null,
            tokenDecimals: meta?.decimals ?? null,
            amount: t.amount,
          }
        })

        const toIsContract = tx.to
          ? (await getEthCode(rpcUrl, tx.to)) !== '0x'
          : false

        const data: EvmTransactionDetails = {
          hash: tx.hash,
          status: receipt.status === '0x1' ? 'ok' : 'error',
          method: resolveMethodLabel(tx.input),
          from: tx.from,
          to: tx.to,
          toIsContract,
          value: BigInt(tx.value || '0x0').toString(),
          gasUsed: BigInt(receipt.gasUsed || '0x0').toString(),
          tokenTransfers,
          explorerUrl: env.EVM_EXPLORER_API_URL
            ? `${env.EVM_EXPLORER_API_URL}/tx/${tx.hash}`
            : null,
        }

        evmTxCache.set(hash, { fetchedAt: Date.now(), data })
        return data
      } catch (err) {
        request.log.error(err)
        return reply
          .status(502)
          .send({ error: 'Failed to fetch EVM transaction' })
      }
    }
  )
}
