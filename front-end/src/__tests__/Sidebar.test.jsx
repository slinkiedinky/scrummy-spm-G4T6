import { render, screen, waitFor } from '@testing-library/react'
import { Sidebar } from '@/components/Sidebar'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter, usePathname } from 'next/navigation'

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}))

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  onSnapshot: jest.fn((_, callback) => {
    callback({ size: 0 })
    return jest.fn()
  }),
}))

// Mock Firebase config
jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: { uid: 'test-user-123' } },
  db: {},
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('Sidebar Component - Scrum-1.6: Verify user role is displayed after login', () => {
  beforeEach(() => {
    // Setup router mocks
    useRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    })
    
    usePathname.mockReturnValue('/tasks')

    // Mock authenticated user
    onAuthStateChanged.mockImplementation((_, callback) => {
      callback({ uid: 'test-user-123' })
      return jest.fn()
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })


  // Scrum-1.6 — Verify user role is displayed after login
  it('should display user role "Staff" after login', async () => {
    // Arrange: Mock API response with Staff role
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        fullName: 'Test User',
        role: 'Staff',
      }),
    })

    // Act: Render the Sidebar component
    render(<Sidebar />)

    // Assert: Verify the role is displayed
    await waitFor(() => {
      expect(screen.getByText('Staff')).toBeInTheDocument()
    })
  })

  it('should display user role "Manager" after login', async () => {
    // Arrange: Mock API response with Manager role
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        fullName: 'Test User',
        role: 'Manager',
      }),
    })
    // Act: Render the Sidebar component
    render(<Sidebar />)

    // Assert: Verify the role is displayed
    await waitFor(() => {
      expect(screen.getByText('Manager')).toBeInTheDocument()
    })
  })
})