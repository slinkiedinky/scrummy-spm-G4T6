import { render, screen } from '@testing-library/react'
import { ProjectHeader } from '../ProjectHeader'

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }) => <span className={className} data-testid="badge">{children}</span>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }) => (
    <div className={className} data-testid="progress" data-value={value}></div>
  ),
}))

jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }) => <div className={className} data-testid="avatar">{children}</div>,
  AvatarImage: ({ src, alt }) => <img src={src} alt={alt} data-testid="avatar-image" />,
  AvatarFallback: ({ children }) => <div data-testid="avatar-fallback">{children}</div>,
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Calendar: () => <span data-testid="calendar-icon">Calendar</span>,
  Users: () => <span data-testid="users-icon">Users</span>,
  DollarSign: () => <span data-testid="dollar-icon">Dollar</span>,
  Settings: () => <span data-testid="settings-icon">Settings</span>,
  Share: () => <span data-testid="share-icon">Share</span>,
}))

describe('ProjectHeader Component', () => {
  const mockProject = {
    name: 'Test Project',
    description: 'This is a test project description',
    status: 'in progress',
    priority: 'high',
    dueDate: '2025-12-31',
    progress: 65,
    team: [
      { id: '1', name: 'John Doe', role: 'Developer', avatar: null },
      { id: '2', name: 'Jane Smith', role: 'Designer', avatar: '/avatar.jpg' },
    ],
    budget: 50000,
    client: 'Acme Corp',
  }

  it('renders project name', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('renders project description', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('This is a test project description')).toBeInTheDocument()
  })

  it('displays project status', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('displays priority badge', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('High Priority')).toBeInTheDocument()
  })

  it('formats and displays due date correctly', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('December 31, 2025')).toBeInTheDocument()
  })

  it('displays team member count', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('2 members')).toBeInTheDocument()
  })

  it('displays budget when provided', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('$50,000')).toBeInTheDocument()
  })

  it('displays client when provided', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('displays progress percentage', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByText('65%')).toBeInTheDocument()
  })

  it('renders progress bar with correct value', () => {
    render(<ProjectHeader project={mockProject} />)
    const progress = screen.getByTestId('progress')
    expect(progress).toHaveAttribute('data-value', '65')
  })

  it('renders Share button', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })

  it('renders Settings button', () => {
    render(<ProjectHeader project={mockProject} />)
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  describe('Team members rendering', () => {
    it('renders all team members', () => {
      render(<ProjectHeader project={mockProject} />)
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('displays team member roles', () => {
      render(<ProjectHeader project={mockProject} />)
      expect(screen.getByText('Developer')).toBeInTheDocument()
      expect(screen.getByText('Designer')).toBeInTheDocument()
    })

    it('renders avatar for each team member', () => {
      render(<ProjectHeader project={mockProject} />)
      const avatars = screen.getAllByTestId('avatar')
      expect(avatars.length).toBeGreaterThan(0)
    })

    it('displays initials fallback for member without avatar', () => {
      render(<ProjectHeader project={mockProject} />)
      const fallbacks = screen.getAllByTestId('avatar-fallback')
      expect(fallbacks.some(el => el.textContent === 'JD')).toBe(true)
    })
  })

  describe('Status colors', () => {
    it('applies correct color for to-do status', () => {
      const project = { ...mockProject, status: 'to-do' }
      render(<ProjectHeader project={project} />)
      const badge = screen.getAllByTestId('badge').find(el => el.textContent === 'To do')
      expect(badge).toHaveClass('bg-blue-400')
    })

    it('applies correct color for in progress status', () => {
      const project = { ...mockProject, status: 'in progress' }
      render(<ProjectHeader project={project} />)
      const badge = screen.getAllByTestId('badge').find(el => el.textContent === 'In progress')
      expect(badge).toHaveClass('bg-yellow-300')
    })

    it('applies correct color for completed status', () => {
      const project = { ...mockProject, status: 'completed' }
      render(<ProjectHeader project={project} />)
      const badge = screen.getAllByTestId('badge').find(el => el.textContent === 'Completed')
      expect(badge).toHaveClass('bg-emerald-600')
    })

    it('applies correct color for blocked status', () => {
      const project = { ...mockProject, status: 'blocked' }
      render(<ProjectHeader project={project} />)
      const badge = screen.getAllByTestId('badge').find(el => el.textContent === 'Blocked')
      expect(badge).toHaveClass('bg-red-500')
    })
  })

  describe('Priority handling', () => {
    it('handles low priority string', () => {
      const project = { ...mockProject, priority: 'low' }
      render(<ProjectHeader project={project} />)
      expect(screen.getByText('Low Priority')).toBeInTheDocument()
    })

    it('handles medium priority string', () => {
      const project = { ...mockProject, priority: 'medium' }
      render(<ProjectHeader project={project} />)
      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    })

    it('handles numeric priority - high (8+)', () => {
      const project = { ...mockProject, priority: 9 }
      render(<ProjectHeader project={project} />)
      expect(screen.getByText('High Priority')).toBeInTheDocument()
    })

    it('handles numeric priority - low (<=3)', () => {
      const project = { ...mockProject, priority: 2 }
      render(<ProjectHeader project={project} />)
      expect(screen.getByText('Low Priority')).toBeInTheDocument()
    })

    it('handles numeric priority - medium (4-7)', () => {
      const project = { ...mockProject, priority: 5 }
      render(<ProjectHeader project={project} />)
      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    })
  })

  describe('Overdue detection', () => {
    it('highlights overdue date when project is past due and not completed', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)
      const project = { ...mockProject, dueDate: pastDate.toISOString(), status: 'in progress' }

      const { container } = render(<ProjectHeader project={project} />)
      const dueDateElement = container.querySelector('.text-destructive')
      expect(dueDateElement).toBeInTheDocument()
    })

    it('does not highlight overdue date when project is completed', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)
      const project = { ...mockProject, dueDate: pastDate.toISOString(), status: 'completed' }

      const { container } = render(<ProjectHeader project={project} />)
      // Should not have text-destructive class on the date
      const allDestructive = container.querySelectorAll('.text-destructive')
      const hasOverdueDate = Array.from(allDestructive).some(el =>
        el.textContent.includes(new Date(pastDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
      )
      expect(hasOverdueDate).toBe(false)
    })
  })

  describe('Optional fields', () => {
    it('does not render budget section when budget is not provided', () => {
      const project = { ...mockProject, budget: undefined }
      render(<ProjectHeader project={project} />)
      expect(screen.queryByTestId('dollar-icon')).not.toBeInTheDocument()
    })

    it('does not render client section when client is not provided', () => {
      const project = { ...mockProject, client: undefined }
      const { container } = render(<ProjectHeader project={project} />)
      expect(container.textContent).not.toContain('Client:')
    })
  })

  describe('Empty team handling', () => {
    it('shows 0 members when team is empty', () => {
      const project = { ...mockProject, team: [] }
      render(<ProjectHeader project={project} />)
      expect(screen.getByText('0 members')).toBeInTheDocument()
    })

    it('renders team members section even when empty', () => {
      const project = { ...mockProject, team: [] }
      render(<ProjectHeader project={project} />)
      expect(screen.getByText('Team Members')).toBeInTheDocument()
    })
  })
})
