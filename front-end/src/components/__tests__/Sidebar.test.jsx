import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from '../Sidebar'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { useRouter, usePathname } from 'next/navigation'

// Mock Firebase
jest.mock('firebase/auth', () => ({
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  onSnapshot: jest.fn((_, callback) => {
    callback({ size: 0 })
    return jest.fn()
  }),
}))

jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Sidebar Component', () => {
  let mockPush
  let mockReplace

  beforeEach(() => {
    jest.clearAllMocks()

    mockPush = jest.fn()
    mockReplace = jest.fn()

    useRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    })

    usePathname.mockReturnValue('/tasks')

    // Mock auth.currentUser
    const firebaseModule = require('@/lib/firebase')
    firebaseModule.auth.currentUser = {
      uid: 'test-user-123'
    }

    onAuthStateChanged.mockImplementation((_, callback) => {
      callback({ uid: 'test-user-123' })
      return jest.fn()
    })

    const { onSnapshot } = require('firebase/firestore')
    onSnapshot.mockImplementation((_, callback) => {
      callback({ size: 0 })
      return jest.fn()
    })

    // Mock successful user fetch
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        fullName: 'John Doe',
        role: 'Manager',
      }),
    })
  })

  it('renders sidebar with brand name', async () => {
    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('TaskFlow')).toBeInTheDocument()
    })
  })

  it('displays navigation items for manager role', async () => {
    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Tasks')).toBeInTheDocument()
    })

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('displays user information after loading', async () => {
    render(<Sidebar />)

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // After loading, shows user data
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    expect(screen.getByText('Manager')).toBeInTheDocument()
  })

  it('displays user initials', async () => {
    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('JD')).toBeInTheDocument()
    })
  })

  it('toggles sidebar collapse state', async () => {
    const { container } = render(<Sidebar />)

    const sidebar = container.firstChild
    expect(sidebar).toHaveClass('w-80')

    const toggleButton = screen.getByRole('button', { name: '' })
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(sidebar).toHaveClass('w-16')
    })
  })

  it('hides text when collapsed', async () => {
    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('TaskFlow')).toBeInTheDocument()
    })

    const toggleButton = screen.getByRole('button', { name: '' })
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(screen.queryByText('TaskFlow')).not.toBeInTheDocument()
    })
  })

  it('highlights active navigation item', async () => {
    usePathname.mockReturnValue('/tasks')

    render(<Sidebar />)

    await waitFor(() => {
      const tasksLink = screen.getByText('Tasks').closest('a')
      expect(tasksLink).toHaveClass('bg-blue-500', 'text-white')
    })
  })

  it('handles logout successfully', async () => {
    signOut.mockResolvedValue()

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByTitle('Logout')).toBeInTheDocument()
    })

    const logoutButton = screen.getByTitle('Logout')
    fireEvent.click(logoutButton)

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  it('handles logout errors', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    signOut.mockRejectedValue(new Error('Logout failed'))

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByTitle('Logout')).toBeInTheDocument()
    })

    const logoutButton = screen.getByTitle('Logout')
    fireEvent.click(logoutButton)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    consoleErrorSpy.mockRestore()
  })

  it('navigates to notifications page', async () => {
    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByTitle('Notifications')).toBeInTheDocument()
    })

    const notificationButton = screen.getByTitle('Notifications')
    fireEvent.click(notificationButton)

    expect(mockPush).toHaveBeenCalledWith('/notifications')
  })

  it('uses fallback data when API fails', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'))

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    expect(screen.getByText('Staff')).toBeInTheDocument()
  })

  it('filters navigation items by role', async () => {
    // Test HR role
    global.fetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        fullName: 'HR User',
        role: 'HR',
      }),
    })

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument()
    })
  })

  it('does not show user management for staff role', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        fullName: 'Staff User',
        role: 'Staff',
      }),
    })

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Staff User')).toBeInTheDocument()
    })

    expect(screen.queryByText('User Management')).not.toBeInTheDocument()
  })
})
