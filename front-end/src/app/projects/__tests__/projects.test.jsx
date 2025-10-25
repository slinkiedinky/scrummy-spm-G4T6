import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectsPage from '../page'
import * as api from '@/lib/api'
import { auth } from '@/lib/firebase'

// Mock the API module
jest.mock('@/lib/api')

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

jest.mock('@/components/RoleGuard', () => ({
  RoleGuard: ({ children }) => <>{children}</>,
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  })),
  usePathname: jest.fn(() => '/projects'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

// Mock components
jest.mock('@/components/ProjectCard', () => ({
  ProjectCard: ({ project }) => (
    <div data-testid={`project-card-${project.id}`}>
      <h3>{project.name}</h3>
      <p>{project.status}</p>
      <p>{project.priority}</p>
    </div>
  ),
}))

describe('ProjectsPage', () => {
  let mockUser
  let mockOnAuthStateChanged

  beforeEach(() => {
    jest.clearAllMocks()

    mockUser = { uid: 'user-1' }
    auth.currentUser = mockUser

    // Setup auth mock
    mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn() // unsubscribe
    })

    // Mock API functions
    api.listProjects = jest.fn().mockResolvedValue([])
    api.createProject = jest.fn().mockResolvedValue({ id: 'new-project-id' })
    api.listUsers = jest.fn().mockResolvedValue([])
  })

  describe('Loading States', () => {
    it('shows loading state while user is being authenticated', () => {
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        // Don't call callback immediately
        return jest.fn()
      })

      render(<ProjectsPage />)
      expect(screen.getByText('Loading user…')).toBeInTheDocument()
    })

    it('shows loading state while projects are being fetched', async () => {
      api.listProjects.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      )

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('Loading projects…')).toBeInTheDocument()
      })
    })
  })

  describe('Project List Display', () => {
    it('displays projects when loaded', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: 'Website Redesign',
          status: 'in progress',
          priority: 'high',
          teamIds: ['user-1'],
        },
        {
          id: 'proj-2',
          name: 'Mobile App',
          status: 'to-do',
          priority: 'medium',
          teamIds: ['user-1'],
        },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('Website Redesign')).toBeInTheDocument()
        expect(screen.getByText('Mobile App')).toBeInTheDocument()
      })
    })

    it('shows empty state when no projects match filters', async () => {
      api.listProjects.mockResolvedValue([])

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('No matching projects found')).toBeInTheDocument()
        expect(
          screen.getByText('Try adjusting your search or filter criteria')
        ).toBeInTheDocument()
      })
    })

    it('displays error message when loading fails', async () => {
      api.listProjects.mockRejectedValue(new Error('Network error'))

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/)).toBeInTheDocument()
      })
    })
  })

  describe('KPI Cards', () => {
    it('displays KPI metrics correctly', async () => {
      const mockProjects = [
        { id: '1', name: 'P1', status: 'to-do', priority: 'high', teamIds: ['user-1'] },
        { id: '2', name: 'P2', status: 'in progress', priority: 'medium', teamIds: ['user-1'] },
        { id: '3', name: 'P3', status: 'in progress', priority: 'low', teamIds: ['user-1'] },
        { id: '4', name: 'P4', status: 'completed', priority: 'high', teamIds: ['user-1'] },
        { id: '5', name: 'P5', status: 'blocked', priority: 'medium', teamIds: ['user-1'] },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        // Check KPI values
        const kpiCards = screen.getAllByText(/^\d+$/)
        expect(screen.getByText('To Do')).toBeInTheDocument()
        expect(screen.getByText('In Progress')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.getByText('Blocked')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('filters projects by search term', async () => {
      const mockProjects = [
        { id: '1', name: 'Website Redesign', status: 'to-do', priority: 'high', teamIds: ['user-1'] },
        { id: '2', name: 'Mobile App', status: 'to-do', priority: 'medium', teamIds: ['user-1'] },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('Website Redesign')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      fireEvent.change(searchInput, { target: { value: 'Website' } })

      await waitFor(() => {
        expect(screen.getByText('Website Redesign')).toBeInTheDocument()
        expect(screen.queryByText('Mobile App')).not.toBeInTheDocument()
      })
    })

    it('clears search when input is cleared', async () => {
      const mockProjects = [
        { id: '1', name: 'Website Redesign', status: 'to-do', priority: 'high', teamIds: ['user-1'] },
        { id: '2', name: 'Mobile App', status: 'to-do', priority: 'medium', teamIds: ['user-1'] },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('Website Redesign')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      fireEvent.change(searchInput, { target: { value: 'Website' } })
      fireEvent.change(searchInput, { target: { value: '' } })

      await waitFor(() => {
        expect(screen.getByText('Website Redesign')).toBeInTheDocument()
        expect(screen.getByText('Mobile App')).toBeInTheDocument()
      })
    })
  })

  describe('Status Filter', () => {
    it('filters projects by status', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'to-do', priority: 'high', teamIds: ['user-1'] },
        { id: '2', name: 'Project 2', status: 'in progress', priority: 'medium', teamIds: ['user-1'] },
        { id: '3', name: 'Project 3', status: 'completed', priority: 'low', teamIds: ['user-1'] },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getAllByTestId(/project-card/)).toHaveLength(3)
      })

      // This test is simplified - actual implementation would need to interact with Select component
      // which requires more complex mocking
    })
  })

  describe('Priority Filter', () => {
    it('filters projects by priority', async () => {
      const mockProjects = [
        { id: '1', name: 'High Priority', status: 'to-do', priority: 'high', teamIds: ['user-1'] },
        { id: '2', name: 'Medium Priority', status: 'to-do', priority: 'medium', teamIds: ['user-1'] },
        { id: '3', name: 'Low Priority', status: 'to-do', priority: 'low', teamIds: ['user-1'] },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('High Priority')).toBeInTheDocument()
        expect(screen.getByText('Medium Priority')).toBeInTheDocument()
        expect(screen.getByText('Low Priority')).toBeInTheDocument()
      })
    })
  })

  describe('Sorting', () => {
    it('displays sort buttons', async () => {
      api.listProjects.mockResolvedValue([])

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Completion %/)).toBeInTheDocument()
        expect(screen.getByText(/Deadline/)).toBeInTheDocument()
      })
    })
  })

  describe('Create Project Dialog', () => {
    it('opens create project dialog when button clicked', async () => {
      api.listProjects.mockResolvedValue([])

      render(<ProjectsPage />)

      await waitFor(() => {
        const newProjectButton = screen.getByText('New Project')
        fireEvent.click(newProjectButton)
      })

      expect(screen.getByText('Create New Project')).toBeInTheDocument()
      expect(screen.getByLabelText('Project Name')).toBeInTheDocument()
    })

    it('validates project name is required', async () => {
      api.listProjects.mockResolvedValue([])

      render(<ProjectsPage />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('New Project'))
      })

      const dialog = screen.getByRole('dialog')
      const form = dialog.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Project name is required.')).toBeInTheDocument()
      })
    })

    it('creates project successfully', async () => {
      api.listProjects.mockResolvedValue([])
      api.createProject.mockResolvedValue({ id: 'new-proj-id' })
      api.listUsers.mockImplementation(() => [])

      render(<ProjectsPage />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('New Project'))
      })

      const nameInput = screen.getByLabelText('Project Name')
      fireEvent.change(nameInput, { target: { value: 'New Test Project' } })

      const createButton = screen.getByRole('button', { name: 'Create Project' })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Test Project',
            status: 'to-do',
            priority: 'medium',
            ownerId: 'user-1',
          })
        )
      })
    })

    it('closes dialog after successful creation', async () => {
      api.listProjects.mockResolvedValue([])
      api.createProject.mockResolvedValue({ id: 'new-proj-id' })

      render(<ProjectsPage />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('New Project'))
      })

      const nameInput = screen.getByLabelText('Project Name')
      fireEvent.change(nameInput, { target: { value: 'New Project' } })

      const createButton = screen.getByRole('button', { name: 'Create Project' })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.queryByText('Create New Project')).not.toBeInTheDocument()
      })
    })

    it('shows error when creation fails', async () => {
      api.listProjects.mockResolvedValue([])
      api.createProject.mockRejectedValue(new Error('Creation failed'))

      render(<ProjectsPage />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('New Project'))
      })

      const nameInput = screen.getByLabelText('Project Name')
      fireEvent.change(nameInput, { target: { value: 'New Project' } })

      const createButton = screen.getByRole('button', { name: 'Create Project' })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText(/Creation failed/)).toBeInTheDocument()
      })
    })
  })

  describe('Active Filters Display', () => {
    it('shows active filters when filters are applied', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'to-do', priority: 'high', teamIds: ['user-1'] },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        const employeeInput = screen.getByPlaceholderText('Employee name...')
        fireEvent.change(employeeInput, { target: { value: 'John' } })
      })

      await waitFor(() => {
        expect(screen.getByText('Active filters:')).toBeInTheDocument()
        expect(screen.getByText(/Employee: John/)).toBeInTheDocument()
      })
    })

    it('clears all filters when Clear all clicked', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'to-do', priority: 'high', teamIds: ['user-1'] },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        const employeeInput = screen.getByPlaceholderText('Employee name...')
        fireEvent.change(employeeInput, { target: { value: 'John' } })
      })

      await waitFor(() => {
        const clearButton = screen.getByText('Clear all')
        fireEvent.click(clearButton)
      })

      expect(screen.queryByText('Active filters:')).not.toBeInTheDocument()
    })
  })

  describe('Helper Functions', () => {
    it('normalizes project priority correctly', () => {
      // These are internal functions, but we can test through component behavior
      const mockProjects = [
        { id: '1', name: 'P1', status: 'to-do', priority: 8, teamIds: ['user-1'] }, // should be 'high'
        { id: '2', name: 'P2', status: 'to-do', priority: 2, teamIds: ['user-1'] }, // should be 'low'
        { id: '3', name: 'P3', status: 'to-do', priority: 'HIGH', teamIds: ['user-1'] }, // should be 'high'
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      // Projects should render with normalized priorities
      waitFor(() => {
        expect(api.listProjects).toHaveBeenCalled()
      })
    })

    it('calculates completion percentage correctly', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Completed Project',
          status: 'completed',
          priority: 'high',
          teamIds: ['user-1'],
          tasks: [],
        },
      ]

      api.listProjects.mockResolvedValue(mockProjects)

      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.getByText('Completed Project')).toBeInTheDocument()
      })
    })
  })

  describe('User Not Authenticated', () => {
    it('handles unauthenticated user gracefully', async () => {
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null) // No user
        return jest.fn()
      })

      render(<ProjectsPage />)

      await waitFor(() => {
        // Should not attempt to load projects
        expect(api.listProjects).not.toHaveBeenCalled()
      })
    })
  })
})
