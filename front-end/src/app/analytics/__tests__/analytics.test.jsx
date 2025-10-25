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
  const mockUser = { uid: 'user-123' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders the analytics dashboard header', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue([])

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    })
  })

  it('displays loading state initially', () => {
    onAuthStateChanged.mockImplementation(() => jest.fn())
    render(<AnalyticsPage />)
    
    // The component should render without crashing during loading
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
  })

  it('displays total projects count correctly', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1', status: 'to-do', tasks: [] },
      { id: '2', name: 'Project 2', status: 'doing', tasks: [] },
      { id: '3', name: 'Project 3', status: 'done', tasks: [] },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('calculates status distribution correctly', async () => {
    const mockProjects = [
      { id: '1', status: 'to-do', tasks: [] },
      { id: '2', status: 'doing', tasks: [] },
      { id: '3', status: 'doing', tasks: [] },
      { id: '4', status: 'done', tasks: [] },
      { id: '5', status: 'blocked', tasks: [] },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      // Check all percentages exist
      const percentages = screen.getAllByText(/\d+%/)
      expect(percentages.length).toBeGreaterThan(0)
      // 1 to-do = 20%, 2 in progress = 40%, 1 completed = 20%, 1 blocked = 20%
      expect(screen.getAllByText('20%').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('40%').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('calculates total tasks correctly', async () => {
    const mockProjects = [
      {
        id: '1',
        status: 'to-do',
        tasks: [
          { id: 't1', status: 'to-do' },
          { id: 't2', status: 'completed' },
        ],
      },
      {
        id: '2',
        status: 'doing',
        tasks: [
          { id: 't3', status: 'completed' },
          { id: 't4', status: 'in progress' },
          { id: 't5', status: 'completed' },
        ],
      },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      // Should show 5 total tasks
      expect(screen.getByText('5')).toBeInTheDocument()
      // Should show 3 completed tasks
      expect(screen.getByText('3 completed')).toBeInTheDocument()
    })
  })

  it('calculates average progress correctly', async () => {
    const mockProjects = [
      {
        id: '1',
        status: 'to-do',
        tasks: [
          { id: 't1', status: 'to-do' },
          { id: 't2', status: 'completed' },
        ], // 50% progress
      },
      {
        id: '2',
        status: 'doing',
        tasks: [
          { id: 't3', status: 'completed' },
          { id: 't4', status: 'completed' },
        ], // 100% progress
      },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      // Average should be (50 + 100) / 2 = 75%
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })

  it('identifies overdue projects correctly', async () => {
    const pastDate = new Date('2020-01-01').toISOString()
    const futureDate = new Date('2030-01-01').toISOString()

    const mockProjects = [
      {
        id: '1',
        status: 'doing',
        dueDate: pastDate,
        tasks: [],
      },
      {
        id: '2',
        status: 'to-do',
        dueDate: pastDate,
        tasks: [],
      },
      {
        id: '3',
        status: 'done',
        dueDate: pastDate,
        tasks: [],
      }, // Should not count (completed)
      {
        id: '4',
        status: 'doing',
        dueDate: futureDate,
        tasks: [],
      }, // Should not count (not past due)
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Overdue Projects')).toBeInTheDocument()
      expect(screen.getByText('2 projects past due date')).toBeInTheDocument()
    })
  })

  it('handles projects without tasks', async () => {
    const mockProjects = [
      { id: '1', status: 'to-do' }, // No tasks property
      { id: '2', status: 'doing', tasks: null }, // Null tasks
      { id: '3', status: 'done', tasks: [] }, // Empty tasks
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      // Should not crash and show 0 tasks and 0 completed
      expect(screen.getByText('Total Tasks')).toBeInTheDocument()
      expect(screen.getByText('0 completed')).toBeInTheDocument()
    })
  })

  it('normalizes backend status values', async () => {
    const mockProjects = [
      { id: '1', status: 'doing', tasks: [] }, // Should become "in progress"
      { id: '2', status: 'done', tasks: [] }, // Should become "completed"
      { id: '3', status: 'todo', tasks: [] }, // Should become "to-do"
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      // Check that status distribution shows normalized values
      expect(screen.getByText('To Do')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })
  })

  it('displays completion rate correctly', async () => {
    const mockProjects = [
      {
        id: '1',
        status: 'doing',
        tasks: [
          { id: 't1', status: 'completed' },
          { id: 't2', status: 'completed' },
          { id: 't3', status: 'in progress' },
          { id: 't4', status: 'to-do' },
        ], // 2/4 = 50%
      },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('50% of tasks completed')).toBeInTheDocument()
    })
  })

  it('shows active projects count', async () => {
    const mockProjects = [
      { id: '1', status: 'doing', tasks: [] },
      { id: '2', status: 'doing', tasks: [] },
      { id: '3', status: 'to-do', tasks: [] },
      { id: '4', status: 'done', tasks: [] },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Active Projects')).toBeInTheDocument()
      expect(screen.getByText('2 projects in progress')).toBeInTheDocument()
    })
  })

  it('handles user logout', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null) // No user
      return jest.fn()
    })

    render(<AnalyticsPage />)

    await waitFor(() => {
      // Should show zero metrics when logged out
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBeGreaterThan(0)
    })

    expect(listProjects).not.toHaveBeenCalled()
  })

  it('handles API errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockRejectedValue(new Error('API Error'))

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching projects:',
        expect.any(Error)
      )
    })

    consoleErrorSpy.mockRestore()
  })

  it('cleans up auth listener on unmount', async () => {
    const unsubscribeMock = jest.fn()

    onAuthStateChanged.mockImplementation(() => unsubscribeMock)

    const { unmount } = render(<AnalyticsPage />)

    unmount()

    expect(unsubscribeMock).toHaveBeenCalled()
  })

  it('handles zero projects without division errors', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue([])

    render(<AnalyticsPage />)

    await waitFor(() => {
      // Should show 0% for percentages
      const percentages = screen.getAllByText(/0%/)
      expect(percentages.length).toBeGreaterThan(0)
    })
  })

  it('does not show overdue alert when no projects are overdue', async () => {
    const futureDate = new Date('2030-01-01').toISOString()

    const mockProjects = [
      {
        id: '1',
        status: 'doing',
        dueDate: futureDate,
        tasks: [],
      },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Overdue Projects')).not.toBeInTheDocument()
    })
  })

  it('renders all key metric cards', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue([])

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
      expect(screen.getByText('Average Progress')).toBeInTheDocument()
      expect(screen.getByText('Total Tasks')).toBeInTheDocument()
    })
  })

  it('renders all status distribution items', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue([])

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Blocked')).toBeInTheDocument()
    })
  })

  it('handles singular overdue project text', async () => {
    const pastDate = new Date('2020-01-01').toISOString()

    const mockProjects = [
      {
        id: '1',
        status: 'doing',
        dueDate: pastDate,
        tasks: [],
      },
    ]

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn()
    })

    listProjects.mockResolvedValue(mockProjects)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('1 project past due date')).toBeInTheDocument()
    })
  })
})
