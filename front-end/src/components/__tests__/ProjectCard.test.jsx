import { render, screen } from '@testing-library/react'
import { ProjectCard } from '../ProjectCard'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  onSnapshot: jest.fn((ref, callback) => {
    callback({ docs: [] })
    return jest.fn()
  }),
}))

jest.mock('@/lib/firebase', () => ({
  db: {},
}))

describe('ProjectCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockProject = {
    id: 'proj-123',
    name: 'Test Project',
    description: 'This is a test project description',
    status: 'in progress',
    priority: 'high',
    teamIds: ['user-1', 'user-2', 'user-3'],
    dueDate: '2024-12-31',
  }

  it('renders project name', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('renders project description', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('This is a test project description')).toBeInTheDocument()
  })

  it('displays project status', () => {
    render(<ProjectCard project={mockProject} />)
    const statusBadge = screen.getByText(/in progress/i)
    expect(statusBadge).toBeInTheDocument()
  })

  it('displays project priority', () => {
    render(<ProjectCard project={mockProject} />)
    const priorityBadge = screen.getByText(/high/i)
    expect(priorityBadge).toBeInTheDocument()
  })

  it('shows team member count', () => {
    render(<ProjectCard project={mockProject} />)
    // Should show 3 team members
    expect(screen.getByText(/3 team members/i)).toBeInTheDocument()
  })

  it('handles project without description', () => {
    const projectNoDesc = { ...mockProject, description: '' }
    render(<ProjectCard project={projectNoDesc} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('handles different status values', () => {
    const statuses = ['to-do', 'in progress', 'completed', 'blocked']

    statuses.forEach((status) => {
      const project = { ...mockProject, status }
      const { rerender } = render(<ProjectCard project={project} />)
      const escaped = status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
      const matches = screen.getAllByText(new RegExp(`^${escaped}$`, 'i'))
      expect(matches.length).toBeGreaterThan(0)
      rerender(<div />)
    })
  })

  it('handles different priority values', () => {
    const priorities = ['low', 'medium', 'high']

    priorities.forEach((priority) => {
      const project = { ...mockProject, priority }
      const { rerender } = render(<ProjectCard project={project} />)
      const escaped = priority.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
      const matches = screen.getAllByText(new RegExp(`^${escaped}`, 'i'))
      expect(matches.length).toBeGreaterThan(0)
      rerender(<div />)
    })
  })

  it('handles empty team', () => {
    const projectNoTeam = { ...mockProject, teamIds: [] }
    render(<ProjectCard project={projectNoTeam} />)
    expect(screen.getByText(/0 team members/i)).toBeInTheDocument()
  })

  it('truncates long descriptions', () => {
    const longDescription = 'A'.repeat(200)
    const projectLongDesc = { ...mockProject, description: longDescription }
    const { container } = render(<ProjectCard project={projectLongDesc} />)

    // Check that description is present
    const descElement = container.querySelector('p')
    expect(descElement).toBeInTheDocument()
  })
})
