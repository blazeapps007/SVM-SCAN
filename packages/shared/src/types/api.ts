import type { DecodeMsg } from '../encoding/msg'

export interface Paginated<T> {
  data: T[]
  pagination: {
    page: number
    perPage: number
    total: number
  }
}

export interface Coin {
  denom: string
  amount: string
}

export interface EventAttribute {
  key: string
  value: string
  index?: boolean
}

export interface TxEventDoc {
  type: string
  attributes: EventAttribute[]
}

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

export interface BlockSummary {
  height: number
  hash: string
  time: string
  proposerAddress: string
  appHash: string
  txCount: number
}

export interface BlockDetailResponse extends BlockSummary {
  txHashes: string[]
}

export interface TransactionSummary {
  hash: string
  height: number
  timestamp: string
  code: number
  success: boolean
  messageTypes: string[]
  fee: Coin[]
  gasUsed: string
  gasWanted: string
}

export interface TransactionDetailResponse extends TransactionSummary {
  log: string
  memo: string
  chainId: string
  messages: DecodeMsg[]
  events: TxEventDoc[]
  senders: string[]
  ibcTransfer: IBCTransferFields | null
}

export interface ValidatorSummary {
  operatorAddress: string
  moniker: string
  identity: string
  status: string
  jailed: boolean
  tokens: string
  bondDenom: string
  commissionRate: string
  votingPowerPercent: number
}

export interface ValidatorUptime {
  missedBlocksCounter: string
  signedBlocksWindow: string
}

export interface ValidatorDetailResponse extends ValidatorSummary {
  website: string
  details: string
  delegatorShares: string
  minSelfDelegation: string
  unbondingHeight: string
  consensusPubkey: string | null
  uptime: ValidatorUptime | null
}

export interface ValidatorStats {
  activeCount: number
  totalCount: number
  avgCommission: number
}

export interface ProposalSummary {
  id: number
  title: string
  status: string
  votingStartTime: string | null
  votingEndTime: string | null
  submitTime: string | null
}

export interface ProposalDetailResponse extends ProposalSummary {
  summary: string
  proposer: string
  depositEndTime: string | null
  votingStartTime: string | null
  totalDeposit: Coin[]
  finalTallyResult: {
    yesCount: string
    noCount: string
    abstainCount: string
    noWithVetoCount: string
  } | null
  messages: DecodeMsg[]
}

export interface ProposalStats {
  total: number
  activeVoting: number
  passed: number
}

export interface AccountValidatorLink {
  operatorAddress: string
  moniker: string
  identity: string
}

// The real symbol/decimals for a denom, resolved with chain access — for
// "ibc/<hash>" denoms this requires an IBC trace query (the hash alone
// reveals nothing), so it can't be derived client-side the way native
// u-/a-prefixed denoms can.
export interface ResolvedDenom {
  baseDenom: string
  symbol: string
  decimals: number
  path: string | null
}

export interface AccountDetailResponse {
  address: string
  accountNumber: string
  sequence: string
  balances: Coin[]
  stakedBalance: Coin | null
  validator: AccountValidatorLink | null
  resolvedDenoms: Record<string, ResolvedDenom>
}

export interface RecentAccount {
  address: string
  lastMessageType: string
  lastActivityTime: string
}

export interface IBCTransferSummary extends IBCTransferFields {
  hash: string
  height: number
  timestamp: string
  status: 'success' | 'failed'
}

export interface EvmTokenTransfer {
  type: 'token_transfer' | 'token_minting'
  from: string
  to: string
  tokenAddress: string
  tokenName: string | null
  tokenSymbol: string | null
  tokenDecimals: string | null
  amount: string | null
}

export interface EvmTransactionDetails {
  hash: string
  status: 'ok' | 'error'
  method: string | null
  from: string
  to: string | null
  toIsContract: boolean
  value: string
  gasUsed: string
  tokenTransfers: EvmTokenTransfer[]
  explorerUrl: string | null
}

export interface AddressTokenHolding {
  tokenAddress: string
  tokenType: string
  name: string | null
  symbol: string | null
  decimals: string | null
  value: string
}

export interface LiquidityPoolTokenInfo {
  address: string
  name: string | null
  symbol: string | null
  decimals: string | null
}

export interface LiquidityPoolSummary {
  poolAddress: string
  factoryAddress: string
  token0: LiquidityPoolTokenInfo
  token1: LiquidityPoolTokenInfo
  fee: string
  tickSpacing: string
  createdAtHeight: number
  createdAtTxHash: string
  createdAt: string
}

export interface BridgeValidatorConfirmation {
  validatorAddress: string
  moniker: string | null
  timestamp: string
}

export interface BridgeDeposit {
  id: string
  txid: string
  opIndex: number
  steemBlock: string
  steemTimestamp: string
  steemSender: string
  gatewayAccount: string
  amountMillisteem: string
  memo: string
  derivedDestination: string
  destinationType:
    | 'DESTINATION_TYPE_NONE'
    | 'DESTINATION_TYPE_COSMOS'
    | 'DESTINATION_TYPE_EVM'
  status:
    | 'DEPOSIT_STATUS_PENDING'
    | 'DEPOSIT_STATUS_MINTED'
    | 'DEPOSIT_STATUS_UNCLAIMABLE'
  minted: boolean
  mintedAt: string
  mintTxHash: string
  createdAtHeight: string
  validatorConfirmations: BridgeValidatorConfirmation[]
}

export interface BridgeDepositStats {
  pending: number
  minted: number
  unclaimable: number
  total: number
}

export interface BridgeWithdrawal {
  id: string
  sender: string
  destinationSteemAccount: string
  amountAsteem: string
  amountMillisteem: string
  memo: string
  burnTxHash: string
  status: 'WITHDRAWAL_STATUS_REQUESTED'
  createdAtHeight: string
}

export interface BridgeWithdrawalStats {
  total: number
  requested: number
  totalMintedAsteem: string
  totalBurnedAsteem: string
  netOutstandingAsteem: string
}

export interface NameRecord {
  steemAccount: string
  address: string
  registrationId: string
  linkedAt: string
}

export interface NameRegistration {
  id: string
  txid: string
  opIndex: number
  steemBlock: string
  // May be the literal "genesis" for a genesis-seeded registration — not a
  // parseable date, callers must handle that specially.
  steemTimestamp: string
  steemAccount: string
  gatewayAccount: string
  amountMillisteem: string
  memo: string
  derivedDestination: string
  destinationType:
    | 'DESTINATION_TYPE_NONE'
    | 'DESTINATION_TYPE_COSMOS'
    | 'DESTINATION_TYPE_EVM'
  status: string
  createdAtHeight: string
  awaitingSinceHeight: string
  confirmedAtHeight: string
  confirmTxHash: string
  validatorConfirmations: BridgeValidatorConfirmation[]
}

export interface ChainParamsResponse {
  staking: Record<string, unknown> | null
  mint: Record<string, unknown> | null
  distribution: Record<string, unknown> | null
  slashing: Record<string, unknown> | null
  gov: {
    votingParams: Record<string, unknown> | null
    depositParams: Record<string, unknown> | null
    tallyParams: Record<string, unknown> | null
  }
}

export interface DenomMetadataResponse {
  denom: string
  displayName: string
  symbol: string
  decimals: number
  source: 'seed' | 'manual' | 'fallback'
}

export interface NetworkStatusResponse {
  chainId: string
  blockHeight: number
  catchingUp: boolean
  peered: number
  blockInterval: number
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  mongo: boolean
  chain: boolean
  indexerMode: 'backfill' | 'live'
  lastIndexedHeight: number
}
