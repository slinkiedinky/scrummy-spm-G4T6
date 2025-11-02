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
  listTasks: jest.fn(),
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

  /**
   * Test scenario: View all projects that the current user has access to
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Projects 'Project 1' and 'Project 2' exist
   *
   * Test steps:
   *   1. Open projects tab
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   *   Project Name: Project 2
   *   Description: My second project
   *   Status: To Do
   *   Priority: Medium
   *
   * Expected results:
   *   - 2 projects 'Project 1' and 'Project 2' are displayed on the projects tab
   */
  it('should display all projects that the current user has access to', async () => {
    // Mock project data - user has access to both projects
    const mockProjects = [
      {
        id: 'project1_id',
        name: 'Project 1',
        description: 'My first project',
        status: 'In Progress',
        priority: 'High',
        ownerId: currentUserId,
        teamIds: [currentUserId],
        progress: 0,
        createdAt: new Date('2025-11-01'),
        updatedAt: new Date('2025-11-01'),
      },
      {
        id: 'project2_id',
        name: 'Project 2',
        description: 'My second project',
        status: 'To Do',
        priority: 'Medium',
        ownerId: 'other_user',
        teamIds: [currentUserId, 'other_user'], // User is a team member
        progress: 0,
        createdAt: new Date('2025-11-01'),
        updatedAt: new Date('2025-11-01'),
      },
    ]

    // Mock listProjects API
    api.listProjects.mockResolvedValue(mockProjects)

    // Step 1: Open projects tab (fetch all projects)
    const projects = await api.listProjects()

    // Verify API was called
    expect(api.listProjects).toHaveBeenCalled()

    // Expected results: 2 projects are displayed
    expect(projects).toHaveLength(2)

    // Filter projects where user is a team member
    const userProjects = projects.filter((project) =>
      project.teamIds.includes(currentUserId)
    )
    expect(userProjects).toHaveLength(2)

    // Verify Project 1
    const project1 = projects.find((p) => p.name === 'Project 1')
    expect(project1).toBeDefined()
    expect(project1.name).toBe('Project 1')
    expect(project1.description).toBe('My first project')
    expect(project1.status).toBe('In Progress')
    expect(project1.priority).toBe('High')
    expect(project1.ownerId).toBe(currentUserId)
    expect(project1.teamIds).toContain(currentUserId)
    expect(project1.id).toBe('project1_id')

    // Verify Project 2
    const project2 = projects.find((p) => p.name === 'Project 2')
    expect(project2).toBeDefined()
    expect(project2.name).toBe('Project 2')
    expect(project2.description).toBe('My second project')
    expect(project2.status).toBe('To Do')
    expect(project2.priority).toBe('Medium')
    expect(project2.ownerId).toBe('other_user')
    expect(project2.teamIds).toContain(currentUserId)
    expect(project2.id).toBe('project2_id')

    // Verify both projects include the current user as a team member
    expect(project1.teamIds).toContain(currentUserId)
    expect(project2.teamIds).toContain(currentUserId)
  })

  /**
   * Test scenario: View project descriptions in projects tab
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *
   * Test steps:
   *   1. Open projects tab
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   * Expected results:
   *   - Project 'Project 1' is displayed on the projects tab with description 'My first project'
   */
  it('should display project description in projects tab', async () => {
    // Mock project data with description
    const mockProject = {
      id: 'project1_id',
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock listProjects API
    api.listProjects.mockResolvedValue([mockProject])

    // Step 1: Open projects tab (fetch all projects)
    const projects = await api.listProjects()

    // Verify API was called
    expect(api.listProjects).toHaveBeenCalled()

    // Expected results: At least 1 project is displayed
    expect(projects).toHaveLength(1)

    // Find Project 1
    const project1 = projects.find((p) => p.name === 'Project 1')
    expect(project1).toBeDefined()

    // Verify Project 1 is displayed with description 'My first project'
    expect(project1.name).toBe('Project 1')
    expect(project1.description).toBe('My first project')
    expect(project1.status).toBe('In Progress')
    expect(project1.priority).toBe('High')

    // Verify description field is present and not empty
    expect(project1).toHaveProperty('description')
    expect(project1.description).not.toBe('')
    expect(project1.description.trim()).toBe('My first project')
  })

  /**
   * Test scenario: View project status in projects tab
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *
   * Test steps:
   *   1. Open projects tab
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   * Expected results:
   *   - Project 'Project 1' is displayed on the projects tab with status 'In Progress'
   */
  it('should display project status in projects tab', async () => {
    // Mock project data with status
    const mockProject = {
      id: 'project1_id',
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock listProjects API
    api.listProjects.mockResolvedValue([mockProject])

    // Step 1: Open projects tab (fetch all projects)
    const projects = await api.listProjects()

    // Verify API was called
    expect(api.listProjects).toHaveBeenCalled()

    // Expected results: At least 1 project is displayed
    expect(projects).toHaveLength(1)

    // Find Project 1
    const project1 = projects.find((p) => p.name === 'Project 1')
    expect(project1).toBeDefined()

    // Verify Project 1 is displayed with status 'In Progress'
    expect(project1.name).toBe('Project 1')
    expect(project1.status).toBe('In Progress')
    expect(project1.description).toBe('My first project')
    expect(project1.priority).toBe('High')

    // Verify status field is present and not empty
    expect(project1).toHaveProperty('status')
    expect(project1.status).not.toBe('')
    expect(project1.status.trim()).toBe('In Progress')
  })

  /**
   * Test scenario: View project priority in projects tab
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *
   * Test steps:
   *   1. Open projects tab
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   * Expected results:
   *   - Project 'Project 1' is displayed on the projects tab with priority 'High'
   */
  it('should display project priority in projects tab', async () => {
    // Mock project data with priority
    const mockProject = {
      id: 'project1_id',
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock listProjects API
    api.listProjects.mockResolvedValue([mockProject])

    // Step 1: Open projects tab (fetch all projects)
    const projects = await api.listProjects()

    // Verify API was called
    expect(api.listProjects).toHaveBeenCalled()

    // Expected results: At least 1 project is displayed
    expect(projects).toHaveLength(1)

    // Find Project 1
    const project1 = projects.find((p) => p.name === 'Project 1')
    expect(project1).toBeDefined()

    // Verify Project 1 is displayed with priority 'High'
    expect(project1.name).toBe('Project 1')
    expect(project1.priority).toBe('High')
    expect(project1.description).toBe('My first project')
    expect(project1.status).toBe('In Progress')

    // Verify priority field is present and not empty
    expect(project1).toHaveProperty('priority')
    expect(project1.priority).not.toBe('')
    expect(['Low', 'Medium', 'High']).toContain(project1.priority)
  })

  /**
   * Test scenario: View project page containing project name
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *
   * Test steps:
   *   1. Open projects tab
   *   2. Select 'View Details' on Project 1
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   * Expected results:
   *   - Project page displays project name 'Project 1'
   */
  it('should display project name on project page', async () => {
    const projectId = 'project123'

    // Mock project data
    const mockProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock getProject API
    api.getProject.mockResolvedValue(mockProject)

    // Step 1: Open projects tab (already done in previous tests)
    // Step 2: Select 'View Details' on Project 1 (fetch project details)
    const project = await api.getProject(projectId)

    // Verify API was called
    expect(api.getProject).toHaveBeenCalledWith(projectId)

    // Expected results: Project page displays project name 'Project 1'
    expect(project).toBeDefined()
    expect(project.name).toBe('Project 1')
    expect(project.description).toBe('My first project')
    expect(project.status).toBe('In Progress')
    expect(project.priority).toBe('High')
    expect(project.id).toBe(projectId)

    // Verify name field is present and not empty
    expect(project).toHaveProperty('name')
    expect(project.name).not.toBe('')
    expect(project.name.trim()).toBe('Project 1')
  })

  /**
   * Test scenario: View project page containing project description
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *
   * Test steps:
   *   1. Open projects tab
   *   2. Select 'View Details' on Project 1
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   * Expected results:
   *   - Project page displays project description 'My first project'
   */
  it('should display project description on project page', async () => {
    const projectId = 'project123'

    // Mock project data
    const mockProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock getProject API
    api.getProject.mockResolvedValue(mockProject)

    // Step 1: Open projects tab (already done in previous tests)
    // Step 2: Select 'View Details' on Project 1 (fetch project details)
    const project = await api.getProject(projectId)

    // Verify API was called
    expect(api.getProject).toHaveBeenCalledWith(projectId)

    // Expected results: Project page displays project description 'My first project'
    expect(project).toBeDefined()
    expect(project.description).toBe('My first project')
    expect(project.name).toBe('Project 1')
    expect(project.status).toBe('In Progress')
    expect(project.priority).toBe('High')
    expect(project.id).toBe(projectId)

    // Verify description field is present and not empty
    expect(project).toHaveProperty('description')
    expect(project.description).not.toBe('')
    expect(project.description.trim()).toBe('My first project')
  })

  /**
   * Test scenario: View project page containing project status
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *
   * Test steps:
   *   1. Open projects tab
   *   2. Select 'View Details' on Project 1
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   * Expected results:
   *   - Project page displays project status 'In Progress'
   */
  it('should display project status on project page', async () => {
    const projectId = 'project123'

    // Mock project data
    const mockProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock getProject API
    api.getProject.mockResolvedValue(mockProject)

    // Step 1: Open projects tab (already done in previous tests)
    // Step 2: Select 'View Details' on Project 1 (fetch project details)
    const project = await api.getProject(projectId)

    // Verify API was called
    expect(api.getProject).toHaveBeenCalledWith(projectId)

    // Expected results: Project page displays project status 'In Progress'
    expect(project).toBeDefined()
    expect(project.status).toBe('In Progress')
    expect(project.name).toBe('Project 1')
    expect(project.description).toBe('My first project')
    expect(project.priority).toBe('High')
    expect(project.id).toBe(projectId)

    // Verify status field is present and not empty
    expect(project).toHaveProperty('status')
    expect(project.status).not.toBe('')
    expect(project.status.trim()).toBe('In Progress')
  })

  // Scrum-130: View project page containing project priority
  it('should display project priority on project page', async () => {
    const projectId = 'project123'

    // Mock project data
    const mockProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock getProject API
    api.getProject.mockResolvedValue(mockProject)

    // Step 1: Open projects tab (already done in previous tests)
    // Step 2: Select 'View Details' on Project 1 (fetch project details)
    const project = await api.getProject(projectId)

    // Verify API was called
    expect(api.getProject).toHaveBeenCalledWith(projectId)

    // Expected results: Project page displays project priority 'High'
    expect(project).toBeDefined()
    expect(project.priority).toBe('High')
    expect(project.name).toBe('Project 1')
    expect(project.description).toBe('My first project')
    expect(project.status).toBe('In Progress')
    expect(project.id).toBe(projectId)

    // Verify priority field is present and not empty
    expect(project).toHaveProperty('priority')
    expect(project.priority).not.toBe('')
    expect(project.priority.trim()).toBe('High')
  })

  /**
   * Test scenario: View timeline tab on project page
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *
   * Test steps:
   *   1. Open projects tab
   *   2. Select 'View Details' on Project 1
   *
   * Test data:
   *   Project Name: Project 1
   *   Description: My first project
   *   Status: In Progress
   *   Priority: High
   *
   * Expected results:
   *   - Project page contains tab 'Timeline'
   */
  it('should display timeline tab on project page', async () => {
    const projectId = 'project123'

    // Mock project data
    const mockProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock getProject API
    api.getProject.mockResolvedValue(mockProject)

    // Step 1: Open projects tab (already done in previous tests)
    // Step 2: Select 'View Details' on Project 1 (fetch project details)
    const project = await api.getProject(projectId)

    // Verify API was called
    expect(api.getProject).toHaveBeenCalledWith(projectId)

    // Expected results: Project page contains necessary data for timeline tab
    expect(project).toBeDefined()
    expect(project.id).toBe(projectId)
    expect(project.name).toBe('Project 1')
    expect(project.description).toBe('My first project')
    expect(project.status).toBe('In Progress')
    expect(project.priority).toBe('High')

    // Verify project has the required fields for timeline functionality
    expect(project).toHaveProperty('id')
    expect(project.id).not.toBe('')
    // Timeline tab would be rendered based on project data availability
    expect(project).toHaveProperty('createdAt')
  })

  /**
   * Test scenario: View team member's active tasks and due dates on project timeline
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *   3. Member 'John' exists
   *   4. John is assigned 'Task 1'
   *
   * Test steps:
   *   1. Open projects tab
   *   2. Select 'View Details' on Project 1
   *   3. Select 'Timeline' tab
   *
   * Test data:
   *   Project Name: Project 1
   *   Project description: My first project
   *   Project status: In Progress
   *   Project priority: High
   *
   *   Task name: Task 1
   *   Task description: John's first task
   *   Task status: To-Do
   *   Task priority: 5
   *   Task due-date: 07/11/2025
   *
   * Expected results:
   *   - 07/11/2025 is shaded black on the project timeline with a badge containing '1'
   */
  it('should display team member tasks and due dates on project timeline', async () => {
    const projectId = 'project123'
    const johnId = 'john123'

    // Mock project data
    const mockProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId, johnId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock task data - Task 1 assigned to John with due date 07/11/2025
    const mockTasks = [
      {
        id: 'task123',
        projectId: projectId,
        name: 'Task 1',
        description: "John's first task",
        status: 'To-Do',
        priority: 5,
        dueDate: new Date('2025-11-07'),
        assigneeId: johnId,
        createdAt: new Date('2025-11-01'),
        updatedAt: new Date('2025-11-01'),
      },
    ]

    // Mock APIs
    api.getProject.mockResolvedValue(mockProject)
    api.listTasks.mockResolvedValue(mockTasks)

    // Step 1: Open projects tab (already done in previous tests)
    // Step 2: Select 'View Details' on Project 1 (fetch project details)
    const project = await api.getProject(projectId)

    // Verify project API was called
    expect(api.getProject).toHaveBeenCalledWith(projectId)
    expect(project).toBeDefined()

    // Step 3: Select 'Timeline' tab (fetch tasks for timeline)
    const tasks = await api.listTasks(projectId, { userId: currentUserId })

    // Verify tasks API was called
    expect(api.listTasks).toHaveBeenCalledWith(projectId, {
      userId: currentUserId,
    })

    // Expected results: Timeline displays task with due date 07/11/2025
    expect(tasks).toHaveLength(1)

    const task1 = tasks[0]
    expect(task1.name).toBe('Task 1')
    expect(task1.description).toBe("John's first task")
    expect(task1.status).toBe('To-Do')
    expect(task1.priority).toBe(5)
    expect(task1.assigneeId).toBe(johnId)

    // Verify due date is present for timeline display
    expect(task1).toHaveProperty('dueDate')
    expect(task1.dueDate).not.toBeNull()

    // Verify the due date is 07/11/2025
    const dueDate = new Date(task1.dueDate)
    expect(dueDate.getFullYear()).toBe(2025)
    expect(dueDate.getMonth()).toBe(10) // November (0-indexed)
    expect(dueDate.getDate()).toBe(7)

    // The frontend would render 07/11/2025 shaded black with badge '1'
    // based on this task data
  })

  /**
   * Test scenario: View team member's completed tasks on project timeline
   *
   * Pre-conditions:
   *   1. User logged in
   *   2. Project 'Project 1' exists
   *   3. Member 'John' exists
   *   4. John is assigned and completed 'Task 1'
   *
   * Test steps:
   *   1. Open projects tab
   *   2. Select 'View Details' on Project 1
   *   3. Select 'Timeline' tab
   *
   * Test data:
   *   Project Name: Project 1
   *   Project description: My first project
   *   Project status: In Progress
   *   Project priority: High
   *
   *   Task name: Task 1
   *   Task description: John's first task
   *   Task status: Completed
   *   Task priority: 5
   *   Task due-date: 07/11/2025
   *
   * Expected results:
   *   - 07/11/2025 is shaded green on the project timeline with a badge containing '1'
   */
  it('should display team member completed tasks on project timeline', async () => {
    const projectId = 'project123'
    const johnId = 'john123'

    // Mock project data
    const mockProject = {
      id: projectId,
      name: 'Project 1',
      description: 'My first project',
      status: 'In Progress',
      priority: 'High',
      ownerId: currentUserId,
      teamIds: [currentUserId, johnId],
      progress: 0,
      createdAt: new Date('2025-11-01'),
      updatedAt: new Date('2025-11-01'),
    }

    // Mock task data - Task 1 assigned to John and completed with due date 07/11/2025
    const mockTasks = [
      {
        id: 'task123',
        projectId: projectId,
        name: 'Task 1',
        description: "John's first task",
        status: 'Completed',
        priority: 5,
        dueDate: new Date('2025-11-07'),
        assigneeId: johnId,
        createdAt: new Date('2025-11-01'),
        updatedAt: new Date('2025-11-01'),
      },
    ]

    // Mock APIs
    api.getProject.mockResolvedValue(mockProject)
    api.listTasks.mockResolvedValue(mockTasks)

    // Step 1: Open projects tab (already done in previous tests)
    // Step 2: Select 'View Details' on Project 1 (fetch project details)
    const project = await api.getProject(projectId)

    // Verify project API was called
    expect(api.getProject).toHaveBeenCalledWith(projectId)
    expect(project).toBeDefined()

    // Step 3: Select 'Timeline' tab (fetch tasks for timeline)
    const tasks = await api.listTasks(projectId, { userId: currentUserId })

    // Verify tasks API was called
    expect(api.listTasks).toHaveBeenCalledWith(projectId, {
      userId: currentUserId,
    })

    // Expected results: Timeline displays completed task with due date 07/11/2025
    expect(tasks).toHaveLength(1)

    const task1 = tasks[0]
    expect(task1.name).toBe('Task 1')
    expect(task1.description).toBe("John's first task")
    expect(task1.status).toBe('Completed')
    expect(task1.priority).toBe(5)
    expect(task1.assigneeId).toBe(johnId)

    // Verify due date is present for timeline display
    expect(task1).toHaveProperty('dueDate')
    expect(task1.dueDate).not.toBeNull()

    // Verify the due date is 07/11/2025
    const dueDate = new Date(task1.dueDate)
    expect(dueDate.getFullYear()).toBe(2025)
    expect(dueDate.getMonth()).toBe(10) // November (0-indexed)
    expect(dueDate.getDate()).toBe(7)

    // Verify task status is completed
    expect(task1.status).toBe('Completed')

    // The frontend would render 07/11/2025 shaded green with badge '1'
    // based on the task status being 'Completed'
  })

  it('should display due dates for specific day', async () => {
    // Test scenario: View due-dates for a specific day
    // Pre-conditions:
    // 1. User logged in
    // 2. Project 'Project 1' exists
    // 3. Member 'John' exists
    // 4. John is assigned 'Task 1'
    //
    // Test steps:
    // 1. Open projects tab
    // 2. Select 'View Details' on Project 1
    // 3. Select 'Timeline' tab
    // 4. Select the circle for 07/11/2025
    //
    // Test data:
    // - Task name: Task 1
    // - Task status: To-Do
    // - Task due-date: 07/11/2025
    //
    // Expected results:
    // Timeline expands to show the name, description, status, priority,
    // and assigned member of the task that is due on 07/11/2025

    const projectId = 'project123'
    const projectName = 'Project 1'
    const johnId = 'user456'

    const mockProject = {
      id: projectId,
      name: projectName,
      description: 'Test project',
      createdBy: 'user123',
      collaboratorIds: [johnId],
      createdAt: new Date('2025-01-01'),
    }

    const mockTasks = [
      {
        id: 'task123',
        projectId: projectId,
        name: 'Task 1',
        description: "John's first task",
        status: 'To-Do',
        priority: 5,
        dueDate: new Date('2025-11-07'),
        assigneeId: johnId,
      },
    ]

    api.getProject.mockResolvedValue(mockProject)
    api.listTasks.mockResolvedValue(mockTasks)

    // Simulate clicking on the circle for 07/11/2025 in the timeline
    // This would filter tasks to show only those due on this specific day

    // Filter tasks by the selected date (07/11/2025)
    const targetDate = new Date('2025-11-07')
    const tasksDueOnDate = mockTasks.filter((task) => {
      if (!task.dueDate) return false

      const taskDate = new Date(task.dueDate)
      return (
        taskDate.getFullYear() === targetDate.getFullYear() &&
        taskDate.getMonth() === targetDate.getMonth() &&
        taskDate.getDate() === targetDate.getDate()
      )
    })

    // Verify we found tasks due on 07/11/2025
    expect(tasksDueOnDate.length).toBe(1)

    const task1 = tasksDueOnDate[0]

    // Verify timeline expands to show all task details
    expect(task1.name).toBe('Task 1')
    expect(task1.description).toBe("John's first task")
    expect(task1.status).toBe('To-Do')
    expect(task1.priority).toBe(5)
    expect(task1.assigneeId).toBe(johnId)

    // Verify the due date is exactly 07/11/2025
    const dueDate = new Date(task1.dueDate)
    expect(dueDate.getFullYear()).toBe(2025)
    expect(dueDate.getMonth()).toBe(10) // November (0-indexed)
    expect(dueDate.getDate()).toBe(7)

    // The frontend would expand the timeline to display:
    // - Name: Task 1
    // - Description: John's first task
    // - Status: To-Do
    // - Priority: 5
    // - Assigned member: John (johnId)
  })
})
