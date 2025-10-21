import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import LogoutButton from '../LogoutButton'

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  signOut: jest.fn(),
}))

// Mock Firebase config
jest.mock('@/lib/firebase', () => ({
  auth: {},
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

describe('LogoutButton Component', () => {
  let mockPush
  let mockReplace

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Setup router mocks
    mockPush = jest.fn()
    mockReplace = jest.fn()

    useRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    })
  })

  it('renders logout button', () => {
    render(<LogoutButton />)

    const button = screen.getByRole('button', { name: /logout/i })
    expect(button).toBeInTheDocument()
  })

  it('has correct styling classes', () => {
    render(<LogoutButton />)

    const button = screen.getByRole('button', { name: /logout/i })
    expect(button).toHaveClass(
      'px-4',
      'py-2',
      'bg-gray-100',
      'text-gray-800',
      'rounded-md',
      'font-medium',
      'hover:bg-gray-200'
    )
  })

  it('calls signOut when clicked', async () => {
    signOut.mockResolvedValue()

    render(<LogoutButton />)

    const button = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
    })
  })

  it('redirects to home page after successful logout', async () => {
    signOut.mockResolvedValue()

    render(<LogoutButton />)

    const button = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  it('handles logout errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const mockError = new Error('Logout failed')
    signOut.mockRejectedValue(mockError)

    render(<LogoutButton />)

    const button = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout failed:', mockError)
    })

    // Should not redirect on error
    expect(mockReplace).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('is clickable and interactive', () => {
    render(<LogoutButton />)

    const button = screen.getByRole('button', { name: /logout/i })
    expect(button).toBeEnabled()
  })
})
