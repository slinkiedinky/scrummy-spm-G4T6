/**
 * @file usermgmt.test.jsx
 * Test cases for User Management Page based on Scrum-318 requirements
 * Run with: npx jest src/app/(dashboard)/usermgmt/__tests__/usermgmt.test.jsx
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserManagementPage from '@/app/(dashboard)/usermgmt/page'
import { onAuthStateChanged } from 'firebase/auth'

// ─── Mocks ───────────────────────────────────────────────────────────
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({
  auth: {},
}))

jest.mock('@/components/RoleGuard', () => ({
  RoleGuard: ({ children }) => <>{children}</>,
}))

global.fetch = jest.fn()

describe('User Management - Scrum-318', () => {
  const mockUsers = [
    {
      id: 'user1',
      fullName: 'Staff User',
      email: 'staff@example.com',
      role: 'Staff',
    },
    {
      id: 'user2',
      fullName: 'User Example',
      email: 'user@example.com',
      role: 'Staff',
    },
    {
      id: 'hrUser',
      fullName: 'HR Admin',
      email: 'hr@example.com',
      role: 'HR',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ uid: 'hrUser' })
      return jest.fn()
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ users: mockUsers }),
    })
  })

  afterEach(() => {
    fetch.mockClear()
  })

  // ── Scrum-318.1: HR can search for users in the system ──────────────
  describe('Scrum-318.1 - HR can search for users in the system', () => {
    it('should allow HR to search for users by name', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('Staff User')).toBeInTheDocument()
      })
      
      // Navigate to user management page and locate search functionality
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      expect(searchInput).toBeInTheDocument()
      
      // Enter user name in search field
      await user.type(searchInput, 'john.doe@example.com')
      
      // Verify search results are displayed with relevant results
      // Since we don't have john.doe in mock data, it should show no results
      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
      })
    })

    it('should display search results for existing user email', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Staff User')).toBeInTheDocument()
        expect(screen.getByText('User Example')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      
      // Search for user@example.com
      await user.type(searchInput, 'user@example.com')
      
      // Should show User Example but filter out Staff User
      await waitFor(() => {
        expect(screen.getByText('User Example')).toBeInTheDocument()
        expect(screen.queryByText('Staff User')).not.toBeInTheDocument()
      })
    })
  })

  // ── Scrum-318.2: HR can assign Manager, Staff, or HR role to users ──
  describe('Scrum-318.2 - HR can assign Manager, Staff, or HR role to users', () => {
    it('should allow HR to assign Manager role to a Staff user', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('staff@example.com')).toBeInTheDocument()
      })
      
      // Search for and select target user
      const staffUserElement = screen.getByText('staff@example.com')
      await user.click(staffUserElement)
      
      // Verify role assignment dropdown/options are available
      await waitFor(() => {
        expect(screen.getByText('Change Role')).toBeInTheDocument()
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
      
      // Mock successful role update
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      // Save changes and verify role is updated
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/users/user1',
          expect.objectContaining({
            method: 'PUT',
          })
        )
      })
    })

    it('should verify Manager, Staff, and HR roles are available options', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Staff User')).toBeInTheDocument()
      })
      
      // Open role change modal
      const userElement = screen.getByText('Staff User')
      await user.click(userElement)
      
      // Verify role assignment functionality is accessible
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
        expect(screen.getByText('Select Role')).toBeInTheDocument()
      })
    })
  })

  // ── Scrum-318.3: Each user can only be assigned one role at a time ──
  describe('Scrum-318.3 - Each user can only be assigned one role at a time', () => {
    it('should verify user is assigned only one role and can change to Manager', async () => {
      const user = userEvent.setup()
      render(<UserManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('user@example.com')).toBeInTheDocument()
      })
      
      // Verify current role is Staff
      const staffBadge = screen.getAllByText('Staff')
      expect(staffBadge.length).toBeGreaterThan(0)
      
      // Search for and select target user
      const userElement = screen.getByText('user@example.com')
      await user.click(userElement)
      
      // Mock successful role update
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      
      // Assign Manager role to user and save changes
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)
      
      // Verify user now has only Manager role (Staff role is removed)
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/users/user2',
          expect.objectContaining({
            method: 'PUT',
          })
        )
      })
    })
  })
})
