import { render, screen, waitFor } from '@testing-library/react'
import { ProjectDetailView } from '../ProjectDetailedView'

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }) => <a href={href}>{children}</a>,
}))

// Mock child components
jest.mock('../TaskBoard', () => ({
  TaskBoard: ({ project }) => <div data-testid="task-board">TaskBoard: {project?.name}</div>,
}))

jest.mock('../ProjectHeader', () => ({
  ProjectHeader: ({ project }) => <div data-testid="project-header">ProjectHeader: {project?.name}</div>,
}))

jest.mock('../ProjectOverview', () => ({
  ProjectOverview: ({ project }) => <div data-testid="project-overview">ProjectOverview: {project?.name}</div>,
}))

jest.mock('../ProjectTeamView', () => ({
  ProjectTeamView: ({ project }) => <div data-testid="project-team-view">ProjectTeamView: {project?.name}</div>,
}))

// Mock UI components
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }) => <div data-testid="tabs" data-default={defaultValue}>{children}</div>,
  TabsList: ({ children }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }) => <button data-testid={`tab-${value}`}>{children}</button>,
  TabsContent: ({ children, value }) => <div data-testid={`tab-content-${value}`}>{children}</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }) => (
    <button onClick={onClick} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span>ArrowLeft</span>,
}))

// Mock fetch
global.fetch = jest.fn()

describe('ProjectDetailView Component', () => {
  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test Description',
    status: 'active',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch.mockReset()
  })

  describe('Loading state', () => {
    it('shows loading message while fetching project', () => {
      global.fetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<ProjectDetailView projectId="project-1" />)

      expect(screen.getByText('Loading project…')).toBeInTheDocument()
    })

    it('applies correct styles to loading state', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}))

      const { container } = render(<ProjectDetailView projectId="project-1" />)

      const loadingDiv = screen.getByText('Loading project…')
      expect(loadingDiv).toHaveClass('flex-1', 'grid', 'place-items-center')
    })
  })

  describe('Error state', () => {
    it('shows error message when fetch fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Project Not Found')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows error when response is not ok', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      render(<ProjectDetailView projectId="project-123" />)

      await waitFor(() => {
        expect(screen.getByText('Project Not Found')).toBeInTheDocument()
        expect(screen.getByText('Project project-123 not found')).toBeInTheDocument()
      })
    })

    it('shows default error message when project is null', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })

      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Project Not Found')).toBeInTheDocument()
        expect(screen.getByText("The project you're looking for doesn't exist.")).toBeInTheDocument()
      })
    })

    it('renders Back to Dashboard button in error state', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Error'))

      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        const backButton = screen.getByText('Back to Dashboard')
        expect(backButton).toBeInTheDocument()
      })
    })

    it('Back to Dashboard link points to correct URL in error state', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Error'))

      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        const link = screen.getByText('Back to Dashboard').closest('a')
        expect(link).toHaveAttribute('href', '/')
      })
    })
  })

  describe('Success state', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProject,
      })
    })

    it('renders project successfully', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('project-header')).toBeInTheDocument()
      })
    })

    it('fetches project with correct URL', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http:localhost:5000/api/projects/project-1',
          { cache: 'no-store' }
        )
      })
    })

    it('renders ProjectHeader with project data', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('ProjectHeader: Test Project')).toBeInTheDocument()
      })
    })

    it('renders Back to Dashboard button in header', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        const buttons = screen.getAllByText('Back to Dashboard')
        expect(buttons[0]).toBeInTheDocument()
      })
    })

    it('renders tabs component with correct default value', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        const tabs = screen.getByTestId('tabs')
        expect(tabs).toHaveAttribute('data-default', 'tasks')
      })
    })

    it('renders all three tab triggers', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('tab-tasks')).toBeInTheDocument()
        expect(screen.getByTestId('tab-overview')).toBeInTheDocument()
        expect(screen.getByTestId('tab-team')).toBeInTheDocument()
      })
    })

    it('renders tab triggers with correct labels', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument()
        expect(screen.getByText('Overview')).toBeInTheDocument()
        expect(screen.getByText('Team')).toBeInTheDocument()
      })
    })

    it('renders TaskBoard in tasks tab content', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('task-board')).toBeInTheDocument()
        expect(screen.getByText('TaskBoard: Test Project')).toBeInTheDocument()
      })
    })

    it('renders ProjectOverview in overview tab content', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('project-overview')).toBeInTheDocument()
        expect(screen.getByText('ProjectOverview: Test Project')).toBeInTheDocument()
      })
    })

    it('renders ProjectTeamView in team tab content', async () => {
      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('project-team-view')).toBeInTheDocument()
        expect(screen.getByText('ProjectTeamView: Test Project')).toBeInTheDocument()
      })
    })

    it('applies correct layout classes', async () => {
      const { container } = render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        const mainDiv = container.querySelector('.flex.flex-col.h-full')
        expect(mainDiv).toBeInTheDocument()
      })
    })
  })

  describe('Project ID changes', () => {
    it('refetches project when projectId changes', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockProject,
      })

      const { rerender } = render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      rerender(<ProjectDetailView projectId="project-2" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(global.fetch).toHaveBeenLastCalledWith(
          'http:localhost:5000/api/projects/project-2',
          { cache: 'no-store' }
        )
      })
    })
  })

  describe('Error edge cases', () => {
    it('handles error without message property', async () => {
      global.fetch.mockRejectedValueOnce('String error')

      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load project')).toBeInTheDocument()
      })
    })

    it('handles error with empty message', async () => {
      global.fetch.mockRejectedValueOnce(new Error(''))

      render(<ProjectDetailView projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load project')).toBeInTheDocument()
      })
    })
  })
})
