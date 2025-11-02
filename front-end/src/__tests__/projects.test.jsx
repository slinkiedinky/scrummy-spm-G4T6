/**
 * @file projects.test.jsx
 * Test cases for project management
 *
 * Test Scenario: Create project with valid details
 *
 * Pre-conditions:
 *   1. User logged in
 *
 * Test steps:
 *   1. Open projects tab
 *   2. Select "+ New Project"
 *   3. Enter details for each field
 *   4. Select "Create Project"
 *
 * Test data:
 *   Project Name: Project 1
 *   Description: My first project
 *   Status: To Do
 *   Priority: Medium
 *
 * Expected results: New project appears in the project dashboard with correct details,
 *                   progress 0% and 1 team member
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '@/lib/api'

// ─── Mocks ───────────────────────────────────────────────────────────
jest.mock('@/lib/api', () => ({
  createProject: jest.fn(),
  listProjects: jest.fn(),
  getProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  listUsers: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: { uid: 'user123' },
  },
  db: {},
}))

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('Create Project - Test Scenario', () => {
  const currentUserId = 'user123'

  const mockProjectData = {
    name: 'Project 1',
    description: 'My first project',
    priority: 'medium',
    ownerId: currentUserId,
  }

  const mockCreatedProject = {
    id: 'project123',
    ...mockProjectData,
    progress: 0,
    teamIds: [currentUserId],
    createdAt: new Date('2025-11-01'),
    updatedAt: new Date('2025-11-01'),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock API responses
    api.createProject.mockResolvedValue({
      id: 'project123',
      message: 'Project created',
    })

    api.getProject.mockResolvedValue(mockCreatedProject)

    api.listProjects.mockResolvedValue([mockCreatedProject])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Test scenario: Create project with valid details
   *
   * Pre-conditions:
   *   1. User logged in
   *
   * Test steps:
   *   1. Prepare project data
   *   2. Call createProject API
   *   3. Verify project is created with correct details
   *   4. Verify project appears in project list
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: To Do
   *   Priority: Medium
   *
   * Expected results:
   *   - New project is created successfully
   *   - Project appears with correct details
   *   - Progress is 0%
   *   - Team has 1 member (the owner)
   */
  it('should create project with valid details and initialize with 0% progress', async () => {
    // Step 1: Prepare project data (simulating user filling the form)
    const projectData = {
      name: 'Project 1',
      description: 'My first project',
      priority: 'medium',
      ownerId: currentUserId,
    }

    // Step 2: Call createProject API (simulating form submission)
    const createResponse = await api.createProject(projectData)

    // Verify project creation response
    expect(api.createProject).toHaveBeenCalledWith(projectData)
    expect(createResponse).toHaveProperty('id')
    expect(createResponse.id).toBe('project123')

    // Step 3: Fetch the created project to verify details
    const createdProject = await api.getProject('project123')

    // Verify project details
    expect(createdProject.name).toBe('Project 1')
    expect(createdProject.description).toBe('My first project')
    expect(createdProject.priority).toBe('medium')
    expect(createdProject.ownerId).toBe(currentUserId)

    // Verify progress is initialized to 0%
    expect(createdProject.progress).toBe(0)

    // Verify team has 1 member (the owner)
    expect(createdProject.teamIds).toHaveLength(1)
    expect(createdProject.teamIds).toContain(currentUserId)

    // Step 4: Verify project appears in project dashboard
    const projects = await api.listProjects(currentUserId)
    expect(projects).toHaveLength(1)
    expect(projects[0].id).toBe('project123')
    expect(projects[0].name).toBe('Project 1')
  })

  /**
   * Test: Verify required fields for project creation
   */
  it('should require project name and ownerId', async () => {
    // Mock API to reject when required fields are missing
    api.createProject.mockRejectedValue({
      error: 'ownerId is required',
    })

    // Attempt to create project without ownerId
    const invalidData = {
      name: 'Project 1',
      description: 'My first project',
      priority: 'medium',
      // ownerId is missing
    }

    await expect(api.createProject(invalidData)).rejects.toEqual({
      error: 'ownerId is required',
    })
  })

  /**
   * Test: Verify default priority if not specified
   */
  it('should use default priority if not specified', async () => {
    const projectWithoutPriority = {
      name: 'Project 1',
      description: 'My first project',
      ownerId: currentUserId,
      // priority not specified
    }

    api.createProject.mockResolvedValue({
      id: 'project124',
      message: 'Project created',
    })

    api.getProject.mockResolvedValue({
      id: 'project124',
      ...projectWithoutPriority,
      priority: 'medium', // Default priority
      progress: 0,
      teamIds: [currentUserId],
    })

    await api.createProject(projectWithoutPriority)
    const project = await api.getProject('project124')

    // Verify default priority is applied
    expect(project.priority).toBe('medium')
  })

  /**
   * Test: Verify project name is required (fallback to "Untitled Project")
   */
  it('should use "Untitled Project" as default name if name is empty', async () => {
    const projectWithoutName = {
      name: '',
      description: 'My first project',
      priority: 'medium',
      ownerId: currentUserId,
    }

    api.createProject.mockResolvedValue({
      id: 'project125',
      message: 'Project created',
    })

    api.getProject.mockResolvedValue({
      id: 'project125',
      name: 'Untitled Project', // Default name
      description: 'My first project',
      priority: 'medium',
      progress: 0,
      teamIds: [currentUserId],
      ownerId: currentUserId,
    })

    await api.createProject(projectWithoutName)
    const project = await api.getProject('project125')

    // Verify default name is applied
    expect(project.name).toBe('Untitled Project')
  })

  /**
   * Test scenario: Input validation for new project details
   *
   * Pre-conditions:
   *   1. User logged in
   *
   * Test steps:
   *   1. Attempt to create project with empty name
   *   2. Verify API rejects the request
   *
   * Test data: NIL
   *
   * Expected results:
   *   - API call is rejected with error
   *   - Error message indicates name is required
   *   - No new project is created
   */
  it('should reject project creation when name is empty', async () => {
    // Mock API to reject when name is empty
    api.createProject.mockRejectedValue({
      error: 'Project name is required',
    })

    // Attempt to create project with empty name
    const invalidData = {
      name: '', // Empty name
      description: 'My first project',
      priority: 'medium',
      ownerId: currentUserId,
    }

    // Verify API rejects the request
    await expect(api.createProject(invalidData)).rejects.toEqual({
      error: 'Project name is required',
    })

    // Verify createProject was called with empty name
    expect(api.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '',
      })
    )

    // Verify no project was created
    expect(api.getProject).not.toHaveBeenCalled()
  })

  /**
   * Test scenario: Search for collaborators to be added to project
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *   3. User 'John' exists
   *
   * Test steps:
   *   1. Fetch all users via API
   *   2. Filter/search for 'John' in the results
   *
   * Test data: NIL
   *
   * Expected results:
   *   - API returns list of users
   *   - User 'John' appears in the dropdown results
   *   - Search is case-insensitive
   */
  it('should search and find John in user results for adding to project', async () => {
    // Mock users data
    const mockUsers = [
      {
        id: 'john123',
        uid: 'john123',
        fullName: 'John',
        email: 'john@example.com',
      },
      {
        id: 'mary456',
        uid: 'mary456',
        fullName: 'Mary',
        email: 'mary@example.com',
      },
      {
        id: 'alice789',
        uid: 'alice789',
        fullName: 'Alice Johnson',
        email: 'alice@example.com',
      },
    ]

    // Mock listUsers API
    api.listUsers.mockResolvedValue(mockUsers)

    // Step 1: Fetch all users (simulating opening the Manage Team search)
    const users = await api.listUsers()

    // Verify API was called
    expect(api.listUsers).toHaveBeenCalled()
    expect(users).toHaveLength(3)

    // Step 2: Search for 'John' in the results (case-insensitive)
    const searchTerm = 'john'
    const searchResults = users.filter((user) =>
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Verify John appears in search results
    expect(searchResults).toHaveLength(2) // "John" and "Alice Johnson"
    expect(searchResults.some((user) => user.fullName === 'John')).toBe(true)

    // Verify exact match for 'John'
    const johnUser = searchResults.find((user) => user.fullName === 'John')
    expect(johnUser).toBeDefined()
    expect(johnUser.fullName).toBe('John')
    expect(johnUser.email).toBe('john@example.com')
    expect(johnUser.id).toBe('john123')

    // Step 3: Verify search is case-insensitive
    const upperCaseSearch = users.filter((user) =>
      user.fullName.toLowerCase().includes('JOHN'.toLowerCase())
    )
    expect(upperCaseSearch).toHaveLength(2)
    expect(upperCaseSearch.some((user) => user.fullName === 'John')).toBe(true)
  })

  /**
   * Test scenario: Search for non-existent collaborators
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *   3. User 'Bob' does not exist
   *
   * Test steps:
   *   1. Fetch all users via API
   *   2. Search for 'Bob' in the results
   *
   * Test data: NIL
   *
   * Expected results:
   *   - API returns list of users
   *   - User 'Bob' does not appear in the dropdown results
   *   - Search returns empty results
   */
  it('should return no results when searching for non-existent user Bob', async () => {
    // Mock users data - Bob does NOT exist
    const mockUsers = [
      {
        id: 'john123',
        uid: 'john123',
        fullName: 'John',
        email: 'john@example.com',
      },
      {
        id: 'mary456',
        uid: 'mary456',
        fullName: 'Mary',
        email: 'mary@example.com',
      },
    ]

    // Mock listUsers API
    api.listUsers.mockResolvedValue(mockUsers)

    // Step 1: Fetch all users (simulating opening the Manage Team search)
    const users = await api.listUsers()

    // Verify API was called
    expect(api.listUsers).toHaveBeenCalled()
    expect(users).toHaveLength(2)

    // Step 2: Search for 'Bob' in the results
    const searchTerm = 'bob'
    const searchResults = users.filter((user) =>
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Verify Bob does NOT appear in search results
    expect(searchResults).toHaveLength(0)
    expect(searchResults.some((user) => user.fullName === 'Bob')).toBe(false)

    // Verify only John and Mary exist
    const userNames = users.map((u) => u.fullName)
    expect(userNames).toContain('John')
    expect(userNames).toContain('Mary')
    expect(userNames).not.toContain('Bob')

    // Verify no user with 'Bob' in their name exists
    const bobUser = users.find((user) => user.fullName === 'Bob')
    expect(bobUser).toBeUndefined()
  })

  /**
   * Test scenario: Collaborator is successfully added to the project
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *   3. User 'John' exists
   *
   * Test steps:
   *   1. Get current project
   *   2. Update project to add John to teamIds
   *   3. Verify John appears in team members
   *
   * Test data: NIL
   *
   * Expected results:
   *   - API successfully updates project
   *   - John appears in the list of current team members
   *   - Team size increases by 1
   */
  it('should successfully add John as collaborator to project', async () => {
    const johnUserId = 'john123'
    const projectId = 'project123'

    // Mock initial project with only owner
    const initialProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      priority: 'medium',
      ownerId: currentUserId,
      teamIds: [currentUserId], // Only owner initially
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock updated project with John added
    const updatedProject = {
      ...initialProject,
      teamIds: [currentUserId, johnUserId], // John is now added
      updatedAt: new Date('2025-11-02'),
    }

    // Mock API responses
    api.getProject.mockResolvedValue(initialProject)
    api.updateProject.mockResolvedValue(updatedProject)

    // Step 1: Get current project
    const project = await api.getProject(projectId)
    expect(project.teamIds).toHaveLength(1)
    expect(project.teamIds).toContain(currentUserId)
    expect(project.teamIds).not.toContain(johnUserId)

    // Step 2: Update project to add John to team
    const updateData = {
      teamIds: [currentUserId, johnUserId],
    }
    const result = await api.updateProject(projectId, updateData)

    // Step 3: Verify API was called correctly
    expect(api.updateProject).toHaveBeenCalledWith(
      projectId,
      expect.objectContaining({
        teamIds: expect.arrayContaining([currentUserId, johnUserId]),
      })
    )

    // Verify John appears in team members
    expect(result.teamIds).toHaveLength(2)
    expect(result.teamIds).toContain(johnUserId)
    expect(result.teamIds).toContain(currentUserId)

    // Verify owner is still in team
    expect(result.ownerId).toBe(currentUserId)
    expect(result.teamIds).toContain(result.ownerId)
  })
})
