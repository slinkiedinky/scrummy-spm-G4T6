import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import LayoutWrapper from '../LayoutWrapper'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

// Mock child components
jest.mock('../AuthGuard', () => {
  return function MockAuthGuard({ children }) {
    return <div data-testid="auth-guard">{children}</div>
  }
})

jest.mock('../Sidebar', () => ({
  Sidebar: function MockSidebar() {
    return <aside data-testid="sidebar">Sidebar</aside>
  },
}))

describe('LayoutWrapper Component', () => {
  const mockChildren = <div data-testid="child-content">Test Content</div>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Login page behavior', () => {
    it('renders only children without sidebar or auth guard on login page', () => {
      usePathname.mockReturnValue('/')

      render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument()
      expect(screen.queryByTestId('auth-guard')).not.toBeInTheDocument()
    })

    it('wraps children in main tag on login page', () => {
      usePathname.mockReturnValue('/')

      const { container } = render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
      expect(main).toContainElement(screen.getByTestId('child-content'))
    })
  })

  describe('Protected pages behavior', () => {
    it('renders with AuthGuard and Sidebar on non-login pages', () => {
      usePathname.mockReturnValue('/dashboard')

      render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.getByTestId('auth-guard')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    it('applies correct layout classes on protected pages', () => {
      usePathname.mockReturnValue('/projects')

      const { container } = render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      const layoutDiv = container.querySelector('.flex.h-screen.bg-background')
      expect(layoutDiv).toBeInTheDocument()

      const main = container.querySelector('main.flex-1.overflow-hidden')
      expect(main).toBeInTheDocument()
    })

    it('renders correctly on tasks page', () => {
      usePathname.mockReturnValue('/tasks')

      render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.getByTestId('auth-guard')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })

    it('renders correctly on projects page', () => {
      usePathname.mockReturnValue('/projects')

      render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.getByTestId('auth-guard')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })

    it('renders correctly on analytics page', () => {
      usePathname.mockReturnValue('/analytics')

      render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.getByTestId('auth-guard')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })
  })

  describe('Dynamic page switching', () => {
    it('changes layout when navigating from login to protected page', () => {
      usePathname.mockReturnValue('/')

      const { rerender } = render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument()

      usePathname.mockReturnValue('/dashboard')
      rerender(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('auth-guard')).toBeInTheDocument()
    })

    it('changes layout when navigating from protected page to login', () => {
      usePathname.mockReturnValue('/dashboard')

      const { rerender } = render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.getByTestId('sidebar')).toBeInTheDocument()

      usePathname.mockReturnValue('/')
      rerender(<LayoutWrapper>{mockChildren}</LayoutWrapper>)

      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument()
      expect(screen.queryByTestId('auth-guard')).not.toBeInTheDocument()
    })
  })

  describe('Children rendering', () => {
    it('preserves children content on all pages', () => {
      usePathname.mockReturnValue('/')
      const { rerender } = render(<LayoutWrapper>{mockChildren}</LayoutWrapper>)
      expect(screen.getByTestId('child-content')).toHaveTextContent('Test Content')

      usePathname.mockReturnValue('/projects')
      rerender(<LayoutWrapper>{mockChildren}</LayoutWrapper>)
      expect(screen.getByTestId('child-content')).toHaveTextContent('Test Content')
    })

    it('renders multiple children correctly', () => {
      usePathname.mockReturnValue('/projects')

      const multipleChildren = (
        <>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </>
      )

      render(<LayoutWrapper>{multipleChildren}</LayoutWrapper>)

      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
    })
  })
})
