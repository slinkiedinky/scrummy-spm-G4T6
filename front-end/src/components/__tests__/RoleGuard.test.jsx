import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, usePathname } from 'next/navigation'
import { RoleGuard } from '../RoleGuard'
import { auth } from '@/lib/firebase'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
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
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Manager' })
      })

      render(<RoleGuard><div>Analytics Content</div></RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('Analytics Content')).toBeInTheDocument()
      })
    })

    it('should deny Staff access to analytics page', async () => {
      auth.currentUser = { uid: 'staff123' }
      usePathname.mockReturnValue('/analytics')
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'Staff' })
      })

      render(<RoleGuard><div>Analytics Content</div></RoleGuard>)

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
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<RoleGuard><div>Tasks Content</div></RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('Tasks Content')).toBeInTheDocument()
      })
    })

    it('should allow HR to access user management page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/usermgmt')
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<RoleGuard><div>User Management Content</div></RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('User Management Content')).toBeInTheDocument()
      })
    })

    it('should deny HR access to analytics page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/analytics')
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<RoleGuard><div>Analytics Content</div></RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })
    })

    it('should deny HR access to projects page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/projects')
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<RoleGuard><div>Projects Content</div></RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })
    })

    it('should deny HR access to timeline page', async () => {
      auth.currentUser = { uid: 'hr123' }
      usePathname.mockReturnValue('/timeline')
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ role: 'HR' })
      })

      render(<RoleGuard><div>Timeline Content</div></RoleGuard>)

      await waitFor(() => {
        expect(screen.getByText('You are not authorized to view this page.')).toBeInTheDocument()
      })
    })
  })
})
