import { renderHook, waitFor } from '@testing-library/react'
import useUsers from '@/hooks/useUsers'

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({
  db: {},
}))

const { getDocs } = require('firebase/firestore')

describe('useUsers Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches users successfully', async () => {
    const mockUsers = [
      { id: '1', fullName: 'User 1', email: 'user1@example.com' },
      { id: '2', fullName: 'User 2', email: 'user2@example.com' },
    ]

    getDocs.mockResolvedValueOnce({
      docs: mockUsers.map(user => ({
        id: user.id,
        data: () => ({ fullName: user.fullName, email: user.email }),
      })),
    })

    const { result } = renderHook(() => useUsers())

    // Initially loading
    expect(result.current.loading).toBe(true)
    expect(result.current.users).toEqual([])

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.users).toHaveLength(2)
  })

  it('handles fetch errors', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    getDocs.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useUsers())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(result.current.users).toEqual([])

    consoleErrorSpy.mockRestore()
  })

  it('handles empty response', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [],
    })

    const { result } = renderHook(() => useUsers())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.users).toEqual([])
  })
})
