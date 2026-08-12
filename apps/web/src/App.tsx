import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'
import Layout from '@/components/Layout/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useApiHealth } from '@/hooks/useApiHealth'
import { FiLoader, FiAlertTriangle } from 'react-icons/fi'

// Create a client
const queryClient = new QueryClient()

// Lazy load page components
const Home = lazy(() => import('@/pages/Home'))
const Blocks = lazy(() => import('@/pages/Blocks'))
const Validators = lazy(() => import('@/pages/Validators'))
const ValidatorDetail = lazy(() => import('@/pages/ValidatorDetail'))
const Transactions = lazy(() => import('@/pages/Transactions'))
const IBCTransfers = lazy(() => import('@/pages/IBCTransfers'))
const LiquidityPools = lazy(() => import('@/pages/LiquidityPools'))
const Bridge = lazy(() => import('@/pages/Bridge'))
const BridgeDepositDetail = lazy(() => import('@/pages/BridgeDepositDetail'))
const BridgeWithdrawalDetail = lazy(
  () => import('@/pages/BridgeWithdrawalDetail')
)
const SVMNS = lazy(() => import('@/pages/SVMNS'))
const SVMNSRegistrationDetail = lazy(
  () => import('@/pages/SVMNSRegistrationDetail')
)
const Proposals = lazy(() => import('@/pages/Proposals'))
const Accounts = lazy(() => import('@/pages/Accounts'))
const Parameters = lazy(() => import('@/pages/Parameters'))
const BlockDetail = lazy(() => import('@/pages/BlockDetail'))
const TransactionDetail = lazy(() => import('@/pages/TransactionDetail'))
const AccountDetail = lazy(() => import('@/pages/AccountDetail'))
const ProposalDetail = lazy(() => import('@/pages/ProposalDetail'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const LoadingFallback: React.FC = () => {
  const { colors } = useTheme()
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <FiLoader
        className="w-8 h-8 animate-spin"
        style={{ color: colors.primary }}
      />
    </div>
  )
}

const ApiUnreachable: React.FC = () => {
  const { colors } = useTheme()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <FiAlertTriangle
        className="h-8 w-8"
        style={{ color: colors.status.error }}
      />
      <h2
        className="font-heading text-xl font-semibold"
        style={{ color: colors.text.primary }}
      >
        Can't reach the SVM Scan API
      </h2>
      <p className="max-w-md text-sm" style={{ color: colors.text.tertiary }}>
        Make sure the backend is running and VITE_API_BASE_URL points to it.
      </p>
    </div>
  )
}

function AppContent() {
  const { isHealthy, isLoading } = useApiHealth()

  if (isLoading) {
    return (
      <Layout>
        <LoadingFallback />
      </Layout>
    )
  }

  if (!isHealthy) {
    return (
      <Layout>
        <ApiUnreachable />
      </Layout>
    )
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/blocks" element={<Blocks />} />
            <Route path="/blocks/:height" element={<BlockDetail />} />
            <Route path="/validators" element={<Validators />} />
            <Route path="/validators/:identity" element={<ValidatorDetail />} />
            <Route path="/proposals" element={<Proposals />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/txs" element={<Transactions />} />
            <Route path="/txs/:hash" element={<TransactionDetail />} />
            <Route path="/ibc-transfers" element={<IBCTransfers />} />
            <Route path="/liquidity-pools" element={<LiquidityPools />} />
            <Route path="/bridge" element={<Bridge />} />
            <Route
              path="/bridge/deposits/:id"
              element={<BridgeDepositDetail />}
            />
            <Route
              path="/bridge/withdrawals/:id"
              element={<BridgeWithdrawalDetail />}
            />
            <Route path="/svmns" element={<SVMNS />} />
            <Route
              path="/svmns/registrations/:id"
              element={<SVMNSRegistrationDetail />}
            />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:address" element={<AccountDetail />} />
            <Route path="/parameters" element={<Parameters />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
