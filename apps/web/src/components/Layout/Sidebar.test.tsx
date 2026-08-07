import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/theme/ThemeProvider'
import Sidebar from './Sidebar'

vi.mock('@/hooks/useApiHealth', () => ({
  useApiHealth: () => ({
    isHealthy: false,
    isLoading: false,
    health: undefined,
  }),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('renders the grouped navigation with footer link and network summary labels', () => {
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter>
            <Sidebar />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )

    expect(screen.getAllByText('Network').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chain Data').length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('link', { name: /github/i }).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Height').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Peers').length).toBeGreaterThan(0)
  })
})
