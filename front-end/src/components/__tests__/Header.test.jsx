import { render, screen } from '@testing-library/react'
import Header from '../Header'

// Mock the LogoutButton component
jest.mock('../LogoutButton', () => {
  return function MockLogoutButton() {
    return <button>Logout</button>
  }
})

describe('Header Component', () => {
  const mockUserData = {
    fullName: 'John Doe',
    role: 'Developer',
  }

  it('renders the header with title', () => {
    render(<Header title="Dashboard" userData={mockUserData} />)

    const heading = screen.getByText('Dashboard')
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('text-xl', 'font-semibold')
  })

  it('displays user full name', () => {
    render(<Header title="Projects" userData={mockUserData} />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('displays user role', () => {
    render(<Header title="Tasks" userData={mockUserData} />)

    expect(screen.getByText('Developer')).toBeInTheDocument()
  })

  it('renders logout button', () => {
    render(<Header title="Home" userData={mockUserData} />)

    const logoutButton = screen.getByText('Logout')
    expect(logoutButton).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(<Header title="Test" userData={mockUserData} />)

    const header = container.querySelector('header')
    expect(header).toHaveClass('bg-gray-800', 'shadow-md', 'sticky', 'top-0')
  })

  it('renders with different titles', () => {
    const { rerender } = render(<Header title="First Title" userData={mockUserData} />)
    expect(screen.getByText('First Title')).toBeInTheDocument()

    rerender(<Header title="Second Title" userData={mockUserData} />)
    expect(screen.getByText('Second Title')).toBeInTheDocument()
    expect(screen.queryByText('First Title')).not.toBeInTheDocument()
  })

  it('handles different user roles', () => {
    const adminUser = { fullName: 'Admin User', role: 'Administrator' }
    render(<Header title="Admin Panel" userData={adminUser} />)

    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('Admin User')).toBeInTheDocument()
  })

  it('displays user info with correct styling', () => {
    render(<Header title="Test" userData={mockUserData} />)

    const fullName = screen.getByText('John Doe')
    expect(fullName.parentElement).toHaveClass('text-amber-300')

    const role = screen.getByText('Developer')
    expect(role).toHaveClass('text-gray-300', 'font-bold', 'text-xs')
  })
})
