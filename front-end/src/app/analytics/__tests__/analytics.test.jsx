import { render, screen, waitFor } from '@testing-library/react'
import AnalyticsPage from '../page'
import { listProjects } from '@/lib/api'
import { onAuthStateChanged } from 'firebase/auth'

// Mock the API
jest.mock('@/lib/api', () => ({
  listProjects: jest.fn(),
}))

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

// Mock RoleGuard to just render children
jest.mock('@/components/RoleGuard', () => ({
  RoleGuard: ({ children }) => <div>{children}</div>,
}))

describe('AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Scrum-356.3: Verify only managers involved in a project can view that project's analytics
  describe('Project-specific analytics access', () => {
    it('should allow Manager A to view Project X analytics when assigned to Project X', async () => {
      // Setup Manager A (assigned to Project X)
      const managerAUser = { uid: 'managerA123', email: 'managera@example.com' }
      
      // Mock auth state for Manager A
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(managerAUser)
        return jest.fn() // unsubscribe function
      })

      // Mock API to return Project X for Manager A
      listProjects.mockResolvedValueOnce([
        {
          id: 'projectX',
          name: 'Project X',
          status: 'doing',
          dueDate: '2025-12-31',
          tasks: [
            { id: 'task1', status: 'completed' },
            { id: 'task2', status: 'todo' }
          ],
          assignedUsers: ['managerA123']
        }
      ])

      render(<AnalyticsPage />)

      // Wait for projects to load
      await waitFor(() => {
        expect(listProjects).toHaveBeenCalledWith({ assignedTo: 'managerA123' })
      })

      // Verify Manager A can see the analytics dashboard
      await waitFor(() => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
      })

      // Verify the Total Projects displays 1
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
      // The number is in a div with class "text-2xl font-bold" next to Total Projects
      const cards = screen.getByText('Total Projects').closest('.border')
      expect(cards).toHaveTextContent('1')
      
      // Verify project status counts are displayed correctly
      expect(screen.getByText('1 in progress, 0 completed')).toBeInTheDocument()
    })

    it('should not show Project X analytics to Manager B when not assigned to Project X', async () => {
      // Setup Manager B (NOT assigned to Project X)
      const managerBUser = { uid: 'managerB123', email: 'managerb@example.com' }
      
      // Mock auth state for Manager B
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(managerBUser)
        return jest.fn() // unsubscribe function
      })

      // Mock API to return empty array for Manager B (no access to Project X)
      listProjects.mockResolvedValueOnce([])

      render(<AnalyticsPage />)

      // Wait for projects to load
      await waitFor(() => {
        expect(listProjects).toHaveBeenCalledWith({ assignedTo: 'managerB123' })
      })

      // Verify Manager B can access the analytics page but sees no projects
      await waitFor(() => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
      })

      // Verify the Total Projects displays 0
      const totalProjectsCard = screen.getByText('Total Projects').closest('.border')
      expect(totalProjectsCard).toHaveTextContent('0')
      
      // Verify project status counts show 0 for all
      expect(screen.getByText('0 in progress, 0 completed')).toBeInTheDocument()
      
      // Verify Total Tasks also shows 0
      const totalTasksCard = screen.getByText('Total Tasks').closest('.border')
      expect(totalTasksCard).toHaveTextContent('0')
      expect(screen.getByText('0 completed')).toBeInTheDocument()
    })
  })
})
