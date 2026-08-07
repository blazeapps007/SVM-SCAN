import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('@/hooks/useApiHealth', () => ({
  useApiHealth: () => ({
    isHealthy: false,
    isLoading: false,
    health: undefined,
  }),
}))

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('shows an unreachable-API message when the backend is not reachable', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: "Can't reach the Dexplorer API",
      })
    ).toBeInTheDocument()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
  })
})
