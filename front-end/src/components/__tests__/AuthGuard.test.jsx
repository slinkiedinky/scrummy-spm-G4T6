import { act, render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import AuthGuard from '../AuthGuard'

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

  it('renders children when user is authenticated', async () => {
    mockAuthState = { uid: 'test-user-123', email: 'test@example.com' }

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })
  })

  it('redirects to home when user is not authenticated', async () => {
    mockAuthState = null

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('does not render anything initially', () => {
    mockAuthState = null

    const { container } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    // Initially should render nothing (null)
    expect(container.firstChild).toBeNull()
  })

  it('handles auth state change from unauthenticated to authenticated', async () => {
    mockAuthState = null

    const { rerender } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    // Should redirect when not authenticated
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })

    // Simulate user logging in
    mockAuthState = { uid: 'test-user-123' }
    if (mockOnAuthStateChanged) {
      await act(async () => {
        mockOnAuthStateChanged(mockAuthState)
      })
    }

    rerender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })
  })

  it('cleans up auth listener on unmount', () => {
    mockAuthState = { uid: 'test-user' }

    const { unmount } = render(
      <AuthGuard>
        <div>Content</div>
      </AuthGuard>
    )

    unmount()

    // Verify cleanup
    expect(unsubscribeMock).toHaveBeenCalled()
  })

  it('renders multiple children', async () => {
    mockAuthState = { uid: 'test-user-123' }

    render(
      <AuthGuard>
        <div>First Child</div>
        <div>Second Child</div>
        <div>Third Child</div>
      </AuthGuard>
    )

    await waitFor(() => {
      expect(screen.getByText('First Child')).toBeInTheDocument()
    })
    expect(screen.getByText('Second Child')).toBeInTheDocument()
    expect(screen.getByText('Third Child')).toBeInTheDocument()
  })

  it('does not redirect multiple times', async () => {
    mockAuthState = null

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledTimes(1)
    })
  })
})
