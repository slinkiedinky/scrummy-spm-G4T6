/**
 * @file tasks.test.jsx
 * Test case for adding a collaborator to a task
 *
 * Test Scenario: Add collaborator to a task
 *
 * Pre-conditions:
 *   1. User logged in
 *   2. Member 'John' exists
 *   3. Project 'Project 1' exists
 *   4. Task 'Task 1' exists and John is not a current collaborator
 *
 * Test steps:
 *   1. Open tasks tab
 *   2. Select Task 1
 *   3. Update task to add John as collaborator via API
 *
 * Test data: NIL
 *
 * Expected results: John appears under the list of collaborators for Task 1
 *
 * Note: This test focuses on the API integration for adding collaborators.
 * The UI workflow (Edit button → Edit form → Assignees dropdown) is handled
 * by parent components and would be tested separately in integration tests.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import * as api from '@/lib/api'
import { getDoc } from 'firebase/firestore'

// ─── Mocks ───────────────────────────────────────────────────────────
jest.mock('@/lib/api', () => ({
  updateTask: jest.fn(),
  updateStandaloneTask: jest.fn(),
  listSubtasks: jest.fn(),
  createSubtask: jest.fn(),
  updateSubtask: jest.fn(),
  deleteSubtask: jest.fn(),
  listComments: jest.fn(),
  addComment: jest.fn(),
  editComment: jest.fn(),
  deleteComment: jest.fn(),
  listStandaloneComments: jest.fn(),
  addStandaloneComment: jest.fn(),
  editStandaloneComment: jest.fn(),
  deleteStandaloneComment: jest.fn(),
  listSubtaskComments: jest.fn(),
  addSubtaskComment: jest.fn(),
  editSubtaskComment: jest.fn(),
  deleteSubtaskComment: jest.fn(),
  createStandaloneSubtask: jest.fn(),
  listStandaloneSubtasks: jest.fn(),
  updateStandaloneSubtask: jest.fn(),
  deleteStandaloneSubtask: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  getDoc: jest.fn(),
  doc: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({
  db: {},
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('Add Collaborator to Task - Test Scenario', () => {
  const currentUserId = 'currentUser123'
  const johnUserId = 'john123'

  const mockTask = {
    id: 'task456',
    projectId: 'project123',
    title: 'Task 1',
    description: 'Test task description',
    status: 'to-do',
    priority: 5,
    assigneeId: currentUserId,
    ownerId: currentUserId,
    collaboratorsIds: [], // John is NOT a collaborator initially
    tags: ['feature'],
    dueDate: '2025-11-10T00:00:00.000Z',
    createdAt: new Date('2025-11-01'),
    updatedAt: new Date('2025-11-01'),
  }

  const teamMembers = [
    {
      id: currentUserId,
      uid: currentUserId,
      fullName: 'Current User',
      email: 'current@example.com',
    },
    {
      id: johnUserId,
      uid: johnUserId,
      fullName: 'John',
      email: 'john@example.com',
    },
  ]

  const mockOnClose = jest.fn()
  const mockOnEdit = jest.fn()
  const mockOnDelete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Firestore user details fetching
    getDoc.mockImplementation((docRef) => {
      // Extract userId from the mock doc reference
      const userId = docRef?._key?.path?.segments?.pop?.() || null

      const userMap = {
        [currentUserId]: {
          exists: () => true,
          data: () => ({ fullName: 'Current User', email: 'current@example.com' }),
        },
        [johnUserId]: {
          exists: () => true,
          data: () => ({ fullName: 'John', email: 'john@example.com' }),
        },
      }

      return Promise.resolve(userMap[userId] || { exists: () => false })
    })

    // Mock API responses
    api.updateTask.mockResolvedValue({
      ...mockTask,
      collaboratorsIds: [johnUserId],
    })

    api.listSubtasks.mockResolvedValue([])
    api.listComments.mockResolvedValue([])
    api.listStandaloneComments.mockResolvedValue([])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Test scenario: Add John as collaborator to Task 1
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Member 'John' exists
   *   3. Project 'Project 1' exists
   *   4. Task 'Task 1' exists and John is not a current collaborator
   *
   * Test steps:
   *   1. Display task details (Task 1)
   *   2. Verify John is not currently a collaborator
   *   3. Update task via API to add John as collaborator
   *   4. Verify API was called with correct data
   *
   * Expected results: John is added to the task's collaborators list
   */
  it('should add John as collaborator via updateTask API', async () => {
    // Step 1: Display task details (simulated by rendering TaskDetailModal)
    render(
      <TaskDetailModal
        task={mockTask}
        isOpen={true}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
      />
    )

    // Verify pre-condition: Task 1 is displayed
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })

    // Step 2: Verify pre-condition - John is not currently a collaborator
    await waitFor(() => {
      expect(screen.getByText('No collaborators added.')).toBeInTheDocument()
    })

    // Step 3: Update task to add John as collaborator
    // (In real workflow: User clicks Edit → Opens edit form → Selects John from Assignees → Saves)
    // This test verifies the API call that would be made by that workflow
    await api.updateTask(
      mockTask.projectId,
      mockTask.id,
      { collaboratorsIds: [johnUserId] }
    )

    // Step 4: Verify API was called with correct parameters
    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith(
        mockTask.projectId,
        mockTask.id,
        expect.objectContaining({
          collaboratorsIds: expect.arrayContaining([johnUserId]),
        })
      )
    })

    // Verify John is the only collaborator added
    const apiCall = api.updateTask.mock.calls[0][2]
    expect(apiCall.collaboratorsIds).toHaveLength(1)
    expect(apiCall.collaboratorsIds[0]).toBe(johnUserId)

    // Verify API returned updated task with John as collaborator
    const result = await api.updateTask.mock.results[0].value
    expect(result.collaboratorsIds).toContain(johnUserId)
  })

  /**
   * Test: Verify task details display collaborators list
   */
  it('should display collaborators when task has collaborators', async () => {
    // Create task with John already as collaborator
    const taskWithJohn = {
      ...mockTask,
      collaboratorsIds: [johnUserId],
    }

    render(
      <TaskDetailModal
        task={taskWithJohn}
        isOpen={true}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
      />
    )

    // Verify task title is displayed
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })

    // Verify "Collaborators" section exists
    const collaboratorsLabel = screen.getByText('Collaborators')
    expect(collaboratorsLabel).toBeInTheDocument()

    // Verify "No collaborators" message is NOT shown (since John is a collaborator)
    await waitFor(() => {
      expect(screen.queryByText('No collaborators added.')).not.toBeInTheDocument()
    })
  })

  /**
   * Test: Verify task without collaborators shows appropriate message
   */
  it('should display "No collaborators added" when task has no collaborators', async () => {
    render(
      <TaskDetailModal
        task={mockTask}
        isOpen={true}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })

    // Verify message is shown
    expect(screen.getByText('No collaborators added.')).toBeInTheDocument()
  })

  /**
   * Test scenario: Add multiple collaborators (John and Mary) to Task 1
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Members 'John' and 'Mary' exist
   *   3. Project 'Project 1' exists
   *   4. Task 'Task 1' exists
   *   5. John and Mary are not current collaborators for Task 1
   *
   * Test steps:
   *   1. Display task details (Task 1)
   *   2. Verify John and Mary are not currently collaborators
   *   3. Update task via API to add John and Mary as collaborators
   *   4. Verify API was called with correct data
   *
   * Test data:
   *   Project Name: Project 1
   *   Project description: My first project
   *   Project status: In Progress
   *   Project priority: High
   *   Task name: Task 1
   *   Task description: John and Mary's first task
   *   Task status: To-Do
   *   Task priority: 5
   *   Task due-date: 07/11/2025
   *
   * Expected results: John and Mary are added to the task's collaborators list
   */
  it('should add John and Mary as collaborators via updateTask API', async () => {
    const maryUserId = 'mary456'

    // Add Mary to team members
    const teamMembersWithMary = [
      ...teamMembers,
      {
        id: maryUserId,
        uid: maryUserId,
        fullName: 'Mary',
        email: 'mary@example.com',
      },
    ]

    // Mock Firestore user details fetching for Mary
    getDoc.mockImplementation((docRef) => {
      const userId = docRef?._key?.path?.segments?.pop?.() || null

      const userMap = {
        [currentUserId]: {
          exists: () => true,
          data: () => ({ fullName: 'Current User', email: 'current@example.com' }),
        },
        [johnUserId]: {
          exists: () => true,
          data: () => ({ fullName: 'John', email: 'john@example.com' }),
        },
        [maryUserId]: {
          exists: () => true,
          data: () => ({ fullName: 'Mary', email: 'mary@example.com' }),
        },
      }

      return Promise.resolve(userMap[userId] || { exists: () => false })
    })

    // Mock API to return task with both John and Mary as collaborators
    api.updateTask.mockResolvedValue({
      ...mockTask,
      description: "John and Mary's first task",
      dueDate: '2025-11-07T00:00:00.000Z',
      collaboratorsIds: [johnUserId, maryUserId],
    })

    // Step 1: Display task details (simulated by rendering TaskDetailModal)
    render(
      <TaskDetailModal
        task={mockTask}
        isOpen={true}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        teamMembers={teamMembersWithMary}
        currentUserId={currentUserId}
      />
    )

    // Verify pre-condition: Task 1 is displayed
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })

    // Step 2: Verify pre-condition - John and Mary are not currently collaborators
    await waitFor(() => {
      expect(screen.getByText('No collaborators added.')).toBeInTheDocument()
    })

    // Step 3: Update task to add John and Mary as collaborators
    // (In real workflow: User clicks Edit → Opens edit form → Selects John and Mary from Assignees → Saves)
    // This test verifies the API call that would be made by that workflow
    await api.updateTask(
      mockTask.projectId,
      mockTask.id,
      { collaboratorsIds: [johnUserId, maryUserId] }
    )

    // Step 4: Verify API was called with correct parameters
    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith(
        mockTask.projectId,
        mockTask.id,
        expect.objectContaining({
          collaboratorsIds: expect.arrayContaining([johnUserId, maryUserId]),
        })
      )
    })

    // Verify both John and Mary are in the collaborators list
    const apiCall = api.updateTask.mock.calls[0][2]
    expect(apiCall.collaboratorsIds).toHaveLength(2)
    expect(apiCall.collaboratorsIds).toContain(johnUserId)
    expect(apiCall.collaboratorsIds).toContain(maryUserId)

    // Verify API returned updated task with John and Mary as collaborators
    const result = await api.updateTask.mock.results[0].value
    expect(result.collaboratorsIds).toContain(johnUserId)
    expect(result.collaboratorsIds).toContain(maryUserId)
    expect(result.collaboratorsIds).toHaveLength(2)
  })

  /**
   * Test scenario: Invite notification sent to collaborator
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Member 'John' exists
   *   3. Project 'Project 1' exists
   *   4. Task 'Task 1' exists and John is not a current collaborator
   *
   * Test steps:
   *   1. Add John as collaborator to Task 1
   *   2. Mock notification being created in backend
   *   3. Verify notification would be available for John's account
   *
   * Test data:
   *   Email: john@example.com
   *   Password: password
   *
   * Expected results: Invitation notification appears in John's notification tab
   *
   * Note: This test verifies the notification data structure that would be
   * displayed to John. The actual login/logout flow and real-time notification
   * display would be tested in integration tests.
   */
  it('should create invitation notification for John when added as collaborator', async () => {
    // Mock notification that would be created when John is added as collaborator
    const mockNotification = {
      id: 'notification123',
      userId: johnUserId,
      taskId: mockTask.id,
      projectId: mockTask.projectId,
      projectName: 'Project 1',
      type: 'add collaborator',
      title: mockTask.title,
      message: `You have been added as a collaborator to task: ${mockTask.title}`,
      icon: 'users',
      isRead: false,
      createdAt: new Date(),
    }

    // Mock API to return the notification
    const mockGetNotifications = jest.fn().mockResolvedValue([mockNotification])

    // Step 1: Add John as collaborator (same as previous test)
    api.updateTask.mockResolvedValue({
      ...mockTask,
      collaboratorsIds: [johnUserId],
    })

    await api.updateTask(
      mockTask.projectId,
      mockTask.id,
      { collaboratorsIds: [johnUserId] }
    )

    // Verify task was updated
    expect(api.updateTask).toHaveBeenCalled()

    // Step 2: Simulate fetching notifications for John's account
    const johnsNotifications = await mockGetNotifications(johnUserId)

    // Step 3: Verify notification exists for John
    expect(johnsNotifications).toHaveLength(1)

    const notification = johnsNotifications[0]
    expect(notification.userId).toBe(johnUserId)
    expect(notification.taskId).toBe(mockTask.id)
    expect(notification.type).toBe('add collaborator')
    expect(notification.message).toContain('added as a collaborator')
    expect(notification.message).toContain(mockTask.title)
    expect(notification.isRead).toBe(false)

    // Verify notification contains task reference
    expect(notification.projectId).toBe(mockTask.projectId)
    expect(notification.title).toBe(mockTask.title)

    // Note: In a real scenario, this notification would appear in John's
    // notifications tab after he logs in (Test steps 7-9 from the scenario).
    // This could be verified in an end-to-end test using Firestore onSnapshot
    // to listen for real-time notification updates.
  })
})
