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
  // bech32 address -> Cosmos SDK module account name (e.g. "fee_collector",
  // "bridge_reward", "steemblackhole"), for labeling module accounts that
  // show up as a sender/receiver in `events` — empty when STEEMBRIDGE_LCD_URL
  // isn't configured (there's no other way to resolve these, since module
  // account addresses are derived from the module name, not human-chosen).
  moduleAccounts: Record<string, string>
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
  // Live (not indexed — accrues every block) un-withdrawn rewards. Amounts
  // are already Dec-decoded (see decodeLegacyDecString) but still in the
  // bond token's atto units, same convention as delegatorShares — the
  // frontend's normal atto->STEEM conversion still applies. null if the
  // live distribution-module query failed (best-effort, not load-bearing).
  pendingRewards: Coin[] | null
  // The validator's own cut of pendingRewards (what it would receive on
  // withdrawal) — a subset of pendingRewards, not additional to it.
  accumulatedCommission: Coin[] | null
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
  // Gov v1's expedited-proposal path (shorter voting period, higher pass
  // threshold) — false for a normal proposal.
  expedited: boolean
  // Set only if status is PROPOSAL_STATUS_FAILED (a passed proposal whose
  // messages then failed to execute on-chain) — empty string otherwise,
  // including for PROPOSAL_STATUS_REJECTED (a plain "voted No" outcome,
  // which has no failure reason to report).
  failedReason: string
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
  // Wei-per-gas actually charged (the receipt's effectiveGasPrice) — the
  // outer Cosmos tx's `fee` is always empty for a MsgEthereumTx on this
  // chain, so this (and `fee` below) is the only place the real cost shows.
  gasPrice: string
  // gasUsed * gasPrice, in the native 18-decimal asteem base unit — the
  // actual amount deducted from `from` for this transaction.
  fee: string
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
  // "BRIDGE_ASSET_STEEM" or "BRIDGE_ASSET_SBD" — both confirmed live. Never
  // assume STEEM; always read this field for the display unit.
  asset: string
}

export interface BridgeAssetTotal {
  asset: string
  amountMillisteem: string
}

export interface BridgeAssetCount {
  asset: string
  count: number
}

export interface BridgeDepositStats {
  pending: number
  minted: number
  unclaimable: number
  total: number
  // Count of deposits (any status), grouped by asset.
  countByAsset: BridgeAssetCount[]
  // Sum of amountMillisteem across MINTED deposits, grouped by asset —
  // computed from our own indexed `bridgeDeposits` (the chain's
  // `bridge_statistics` only tracks STEEM, not SBD, so it can't answer this).
  // Doesn't include SVMNS name-registration mints (`MsgSubmitNameRegistration`
  // also mints asteem 1:1 via steemblackhole, same mechanism as a deposit,
  // but isn't indexed as one — see BridgeDeposit's docs).
  mintedByAsset: BridgeAssetTotal[]
}

export interface BridgeWithdrawal {
  id: string
  sender: string
  destinationSteemAccount: string
  amountAsteem: string
  amountMillisteem: string
  memo: string
  burnTxHash: string
  status:
    | 'WITHDRAWAL_STATUS_REQUESTED'
    | 'WITHDRAWAL_STATUS_PROCESSED'
    | 'WITHDRAWAL_STATUS_REFUNDED'
  createdAtHeight: string
  asset: string
  // The protocol fee withheld from `amountMillisteem`/`amountAsteem` — sent
  // to the `bridge_reward` module account on-chain (see the burn tx's
  // events), not part of the payout the destination Steem account receives.
  feeMillisteem: string
  // The Steem-side payout transaction id, set once status flips to
  // PROCESSED. Empty until then.
  steemPayoutTxid: string
  payoutOpIndex: number
  // SVM block height the withdrawal was marked PROCESSED at; "0" until then.
  processedAtHeight: string
  // SVM block height an unconfirmed withdrawal was auto-refunded at (past
  // `withdrawalTimeoutBlocks` in the bridge params, no attestation needed);
  // "0" unless that happened.
  refundedAtHeight: string
  validatorConfirmations: BridgeValidatorConfirmation[]
}

export interface BridgeWithdrawalStats {
  total: number
  requested: number
  processed: number
  // Sum of amountMillisteem across every indexed withdrawal, grouped by
  // asset — computed from our own indexed `bridgeWithdrawals`, same
  // reasoning as BridgeDepositStats.mintedByAsset (the chain's
  // `bridge_statistics` only tracks STEEM). Not status-filtered — includes
  // REQUESTED/PROCESSED/REFUNDED alike, since the burn itself already
  // happened by the time a withdrawal is indexed at all.
  withdrawnByAsset: BridgeAssetTotal[]
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

export interface BridgeParams {
  bridgeEnabled: boolean
  bridgeOutEnabled: boolean
  gatewayAccount: string
  bridgeConfirmationThreshold: string
  minimumBridgeAmount: string
  maximumBridgeAmount: string
  depositTimeoutBlocks: string
  nameServiceEnabled: boolean
  nameRegistrationMinMillisteem: string
  namePendingTimeoutBlocks: string
  relayerStartBlock: string
  bridgeFeeBps: number
  withdrawalTimeoutBlocks: string
}

export interface OracleParams {
  votePeriod: string
  voteThreshold: string
  rewardBand: string
  missBand: string
  whitelist: string[]
}

export interface ExchangeRate {
  pair: string
  rate: string
  updateEpoch: string
  updateTime: string
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
  bridge: BridgeParams | null
  oracle: OracleParams | null
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
