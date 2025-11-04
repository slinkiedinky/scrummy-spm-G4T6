import { act, render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'

// Mock auth
let mockAuthState = null
let mockOnAuthStateChanged = null
let unsubscribeMock = jest.fn()

jest.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: (callback) => {
      mockOnAuthStateChanged = callback
      // Call immediately with current state
      callback(mockAuthState)
      // Return unsubscribe function
      return unsubscribeMock
    },
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

describe('AuthGuard Component', () => {
  let mockReplace
  let mockPush

  beforeEach(() => {
    jest.clearAllMocks()
    unsubscribeMock = jest.fn()
    mockAuthState = null

    mockReplace = jest.fn()
    mockPush = jest.fn()

    useRouter.mockReturnValue({
      replace: mockReplace,
      push: mockPush,
    })
  })

  // Scrum-1.4 — Verify task space is not accessible without logging in
  it('redirects to login page when accessing task space URL without being logged in', async () => {
    mockAuthState = null

    render(
      <AuthGuard>
        <div>Task Space Protected Content</div>
      </AuthGuard>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })

    expect(screen.queryByText('Task Space Protected Content')).not.toBeInTheDocument()
  })

  // Scrum-1.5 — Verify task space is accessible after logging in
  it('renders protected content when user is logged in', async () => {
    mockAuthState = { uid: 'user1' }
    render(
      <AuthGuard>
        <div>Task Space Protected Content</div>
      </AuthGuard>
    )
    expect(await screen.findByText('Task Space Protected Content')).toBeInTheDocument()
  })
})
