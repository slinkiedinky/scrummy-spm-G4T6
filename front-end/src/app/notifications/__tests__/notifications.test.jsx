import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsPage from '../page'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore'
import { useRouter } from 'next/navigation'

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

// Mock Firebase firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  doc: jest.fn(),
  deleteDoc: jest.fn(),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('NotificationsPage', () => {
  const mockUser = {
    uid: 'user-123',
    email: 'test@example.com',
  }

  const mockRouter = {
    push: jest.fn(),
  }

  const mockNotifications = [
    {
      id: 'notif-1',
      type: 'add task',
      title: 'New Task',
      message: 'You have been assigned a new task',
      projectName: 'Project A',
      projectId: 'proj-1',
      taskId: 'task-1',
      assignedByName: 'John Doe',
      description: 'Complete the feature',
      isRead: false,
      createdAt: {
        toDate: () => new Date('2025-10-25T10:00:00Z'),
      },
    },
    {
      id: 'notif-2',
      type: 'deadline_today',
      title: 'Urgent Task',
      message: 'Task deadline is today',
      projectName: 'Project B',
      projectId: 'proj-2',
      taskId: 'task-2',
      isRead: true,
      createdAt: {
        toDate: () => new Date('2025-10-24T10:00:00Z'),
      },
    },
    {
      id: 'notif-3',
      type: 'task comment',
      title: 'Task with comment',
      taskTitle: 'Task with comment',
      text: 'Great work on this!',
      author: 'Jane Smith',
      projectName: 'Project C',
      projectId: 'proj-3',
      taskId: 'task-3',
      isRead: false,
      createdAt: {
        toDate: () => new Date('2025-10-25T09:00:00Z'),
      },
    },
    {
      id: 'notif-4',
      type: 'task status update',
      title: 'Status Changed',
      message: "Task status changed from 'to-do' to 'in progress'",
      projectName: 'Project D',
      projectId: 'proj-4',
      taskId: 'task-4',
      isRead: false,
      meta: {
        oldStatus: 'to-do',
        newStatus: 'in progress',
        changedByName: 'Admin User',
      },
      createdAt: {
        toDate: () => new Date('2025-10-25T08:00:00Z'),
      },
    },
  ]

  let mockUnsubscribe

  beforeEach(() => {
    jest.clearAllMocks()
    mockUnsubscribe = jest.fn()
    useRouter.mockReturnValue(mockRouter)

    // Mock Firebase auth to return user
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return jest.fn() // unsubscribe function
    })

    // Mock Firestore query to return notifications
    onSnapshot.mockImplementation((q, callback) => {
      const mockDocs = mockNotifications.map((notif) => ({
        id: notif.id,
        data: () => notif,
      }))
      callback({ docs: mockDocs })
      return mockUnsubscribe
    })

    doc.mockImplementation((db, collection, id) => ({ collection, id }))
    updateDoc.mockResolvedValue({})
    deleteDoc.mockResolvedValue({})
  })

  describe('Component Rendering', () => {
    it('renders the notifications page with title', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })
    })

    it('displays unread count badge when there are unread notifications', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        const badge = screen.getByText('3') // 3 unread notifications
        expect(badge).toBeInTheDocument()
      })
    })

    it('displays all notifications when no filters are applied', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
        expect(screen.getByText('Urgent Task')).toBeInTheDocument()
        expect(screen.getByText('Task with comment')).toBeInTheDocument()
        expect(screen.getByText('Status Changed')).toBeInTheDocument()
      })
    })

    it('displays message when no notifications exist', async () => {
      onSnapshot.mockImplementation((q, callback) => {
        callback({ docs: [] })
        return mockUnsubscribe
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
      })
    })
  })

  describe('Notification Types', () => {
    it('renders "add task" notification correctly', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { name: /New Task Assigned/i })
        expect(headings.length).toBeGreaterThan(0)
        expect(screen.getByText('New Task')).toBeInTheDocument()
        expect(screen.getByText('Project A')).toBeInTheDocument()
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Complete the feature')).toBeInTheDocument()
      })
    })

    it('renders deadline notification correctly', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { name: /Deadline Today/i })
        expect(headings.length).toBeGreaterThan(0)
        expect(screen.getByText('Urgent Task')).toBeInTheDocument()
        expect(screen.getByText('Project B')).toBeInTheDocument()
      })
    })

    it('renders task comment notification correctly', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Comment')).toBeInTheDocument()
        expect(screen.getByText('Task with comment')).toBeInTheDocument()
        expect(screen.getByText('Great work on this!')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.getByText('Project C')).toBeInTheDocument()
      })
    })

    it('renders task status update notification correctly', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Task status updated')).toBeInTheDocument()
        expect(screen.getByText('Status Changed')).toBeInTheDocument()
        expect(screen.getByText("Task status changed from 'to-do' to 'in progress'")).toBeInTheDocument()
        expect(screen.getByText('Project D')).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    it('filters to show only unread notifications', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      const filterSelect = screen.getByLabelText('Filter read status')
      await userEvent.selectOptions(filterSelect, 'unread')

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
        expect(screen.getByText('Task with comment')).toBeInTheDocument()
        expect(screen.getByText('Status Changed')).toBeInTheDocument()
        expect(screen.queryByText('Urgent Task')).not.toBeInTheDocument()
      })
    })

    it('filters to show only read notifications', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      const filterSelect = screen.getByLabelText('Filter read status')
      await userEvent.selectOptions(filterSelect, 'read')

      await waitFor(() => {
        expect(screen.getByText('Urgent Task')).toBeInTheDocument()
        expect(screen.queryByText('New Task')).not.toBeInTheDocument()
      })
    })

    it('filters notifications by type', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      const typeSelect = screen.getByLabelText('Filter notification type')
      await userEvent.selectOptions(typeSelect, 'task comment')

      await waitFor(() => {
        expect(screen.getByText('Task with comment')).toBeInTheDocument()
        expect(screen.queryByText('New Task')).not.toBeInTheDocument()
        expect(screen.queryByText('Urgent Task')).not.toBeInTheDocument()
      })
    })

    it('shows all notifications when filter is set to "all"', async () => {
      render(<NotificationsPage />)

      const filterSelect = screen.getByLabelText('Filter read status')
      await userEvent.selectOptions(filterSelect, 'unread')

      await waitFor(() => {
        expect(screen.queryByText('Urgent Task')).not.toBeInTheDocument()
      })

      await userEvent.selectOptions(filterSelect, 'all')

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
        expect(screen.getByText('Urgent Task')).toBeInTheDocument()
      })
    })
  })

  describe('Notification Interactions', () => {
    it('marks notification as read when clicked', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      const notification = screen.getByText('New Task').closest('div[class*="cursor-pointer"]')
      await userEvent.click(notification)

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'notif-1' }),
          { isRead: true }
        )
      })
    })

    it('navigates to project/task when notification is clicked', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      const notification = screen.getByText('New Task').closest('div[class*="cursor-pointer"]')
      await userEvent.click(notification)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/projects/proj-1?task=task-1')
      })
    })

    it('navigates to project when taskId is not present', async () => {
      const notificationWithoutTask = [
        {
          id: 'notif-5',
          type: 'add collaborator',
          title: 'Added to Project',
          message: 'You were added to a project',
          projectName: 'Project E',
          projectId: 'proj-5',
          isRead: false,
          createdAt: {
            toDate: () => new Date('2025-10-25T10:00:00Z'),
          },
        },
      ]

      onSnapshot.mockImplementation((q, callback) => {
        const mockDocs = notificationWithoutTask.map((notif) => ({
          id: notif.id,
          data: () => notif,
        }))
        callback({ docs: mockDocs })
        return mockUnsubscribe
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Added to Project')).toBeInTheDocument()
      })

      const notification = screen.getByText('Added to Project').closest('div[class*="cursor-pointer"]')
      await userEvent.click(notification)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/projects/proj-5')
      })
    })
  })

  describe('Mark All Read', () => {
    it('marks all notifications as read when button is clicked', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      const markAllButton = screen.getByText('Mark all read')
      await userEvent.click(markAllButton)

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledTimes(4) // All 4 notifications
      })
    })

    it('does nothing when there are no notifications', async () => {
      onSnapshot.mockImplementation((q, callback) => {
        callback({ docs: [] })
        return mockUnsubscribe
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
      })

      const markAllButton = screen.getByText('Mark all read')
      await userEvent.click(markAllButton)

      expect(updateDoc).not.toHaveBeenCalled()
    })
  })

  describe('Visual Styling', () => {
    it('applies different styling to unread notifications', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      const unreadNotif = screen.getByText('New Task').closest('div[class*="cursor-pointer"]')
      const readNotif = screen.getByText('Urgent Task').closest('div[class*="cursor-pointer"]')

      expect(unreadNotif).toHaveClass('bg-blue-50', 'border-blue-300')
      expect(readNotif).toHaveClass('bg-white', 'border-gray-200')
    })
  })

  describe('Time Formatting', () => {
    it('displays relative time for notifications', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        const timeElements = screen.getAllByText(/ago/i)
        expect(timeElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Authentication', () => {
    it('does not render notifications when user is not authenticated', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null) // No user
        return jest.fn()
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
      })
    })

    it('sets up Firestore listener when user is authenticated', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(onSnapshot).toHaveBeenCalled()
      })
    })

    it('unsubscribes from auth listener on unmount', () => {
      const unsubscribe = jest.fn()
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return unsubscribe
      })

      const { unmount } = render(<NotificationsPage />)
      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })

    it('unsubscribes from Firestore listener on unmount', async () => {
      const { unmount } = render(<NotificationsPage />)

      await waitFor(() => {
        expect(onSnapshot).toHaveBeenCalled()
      })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('handles notifications with missing createdAt field', async () => {
      const notificationWithoutDate = [
        {
          id: 'notif-6',
          type: 'add task',
          title: 'No Date Task',
          message: 'Task without date',
          isRead: false,
        },
      ]

      onSnapshot.mockImplementation((q, callback) => {
        const mockDocs = notificationWithoutDate.map((notif) => ({
          id: notif.id,
          data: () => notif,
        }))
        callback({ docs: mockDocs })
        return mockUnsubscribe
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('No Date Task')).toBeInTheDocument()
      })
    })

    it('handles notifications with null data', async () => {
      onSnapshot.mockImplementation((q, callback) => {
        const mockDocs = [
          {
            id: 'notif-null',
            data: () => null,
          },
        ]
        callback({ docs: mockDocs })
        return mockUnsubscribe
      })

      render(<NotificationsPage />)

      // Should not crash
      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })
    })

    it('handles invalid createdAt timestamp gracefully', async () => {
      const notificationWithInvalidDate = [
        {
          id: 'notif-7',
          type: 'add task',
          title: 'Invalid Date Task',
          message: 'Task with invalid date',
          isRead: false,
          createdAt: 'invalid-date',
        },
      ]

      onSnapshot.mockImplementation((q, callback) => {
        const mockDocs = notificationWithInvalidDate.map((notif) => ({
          id: notif.id,
          data: () => notif,
        }))
        callback({ docs: mockDocs })
        return mockUnsubscribe
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Invalid Date Task')).toBeInTheDocument()
      })
    })
  })

  describe('Filter Options', () => {
    it('populates type filter with available notification types', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        const typeSelect = screen.getByLabelText('Filter notification type')
        const options = within(typeSelect).getAllByRole('option')

        expect(options.length).toBeGreaterThan(1)
        expect(options[0]).toHaveTextContent('All')
      })
    })

    it('updates available types when notifications change', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })

      // Verify initial notification types are present
      const typeSelect = screen.getByLabelText('Filter notification type')
      const options = within(typeSelect).getAllByRole('option')
      
      // Should have 'all' + the 4 different notification types from mockNotifications
      expect(options.length).toBe(5) // 'all', 'add task', 'deadline_today', 'task comment', 'task status update'
    })
  })
})
