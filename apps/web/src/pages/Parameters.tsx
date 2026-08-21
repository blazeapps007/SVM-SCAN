import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FiDollarSign,
  FiShield,
  FiUsers,
  FiCheckCircle,
  FiPieChart,
  FiRepeat,
  FiTrendingUp,
} from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import type { ChainParamsResponse, Coin } from '@dexplorer/shared'
import { getConvertedAmount, formatAmount } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { useOracleExchangeRates } from '@/hooks/useOracleData'
import {
  displayDurationSeconds,
  convertRateToPercent,
  convertRawAmount,
  timeFromNow,
} from '@/utils/helper'

// The API returns each module's params as a loosely-typed
// `Record<string, unknown> | null` (raw values persisted from the chain
// query, no longer decoded into cosmjs-types classes). These local shapes
// describe just the fields this page reads, with optional chaining/fallbacks
// used throughout since the runtime shape can vary.
interface DurationLike {
  seconds?: string | number
}

interface MintParamsShape {
  mintDenom?: string
  inflationRateChange?: string
  inflationMax?: string
  inflationMin?: string
  goalBonded?: string
  blocksPerYear?: string | number
}

interface StakingParamsShape {
  unbondingTime?: DurationLike
  maxValidators?: number
  maxEntries?: number
  historicalEntries?: number
  bondDenom?: string
}

interface DistributionParamsShape {
  communityTax?: string
  baseProposerReward?: string
  bonusProposerReward?: string
  withdrawAddrEnabled?: boolean
}

interface SlashingParamsShape {
  signedBlocksWindow?: string | number
  minSignedPerWindow?: string | Uint8Array
  downtimeJailDuration?: DurationLike
  slashFractionDoubleSign?: string | Uint8Array
  slashFractionDowntime?: string | Uint8Array
}

interface GovVotingParamsShape {
  votingPeriod?: DurationLike
}

interface GovDepositParamsShape {
  minDeposit?: Coin[]
  maxDepositPeriod?: DurationLike
}

interface GovTallyParamsShape {
  quorum?: string
  threshold?: string
  vetoThreshold?: string
}

// Slashing fraction fields were raw protobuf bytes when queried directly via
// ABCI; after round-tripping through Mongo/JSON they typically arrive as
// plain decimal strings instead. Handle both shapes defensively.
const formatRate = (value: string | Uint8Array | undefined): string => {
  if (value === undefined) return 'N/A'
  if (typeof value === 'string') return convertRateToPercent(value)
  if (value instanceof Uint8Array) {
    return convertRateToPercent(new TextDecoder().decode(value))
  }
  return 'N/A'
}

// Cosmos SDK sdk.Dec fields queried over LCD/REST (the steembridge and
// oracledata modules — no ABCI/proto path for either) arrive already
// pretty-printed as a human decimal string ("0.500000000000000000"), unlike
// the raw scaled-bytes encoding formatRate/convertRateToPercent handle for
// params queried via ABCI — so this is just parseFloat * 100, no rescaling.
const formatDecPercent = (value: string | undefined): string => {
  if (value === undefined) return 'N/A'
  const num = parseFloat(value)
  return Number.isNaN(num) ? 'N/A' : `${(num * 100).toFixed(2)}%`
}

const formatAsteem = (rawAmount: string | undefined): string => {
  if (!rawAmount) return 'N/A'
  return rawAmount === '0' ? 'No limit' : `${convertRawAmount(rawAmount, 18)} STEEM`
}

