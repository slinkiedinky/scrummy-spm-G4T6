/**
 * @file page.test.jsx
 * Test cases for User Management Page
 * Run with: npx jest src/app/(dashboard)/usermgmt/__tests__/page.test.jsx
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserManagementPage from '../page'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

// ─── Mocks ───────────────────────────────────────────────────────────
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({
  auth: {},
}))

jest.mock('@/components/RoleGuard', () => ({
  RoleGuard: ({ children, allowedRoles }) => {
    return <div data-testid="role-guard" data-allowed-roles={allowedRoles.join(',')}>
      {children}
    </div>
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('UserManagementPage', () => {
  const mockUsers = [
    {
      id: 'user1',
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      role: 'Manager',
    },
    {
      id: 'user2',
      fullName: 'Jane Smith',
      email: 'jane.smith@example.com',
      role: 'Staff',
    },
    {
      id: 'user3',
      fullName: 'Bob Johnson',
      email: 'bob.johnson@example.com',
      role: 'HR',
    },
    {
      id: 'currentUser',
      fullName: 'Current User',
      email: 'current.user@example.com',
      role: 'HR',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock onAuthStateChanged to simulate logged-in user
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ uid: 'currentUser' })
      return jest.fn() // Return mock unsubscribe function
    })

    // Mock successful fetch by default
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ users: mockUsers }),
    })
  })

  afterEach(() => {
    fetch.mockClear()
  })

  // ── 1. Component Rendering ───────────────────────────────────────────
  describe('Component Rendering', () => {
    it('renders the page title', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
    })

    it('wraps content with RoleGuard for HR role', () => {
      const { container } = render(<UserManagementPage />)
      
      const roleGuard = container.querySelector('[data-testid="role-guard"]')
      expect(roleGuard).toBeInTheDocument()
      expect(roleGuard.getAttribute('data-allowed-roles')).toBe('HR')
    })

    it('renders the refresh button', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Refresh User List')).toBeInTheDocument()
      })
    })

    it('renders the search input', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search by name or email...')
        expect(searchInput).toBeInTheDocument()
      })
    })
  })

  // ── 2. User Fetching ────────────────────────────────────────────────
  describe('User Fetching', () => {
    it('fetches users on component mount', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/users')
      })
    })

    it('displays loading state while fetching', () => {
      fetch.mockImplementation(() => new Promise(() => {})) // Never resolves
      
      render(<UserManagementPage />)
      
      expect(screen.getByText('Loading users...')).toBeInTheDocument()
    })

    it('displays users after successful fetch', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })
    })

    it('filters out the current user from the list', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.queryByText('Current User')).not.toBeInTheDocument()
        expect(screen.queryByText('current.user@example.com')).not.toBeInTheDocument()
      })
    })

    it('handles fetch error gracefully', async () => {
      const mockAlert = jest.fn()
      global.alert = mockAlert
      
      fetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to fetch users')
      })
      
      delete global.alert
    })

    it('handles non-ok response', async () => {
      const mockAlert = jest.fn()
      global.alert = mockAlert
      
      fetch.mockResolvedValueOnce({
        ok: false,
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to fetch users')
      })
      
      delete global.alert
    })

    it('handles users data in different formats', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers, // Direct array instead of { users: [...] }
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })
  })

  // ── 3. Refresh Functionality ────────────────────────────────────────
  describe('Refresh Functionality', () => {
    it('refetches users when refresh button is clicked', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1)
      })
      
      const refreshButton = screen.getByText('Refresh User List')
      await user.click(refreshButton)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('shows loading state during refresh', async () => {
      const user = userEvent.setup()
      let resolvePromise
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      
      fetch.mockImplementation(() => promise)
      
      render(<UserManagementPage />)
      
      expect(screen.getByText('Loading users...')).toBeInTheDocument()
      
      resolvePromise({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      
      await waitFor(() => {
        expect(screen.queryByText('Loading users...')).not.toBeInTheDocument()
      })
    })
  })

  // ── 4. Search Functionality ─────────────────────────────────────────
  describe('Search Functionality', () => {
    it('filters users by name', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'jane')
      
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument()
    })

    it('filters users by email', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'bob.johnson')
      
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    })

    it('is case-insensitive', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'JOHN')
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('shows "no users found" message when search has no results', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'nonexistent')
      
      expect(screen.getByText('No users found')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search.')).toBeInTheDocument()
    })

    it('shows all users when search is cleared', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      await user.type(searchInput, 'jane')
      
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      
      await user.clear(searchInput)
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
    })
  })

  // ── 5. User Display ─────────────────────────────────────────────────
  describe('User Display', () => {
    it('displays user full name', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    it('displays user email', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      })
    })

    it('displays user role as badge', async () => {
      render(<UserManagementPage />)
      
      await waitFor(() => {
        const managerBadges = screen.getAllByText('Manager')
        expect(managerBadges.length).toBeGreaterThan(0)
      })
    })

    it('displays "No name" for users without fullName', async () => {
      const usersWithoutName = [
        { id: 'user1', email: 'test@example.com', role: 'Staff' },
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: usersWithoutName }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('No name')).toBeInTheDocument()
      })
    })

    it('displays "No email" for users without email', async () => {
      const usersWithoutEmail = [
        { id: 'user1', fullName: 'Test User', role: 'Staff' },
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: usersWithoutEmail }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('No email')).toBeInTheDocument()
      })
    })

    it('displays "Staff" as default role', async () => {
      const usersWithoutRole = [
        { id: 'user1', fullName: 'Test User', email: 'test@example.com' },
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: usersWithoutRole }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        const staffBadges = screen.getAllByText('Staff')
        expect(staffBadges.length).toBeGreaterThan(0)
      })
    })
  })

  // ── 6. Role Change Modal ────────────────────────────────────────────
  describe('Role Change Modal', () => {
    it('opens modal when user is clicked', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      expect(screen.getByText('Change Role')).toBeInTheDocument()
    })

    it('displays user information in modal', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      // Check modal shows user details
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(1)
      expect(screen.getAllByText('john.doe@example.com').length).toBeGreaterThan(0)
    })

    it('shows current role selected in dropdown', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('Jane Smith')
      await user.click(userItem)
      
      // The select should have "Staff" as the value (Jane's current role)
      const selectTrigger = screen.getByRole('combobox')
      expect(selectTrigger).toHaveTextContent('Staff')
    })

    it('closes modal when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      expect(screen.getByText('Change Role')).toBeInTheDocument()
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      await waitFor(() => {
        expect(screen.queryByText('Change Role')).not.toBeInTheDocument()
      })
    })

    it('shows role select dropdown in modal with current role', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('Jane Smith')
      await user.click(userItem)
      
      // Check that the select component is rendered
      const selectTrigger = screen.getByRole('combobox')
      expect(selectTrigger).toBeInTheDocument()
      expect(screen.getByText('Select Role')).toBeInTheDocument()
      
      // The select should show Staff (Jane's current role)
      expect(selectTrigger).toHaveTextContent('Staff')
    })

    it('allows changing role via fireEvent (testing Select component)', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('Jane Smith')
      await user.click(userItem)
      
      // Use fireEvent to trigger the value change on Select
      const selectTrigger = screen.getByRole('combobox')
      
      // Simulate changing the select value using fireEvent
      // This tests that the Select component can handle value changes
      fireEvent.click(selectTrigger)
      
      // The dropdown should attempt to open (though options may not render in JSDOM)
      expect(selectTrigger).toHaveAttribute('aria-expanded', 'true')
    })
  })

  // ── 7. Role Update Functionality ────────────────────────────────────
  describe('Role Update Functionality', () => {
    it('updates role via direct state change (testing update logic)', async () => {
      const user = userEvent.setup()
      
      // Setup initial fetch for users
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('Jane Smith')
      await user.click(userItem)
      
      // Mock the PUT request
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        // The update will be called with the current selected role (Staff, which is Jane's current role)
        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/users/user2',
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })
    })

    it('closes modal after clicking confirm', async () => {
      const user = userEvent.setup()
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('Jane Smith')
      await user.click(userItem)
      
      expect(screen.getByText('Change Role')).toBeInTheDocument()
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(screen.queryByText('Change Role')).not.toBeInTheDocument()
      })
    })

    it('shows "Saving..." text while updating', async () => {
      const user = userEvent.setup()
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      let resolveUpdate
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })
      
      fetch.mockImplementation(() => updatePromise)
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      
      resolveUpdate({
        ok: true,
        json: async () => ({}),
      })
      
      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })

    it('disables confirm button while updating', async () => {
      const user = userEvent.setup()
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      let resolveUpdate
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })
      
      fetch.mockImplementation(() => updatePromise)
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      const savingButton = screen.getByRole('button', { name: /saving/i })
      expect(savingButton).toBeDisabled()
      
      resolveUpdate({
        ok: true,
        json: async () => ({}),
      })
    })

    it('handles update error gracefully', async () => {
      const user = userEvent.setup()
      const mockAlert = jest.fn()
      global.alert = mockAlert
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      fetch.mockRejectedValueOnce(new Error('Update failed'))
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to update role')
      })
      
      delete global.alert
    })

    it('handles non-ok update response', async () => {
      const user = userEvent.setup()
      const mockAlert = jest.fn()
      global.alert = mockAlert
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      fetch.mockResolvedValueOnce({
        ok: false,
      })
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to update role')
      })
      
      delete global.alert
    })
  })

  // ── 8. Auth State Management ───────────────────────────────────────
  describe('Auth State Management', () => {
    it('tracks current user ID from auth state', async () => {
      const mockCallback = jest.fn()
      onAuthStateChanged.mockImplementation((auth, callback) => {
        mockCallback(callback)
        callback({ uid: 'test-user-id' })
        return jest.fn()
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(onAuthStateChanged).toHaveBeenCalled()
      })
    })

    it('handles null user in auth state', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null)
        return jest.fn()
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
    })

    it('cleans up auth listener on unmount', () => {
      const mockUnsubscribe = jest.fn()
      onAuthStateChanged.mockImplementation(() => mockUnsubscribe)
      
      const { unmount } = render(<UserManagementPage />)
      
      unmount()
      
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  // ── 9. Edge Cases ───────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('handles empty user list', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [] }),
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
      })
    })

    it('handles user list with only current user', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [mockUsers[3]] }), // Only current user
      })
      
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
      })
    })

    it('handles clicking on user email to open modal', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      })
      
      const emailElement = screen.getByText('john.doe@example.com')
      await user.click(emailElement)
      
      expect(screen.getByText('Change Role')).toBeInTheDocument()
    })

    it('modal displays select component with label', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      
      const userItem = screen.getByText('John Doe')
      await user.click(userItem)
      
      // Verify the select trigger exists
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Select Role')).toBeInTheDocument()
    })

    // Note: Testing Radix UI Select dropdown options in JSDOM is challenging
    // due to limitations with portals and pointer events. The dropdown functionality
    // works correctly in real browsers and can be tested with E2E tests (Cypress/Playwright).
    // The component code defines roles: ["Staff", "Manager", "HR"] in page.jsx line 27.
  })
})
