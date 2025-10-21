import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { RoleGuard } from '../RoleGuard'
import { auth } from '@/lib/firebase'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock firebase auth
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('RoleGuard Component', () => {
  const mockPush = jest.fn()
  const mockChildren = <div data-testid="protected-content">Protected Content</div>

  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue({ push: mockPush })
    fetch.mockClear()
  })

  describe('Loading state', () => {
    it('shows loading message initially', () => {
      auth.currentUser = { uid: 'test-user-123' }
      fetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<RoleGuard allowedRoles={['Manager']}>{mockChildren}</RoleGuard>)

      expect(screen.getByText('Verifying access...')).toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('applies correct styling to loading state', () => {
      auth.currentUser = { uid: 'test-user-123' }
      fetch.mockImplementation(() => new Promise(() => {}))

      const { container } = render(
        <RoleGuard allowedRoles={['HR']}>{mockChildren}</RoleGuard>
      )

      const loadingDiv = container.querySelector('.flex.items-center.justify-center.min-h-screen')
      expect(loadingDiv).toBeInTheDocument()
    })
  })

  describe('Unauthenticated state', () => {
    it('shows unauthorized message when user is not logged in', async () => {
      auth.currentUser = null

      render(<RoleGuard allowedRoles={['Manager']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('shows "Go to Tasks" button when unauthenticated', async () => {
      auth.currentUser = null

      render(<RoleGuard allowedRoles={['HR']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to tasks/i })).toBeInTheDocument()
      })
    })

    it('navigates to /tasks when button is clicked', async () => {
      const user = userEvent.setup()
      auth.currentUser = null

      render(<RoleGuard allowedRoles={['Manager']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to tasks/i })).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /go to tasks/i })
      await user.click(button)

      expect(mockPush).toHaveBeenCalledWith('/tasks')
    })
  })

  describe('Unauthorized state (wrong role)', () => {
    it('shows unauthorized message when user lacks required role', async () => {
      auth.currentUser = { uid: 'test-user-123' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Staff' }),
      })

      render(<RoleGuard allowedRoles={['HR', 'Manager']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('fetches user data with correct URL', async () => {
      auth.currentUser = { uid: 'user-456' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Staff' }),
      })

      render(<RoleGuard allowedRoles={['Manager']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/users/user-456')
      })
    })

    it('shows "Go to Tasks" button when unauthorized', async () => {
      auth.currentUser = { uid: 'test-user-123' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Staff' }),
      })

      render(<RoleGuard allowedRoles={['HR']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to tasks/i })).toBeInTheDocument()
      })
    })
  })

  describe('Authorized state (correct role)', () => {
    it('renders children when user has required role', async () => {
      auth.currentUser = { uid: 'test-user-123' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Manager' }),
      })

      render(<RoleGuard allowedRoles={['Manager', 'HR']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })

      expect(screen.queryByText('Verifying access...')).not.toBeInTheDocument()
      expect(screen.queryByText('You are not authorized to view this page.')).not.toBeInTheDocument()
    })

    it('authorizes HR role when allowed', async () => {
      auth.currentUser = { uid: 'hr-user' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' }),
      })

      render(<RoleGuard allowedRoles={['HR']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })

    it('authorizes Staff role when allowed', async () => {
      auth.currentUser = { uid: 'staff-user' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Staff' }),
      })

      render(<RoleGuard allowedRoles={['Staff', 'Manager', 'HR']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })
  })

  describe('API failure fallback', () => {
    it('uses fallback role (Staff) when API returns 404', async () => {
      auth.currentUser = { uid: 'test-user' }
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      render(<RoleGuard allowedRoles={['Staff']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })

    it('blocks access when fallback Staff role is not allowed', async () => {
      auth.currentUser = { uid: 'test-user' }
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      render(<RoleGuard allowedRoles={['HR', 'Manager']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })
    })

    it('uses fallback role when API returns non-JSON response', async () => {
      auth.currentUser = { uid: 'test-user' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'text/html' },
      })

      render(<RoleGuard allowedRoles={['Staff']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })

    it('uses fallback role when fetch throws error', async () => {
      auth.currentUser = { uid: 'test-user' }
      fetch.mockRejectedValueOnce(new Error('Network error'))

      render(<RoleGuard allowedRoles={['Staff']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })
  })

  describe('Multiple roles', () => {
    it('allows access when user has one of multiple allowed roles', async () => {
      auth.currentUser = { uid: 'test-user' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Manager' }),
      })

      render(<RoleGuard allowedRoles={['HR', 'Manager', 'Staff']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })

    it('denies access when user role is not in allowed list', async () => {
      auth.currentUser = { uid: 'test-user' }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Guest' }),
      })

      render(<RoleGuard allowedRoles={['HR', 'Manager']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })
    })
  })

  describe('Unauthorized message styling', () => {
    it('applies correct styling to unauthorized message', async () => {
      auth.currentUser = null

      const { container } = render(
        <RoleGuard allowedRoles={['HR']}>{mockChildren}</RoleGuard>
      )

      await waitFor(() => {
        const heading = screen.getByText('You are not authorized to view this page.')
        expect(heading).toHaveClass('text-2xl', 'font-semibold', 'text-red-600')
      })
    })

    it('applies correct styling to Go to Tasks button', async () => {
      auth.currentUser = null

      render(<RoleGuard allowedRoles={['Manager']}>{mockChildren}</RoleGuard>)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /go to tasks/i })
        expect(button).toHaveClass('px-4', 'py-2', 'text-white', 'font-semibold', 'bg-gray-400', 'rounded-lg')
      })
    })
  })
})