const Parameters: React.FC = () => {
  const { colors } = useTheme()

  const { data: params, isLoading } = useQuery({
    queryKey: ['params'],
    queryFn: () => apiClient.get<ChainParamsResponse>('/params'),
  })
  const { rates, isLoading: ratesLoading, unavailable: ratesUnavailable } =
    useOracleExchangeRates()

  const mintParams = params?.mint as MintParamsShape | null | undefined
  const stakingParams = params?.staking as StakingParamsShape | null | undefined
  const distributionParams = params?.distribution as
    | DistributionParamsShape
    | null
    | undefined
  const slashingParams = params?.slashing as
    | SlashingParamsShape
    | null
    | undefined
  const govVotingParams = params?.gov.votingParams as
    | GovVotingParamsShape
    | null
    | undefined
  const govDepositParams = params?.gov.depositParams as
    | GovDepositParamsShape
    | null
    | undefined
  const govTallyParams = params?.gov.tallyParams as
    | GovTallyParamsShape
    | null
    | undefined
  const bridgeParams = params?.bridge ?? null
  const oracleParams = params?.oracle ?? null

  const ParameterCard: React.FC<{
    title: string
    module: string
    icon: React.ReactNode
    color: string
    isLoading: boolean
    children: React.ReactNode
  }> = ({ title, module, icon, color, isLoading, children }) => (
    <div className="reference-table-shell rounded-[14px]">
      <div
        className="flex items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: colors.border.primary }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: `${color}20` }}
        >
          {React.cloneElement(icon as React.ReactElement, {
            className: 'h-[17px] w-[17px]',
            style: { color },
          })}
        </div>
        <div className="flex flex-col leading-[1.25]">
          <span
            className="text-sm font-semibold"
            style={{ color: colors.text.primary }}
          >
            {title}
          </span>
          <span
            className="font-mono text-[11px]"
            style={{ color: colors.text.tertiary }}
          >
            {module}
          </span>
        </div>
      </div>

      <div className="flex flex-col px-5 py-[10px]">
        {isLoading ? (
          <div className="flex flex-col">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div
                  className="h-3.5 w-28 animate-pulse rounded"
                  style={{ backgroundColor: colors.border.secondary }}
                />
                <div
                  className="h-5 w-16 animate-pulse rounded-[7px]"
                  style={{ backgroundColor: colors.border.secondary }}
                />
              </div>
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )

  const ParameterItem: React.FC<{
    label: string
    value: string | number
    tooltip?: string
  }> = ({ label, value, tooltip }) => (
    <div className="flex items-center justify-between gap-4 py-2">
      <span
        className="text-[13px]"
        style={{ color: colors.text.secondary }}
        title={tooltip}
      >
        {label}
      </span>
      <span
        className="font-mono text-[12.5px] font-medium rounded-[7px] px-[10px] py-[3px]"
        style={{
          color: colors.text.primary,
          backgroundColor: colors.backgroundSecondary,
        }}
      >
        {value}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="text-sm" style={{ color: colors.text.secondary }}>
        Network parameters governing staking, governance, minting, slashing,
        the Steem bridge, and the price oracle on this chain.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Mint Parameters */}
        <ParameterCard
          title="Mint Parameters"
          module="x/mint"
          icon={<FiDollarSign />}
          color={colors.status.success}
          isLoading={isLoading}
        >
          <ParameterItem
            label="Mint Denom"
            value={mintParams?.mintDenom || 'N/A'}
            tooltip="The denomination of the minted token"
          />
          <ParameterItem
            label="Inflation Rate Change"
            value={
              mintParams?.inflationRateChange
                ? convertRateToPercent(mintParams.inflationRateChange)
                : 'N/A'
            }
            tooltip="Maximum annual change in inflation rate"
          />
          <ParameterItem
            label="Inflation Max"
            value={
              mintParams?.inflationMax
                ? convertRateToPercent(mintParams.inflationMax)
                : 'N/A'
            }
            tooltip="Maximum inflation rate"
          />
          <ParameterItem
            label="Inflation Min"
            value={
              mintParams?.inflationMin
                ? convertRateToPercent(mintParams.inflationMin)
                : 'N/A'
            }
            tooltip="Minimum inflation rate"
          />
          <ParameterItem
            label="Goal Bonded"
            value={
              mintParams?.goalBonded
                ? convertRateToPercent(mintParams.goalBonded)
                : 'N/A'
            }
            tooltip="Target percentage of total supply that should be bonded"
          />
          <ParameterItem
            label="Blocks per Year"
            value={
              mintParams?.blocksPerYear
                ? Number(mintParams.blocksPerYear).toLocaleString()
                : 'N/A'
            }
            tooltip="Expected number of blocks per year"
          />
        </ParameterCard>

        {/* Staking Parameters */}
        <ParameterCard
          title="Staking Parameters"
          module="x/staking"
          icon={<FiShield />}
          color={colors.status.info}
          isLoading={isLoading}
        >
          <ParameterItem
            label="Unbonding Time"
            value={
              stakingParams?.unbondingTime
                ? displayDurationSeconds(
                    Number(stakingParams.unbondingTime.seconds)
                  )
                : 'N/A'
            }
            tooltip="Time required to unbond staked tokens"
          />
          <ParameterItem
            label="Max Validators"
            value={
              stakingParams?.maxValidators
                ? Number(stakingParams.maxValidators)
                : 'N/A'
            }
            tooltip="Maximum number of active validators"
          />
          <ParameterItem
            label="Max Entries"
            value={
              stakingParams?.maxEntries
                ? Number(stakingParams.maxEntries)
                : 'N/A'
            }
            tooltip="Maximum number of unbonding delegations or redelegations"
          />
          <ParameterItem
            label="Historical Entries"
            value={
              stakingParams?.historicalEntries
                ? Number(stakingParams.historicalEntries)
                : 'N/A'
            }
            tooltip="Number of historical entries to persist"
          />
          <ParameterItem
            label="Bond Denom"
            value={stakingParams?.bondDenom || 'N/A'}
            tooltip="Denomination used for staking"
          />
        </ParameterCard>

        {/* Distribution Parameters */}
        <ParameterCard
          title="Distribution Parameters"
          module="x/distribution"
          icon={<FiPieChart />}
          color={colors.status.warning}
          isLoading={isLoading}
        >
          <ParameterItem
            label="Community Tax"
            value={
              distributionParams?.communityTax
                ? convertRateToPercent(distributionParams.communityTax)
                : 'N/A'
            }
            tooltip="Percentage of inflation that goes to community pool"
          />
          <ParameterItem
            label="Base Proposer Reward"
            value={
              distributionParams?.baseProposerReward
                ? convertRateToPercent(distributionParams.baseProposerReward)
                : 'N/A'
            }
            tooltip="Base reward for block proposer"
          />
          <ParameterItem
            label="Bonus Proposer Reward"
            value={
              distributionParams?.bonusProposerReward
                ? convertRateToPercent(distributionParams.bonusProposerReward)
                : 'N/A'
            }
            tooltip="Additional reward for block proposer based on precommits"
          />
          <ParameterItem
            label="Withdraw Address Enabled"
            value={distributionParams?.withdrawAddrEnabled ? 'Yes' : 'No'}
            tooltip="Whether delegators can set a different address to withdraw rewards"
          />
        </ParameterCard>

        {/* Slashing Parameters */}
        <ParameterCard
          title="Slashing Parameters"
          module="x/slashing"
          icon={<FiCheckCircle />}
          color={colors.status.error}
          isLoading={isLoading}
        >
          <ParameterItem
            label="Signed Blocks Window"
            value={
              slashingParams?.signedBlocksWindow
                ? Number(slashingParams.signedBlocksWindow).toLocaleString()
                : 'N/A'
            }
            tooltip="Number of blocks to track for uptime"
          />
          <ParameterItem
            label="Min Signed Per Window"
            value={formatRate(slashingParams?.minSignedPerWindow)}
            tooltip="Minimum percentage of blocks that must be signed"
          />
          <ParameterItem
            label="Downtime Jail Duration"
            value={
              slashingParams?.downtimeJailDuration
                ? displayDurationSeconds(
                    Number(slashingParams.downtimeJailDuration.seconds)
                  )
                : 'N/A'
            }
            tooltip="Duration a validator is jailed for downtime"
          />
          <ParameterItem
            label="Slash Fraction Double Sign"
            value={formatRate(slashingParams?.slashFractionDoubleSign)}
            tooltip="Percentage slashed for double signing"
          />
          <ParameterItem
            label="Slash Fraction Downtime"
            value={formatRate(slashingParams?.slashFractionDowntime)}
            tooltip="Percentage slashed for downtime"
          />
        </ParameterCard>

        {/* Governance Parameters */}
        <ParameterCard
          title="Governance Parameters"
          module="x/gov"
          icon={<FiUsers />}
          color={colors.primary}
          isLoading={isLoading}
        >
          <ParameterItem
            label="Voting Period"
            value={
              govVotingParams?.votingPeriod
                ? displayDurationSeconds(
                    Number(govVotingParams.votingPeriod.seconds)
                  )
                : 'N/A'
            }
            tooltip="Duration of the voting period for proposals"
          />
          <ParameterItem
            label="Min Deposit"
            value={
              govDepositParams?.minDeposit?.[0]
                ? (() => {
                    const converted = getConvertedAmount(
                      govDepositParams.minDeposit[0].amount,
                      govDepositParams.minDeposit[0].denom
                    )
                    return `${formatAmount(converted.converted)} ${converted.base.toUpperCase()}`
                  })()
                : 'N/A'
            }
            tooltip="Minimum deposit required to submit a proposal"
          />
          <ParameterItem
            label="Max Deposit Period"
            value={
              govDepositParams?.maxDepositPeriod
                ? displayDurationSeconds(
                    Number(govDepositParams.maxDepositPeriod.seconds)
                  )
                : 'N/A'
            }
            tooltip="Maximum period for deposits on a proposal"
          />
          <ParameterItem
            label="Quorum"
            value={
              govTallyParams?.quorum
                ? (parseFloat(govTallyParams.quorum) * 100).toFixed(2) + '%'
                : 'N/A'
            }
            tooltip="Minimum percentage of voting power that must participate"
          />
          <ParameterItem
            label="Threshold"
            value={
              govTallyParams?.threshold
                ? (parseFloat(govTallyParams.threshold) * 100).toFixed(2) + '%'
                : 'N/A'
            }
            tooltip="Minimum percentage of Yes votes for proposal to pass"
          />
          <ParameterItem
            label="Veto Threshold"
            value={
              govTallyParams?.vetoThreshold
                ? (parseFloat(govTallyParams.vetoThreshold) * 100).toFixed(2) +
                  '%'
                : 'N/A'
            }
            tooltip="Percentage of NoWithVeto votes needed to veto a proposal"
          />
        </ParameterCard>

        {/* Bridge Parameters */}
        <ParameterCard
          title="Bridge Parameters"
          module="x/steembridge"
          icon={<FiRepeat />}
          color={colors.status.info}
          isLoading={isLoading}
        >
          {bridgeParams ? (
            <>
              <ParameterItem
                label="Bridge In"
                value={bridgeParams.bridgeEnabled ? 'Enabled' : 'Disabled'}
                tooltip="Whether Steem → SVM deposits are currently accepted"
              />
              <ParameterItem
                label="Bridge Out"
                value={bridgeParams.bridgeOutEnabled ? 'Enabled' : 'Disabled'}
                tooltip="Whether SVM → Steem withdrawals are currently accepted"
              />
              <ParameterItem
                label="Gateway Account"
                value={bridgeParams.gatewayAccount}
                tooltip="Steem account deposits are sent to"
              />
              <ParameterItem
                label="Confirmation Threshold"
                value={formatDecPercent(
                  bridgeParams.bridgeConfirmationThreshold
                )}
                tooltip="Share of bonded validator power that must attest before a deposit mints"
              />
              <ParameterItem
                label="Bridge Fee"
                value={`${(bridgeParams.bridgeFeeBps / 100).toFixed(2)}%`}
                tooltip="Fee taken on bridged amounts, in basis points"
              />
              <ParameterItem
                label="Min / Max Bridge Amount"
                value={`${formatAsteem(bridgeParams.minimumBridgeAmount)} / ${formatAsteem(bridgeParams.maximumBridgeAmount)}`}
                tooltip="Per-transaction bridge amount bounds"
              />
              <ParameterItem
                label="Deposit Timeout"
                value={`${Number(bridgeParams.depositTimeoutBlocks).toLocaleString()} blocks`}
                tooltip="Blocks a deposit can accumulate attestations before expiring"
              />
              <ParameterItem
                label="Withdrawal Timeout"
                value={`${Number(bridgeParams.withdrawalTimeoutBlocks).toLocaleString()} blocks`}
                tooltip="Blocks a withdrawal can stay REQUESTED before auto-refunding on-chain"
              />
              <ParameterItem
                label="Name Service"
                value={bridgeParams.nameServiceEnabled ? 'Enabled' : 'Disabled'}
                tooltip="Whether Steem-account-to-address name linking is active"
              />
            </>
          ) : (
            <p className="py-2 text-[13px]" style={{ color: colors.text.tertiary }}>
              {isLoading ? '' : 'Bridge parameters unavailable on this deployment'}
            </p>
          )}
        </ParameterCard>

        {/* Oracle Parameters */}
        <ParameterCard
          title="Oracle Parameters"
          module="x/oracle/data"
          icon={<FiTrendingUp />}
          color={colors.status.success}
          isLoading={isLoading}
        >
          {oracleParams ? (
            <>
              <ParameterItem
                label="Vote Period"
                value={`${Number(oracleParams.votePeriod).toLocaleString()} blocks`}
                tooltip="Blocks between each price-feed aggregation round"
              />
              <ParameterItem
                label="Vote Threshold"
                value={formatDecPercent(oracleParams.voteThreshold)}
                tooltip="Share of bonded validator power required to finalize a rate"
              />
              <ParameterItem
                label="Reward Band"
                value={formatDecPercent(oracleParams.rewardBand)}
                tooltip="Tolerance around the median vote that still earns a reward"
              />
              <ParameterItem
                label="Miss Band"
                value={formatDecPercent(oracleParams.missBand)}
                tooltip="Tolerance around the median vote before a validator is marked as missing"
              />
              <ParameterItem
                label="Whitelisted Pairs"
                value={oracleParams.whitelist.length}
                tooltip={oracleParams.whitelist.join(', ')}
              />
            </>
          ) : (
            <p className="py-2 text-[13px]" style={{ color: colors.text.tertiary }}>
              {isLoading ? '' : 'Oracle parameters unavailable on this deployment'}
            </p>
          )}
        </ParameterCard>
      </div>

      {/* Oracle Price Feed */}
      <div className="reference-table-shell rounded-[14px]">
        <div
          className="flex items-center gap-3 border-b px-5 py-4"
          style={{ borderColor: colors.border.primary }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
            style={{ backgroundColor: `${colors.status.success}20` }}
          >
            <FiTrendingUp
              className="h-[17px] w-[17px]"
              style={{ color: colors.status.success }}
            />
          </div>
          <div className="flex flex-col leading-[1.25]">
            <span
              className="text-sm font-semibold"
              style={{ color: colors.text.primary }}
            >
              Oracle Price Feed
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: colors.text.tertiary }}
            >
              Finalized power-weighted-median rates, one per whitelisted pair
            </span>
          </div>
        </div>

        {ratesUnavailable ? (
          <p
            className="px-5 py-4 text-[13px]"
            style={{ color: colors.text.tertiary }}
          >
            Oracle price feed unavailable on this deployment
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: colors.border.primary }}
                >
                  <th className="reference-table-header px-5 py-3 text-left">
                    Pair
                  </th>
                  <th className="reference-table-header px-5 py-3 text-left">
                    Rate
                  </th>
                  <th className="reference-table-header px-5 py-3 text-right">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {ratesLoading && rates.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3" colSpan={3}>
                        <div
                          className="h-4 w-full animate-pulse rounded"
                          style={{ backgroundColor: colors.border.secondary }}
                        />
                      </td>
                    </tr>
                  ))
                ) : rates.length === 0 ? (
                  <tr>
                    <td
                      className="px-5 py-4 text-[13px]"
                      colSpan={3}
                      style={{ color: colors.text.tertiary }}
                    >
                      No exchange rates reported yet
                    </td>
                  </tr>
                ) : (
                  rates.map((rate) => (
                    <tr
                      key={rate.pair}
                      className="reference-table-row border-b"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <td className="px-5 py-3">
                        <span
                          className="text-[13px] font-medium"
                          style={{ color: colors.text.primary }}
                        >
                          {rate.pair.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="font-mono text-[12.5px]"
                          style={{ color: colors.text.primary }}
                        >
                          {parseFloat(rate.rate).toLocaleString(undefined, {
                            maximumFractionDigits: 8,
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className="text-[12.5px]"
                          style={{ color: colors.text.tertiary }}
                        >
                          {timeFromNow(
                            new Date(
                              Number(rate.updateTime) * 1000
                            ).toISOString()
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Parameters
