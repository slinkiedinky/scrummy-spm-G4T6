import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalyticsPage from '@/app/analytics/page'
import UserManagementPage from '@/app/(dashboard)/usermgmt/page'
import ProjectsPage from '@/app/projects/page'
import TimelinePage from '@/app/timeline/page'
import TasksPage from '@/app/tasks/page'
import { useRouter, usePathname } from 'next/navigation'
import { RoleGuard } from '@/components/RoleGuard'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}))

jest.mock('@/lib/api', () => ({
  listProjects: jest.fn(),
  listUsers: jest.fn(),
}))

global.fetch = jest.fn()

describe('RoleGuard Component', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue({ push: mockPush })
    fetch.mockClear()
  })

  // Scrum-356.1: Verify only managers can access project analytics page
  describe('Manager Role - Analytics Access', () => {
    it('should allow Manager to access analytics page', async () => {
      auth.currentUser = { uid: 'manager123' }
      usePathname.mockReturnValue('/analytics')
      
      // Mock onAuthStateChanged to immediately call callback with user
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: 'manager123' })
        return jest.fn() // unsubscribe function
      })
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Manager' })
      })

      render(<AnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
      })
    })

    it('should deny Staff access to analytics page', async () => {
      auth.currentUser = { uid: 'staff123' }
      usePathname.mockReturnValue('/analytics')
      
      // Mock onAuthStateChanged to immediately call callback with user
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: 'staff123' })
        return jest.fn() // unsubscribe function
      })
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Staff' })
      })

      render(<AnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })
    })
  })

  // Scrum-356.2: Verify HR can only access tasks page and user management page
  describe('HR Role - Access Restrictions', () => {
    it('should allow HR to access tasks page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/tasks')
      
      // Mock onAuthStateChanged to immediately call callback with user
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: 'hr123' })
        return jest.fn() // unsubscribe function
      })
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<TasksPage />)

      await waitFor(() => {
        expect(screen.getByText('My Tasks')).toBeInTheDocument()
      })
    })

    it('should allow HR to access user management page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/usermgmt')
      
      // Mock onAuthStateChanged to immediately call callback with user
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: 'hr123' })
        return jest.fn() // unsubscribe function
      })
      
      // Mock fetch for RoleGuard to get user role and for UserManagementPage to get all users
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR', users: [] })
      })

      render(<UserManagementPage />)

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
    })

    it('should deny HR access to analytics page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/analytics')
      
      // Mock onAuthStateChanged to immediately call callback with user
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: 'hr123' })
        return jest.fn() // unsubscribe function
      })
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<AnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })
    })

    it('should deny HR access to projects page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/projects')
      
      // Mock onAuthStateChanged to immediately call callback with user
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: 'hr123' })
        return jest.fn() // unsubscribe function
      })
      
      // Mock fetch for RoleGuard to get user role
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should deny HR access to timeline page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/timeline')
      
      // Mock onAuthStateChanged to immediately call callback with user
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: 'hr123' })
        return jest.fn() // unsubscribe function
      })
      
      // Mock fetch for RoleGuard to get user role
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<TimelinePage />)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})
