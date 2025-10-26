import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TasksPage from '../page.jsx';

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback({ uid: 'test-user', displayName: 'Test User', email: 'test@example.com' });
    return jest.fn();
  }),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

// Mock UI components
jest.mock('../../../components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('../../../components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, className, ...props }) => (
    <input 
      placeholder={placeholder} 
      value={value} 
      onChange={onChange} 
      className={className}
      {...props}
    />
  ),
}));

jest.mock('../../../components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children, value }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }) => <button>{children}</button>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
}));

jest.mock('../../../components/ui/badge', () => ({
  Badge: ({ children, className }) => (
    <span className={className} data-testid="badge">{children}</span>
  ),
}));

jest.mock('../../../components/ui/card', () => ({
  Card: ({ children, className, onClick }) => (
    <div className={className} onClick={onClick}>{children}</div>
  ),
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h3>{children}</h3>,
}));

// Mock modals - simple mock that doesn't render anything
jest.mock('../../../components/TaskDetailModal', () => {
  return jest.fn(() => null);
});

jest.mock('../../../components/StandaloneTaskModal', () => {
  return jest.fn(() => null);
});

// Mock API
jest.mock('../../../lib/api', () => ({
  listAssignedTasks: jest.fn(),
  listStandaloneTasks: jest.fn(),
  listUsers: jest.fn(),
  getProject: jest.fn(),
  deleteTask: jest.fn(),
  deleteStandaloneTask: jest.fn(),
  updateTask: jest.fn(),
  updateSubtask: jest.fn(),
  deleteSubtask: jest.fn(),
  getSubtask: jest.fn(),
}));

// Test data
const mockUsers = [
  { id: 'user1', displayName: 'Test User 1' },
  { id: 'user2', displayName: 'Test User 2' },
];

const mockTasks = [
  {
    id: 'task-1',
    title: 'Alpha Project Task',
    description: 'First project task',
    status: 'in_progress',
    priority: 3,
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    projectId: 'project-1',
    collaboratorsIds: ['user1'],
    subtasks: [],
  },
];

const mockStandaloneTasks = [
  {
    id: 'standalone-1',
    title: 'Beta Standalone Task',
    description: 'Independent task',
    status: 'pending',
    priority: 2,
    dueDate: new Date(Date.now() + 172800000).toISOString(),
    collaboratorsIds: ['user2'],
  },
];

describe('TasksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup API mocks
    const mockApi = require('../../../lib/api');
    mockApi.listAssignedTasks.mockResolvedValue(mockTasks);
    mockApi.listStandaloneTasks.mockResolvedValue(mockStandaloneTasks);
    mockApi.listUsers.mockResolvedValue(mockUsers);
    mockApi.getProject.mockResolvedValue({ id: 'project-1', name: 'Test Project' });
    mockApi.deleteTask.mockResolvedValue();
    mockApi.deleteStandaloneTask.mockResolvedValue();
    mockApi.updateTask.mockResolvedValue();
    
    const TaskDetailModal = require('../../../components/TaskDetailModal');
    const StandaloneTaskModal = require('../../../components/StandaloneTaskModal');
    TaskDetailModal.mockReturnValue(null);
    StandaloneTaskModal.mockReturnValue(null);
  });

  describe('Basic Rendering', () => {
    test('renders page title and header elements', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('My Tasks')).toBeInTheDocument();
        expect(screen.getByText('Create Standalone Task')).toBeInTheDocument();
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    test('displays task statistics', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Total tasks')).toBeInTheDocument();
        expect(screen.getByText('Overdue')).toBeInTheDocument();
        expect(screen.getByText('Active projects')).toBeInTheDocument();
      });
    });

    test('renders search and filter components', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by title, description, or project…')).toBeInTheDocument();
        expect(screen.getAllByTestId('select').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Task Loading and Display', () => {
    test('loads and displays project tasks', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Alpha Project Task')).toBeInTheDocument();
        const mockApi = require('../../../lib/api');
        expect(mockApi.listAssignedTasks).toHaveBeenCalled();
      });
    });

    test('loads and displays standalone tasks', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Beta Standalone Task')).toBeInTheDocument();
        const mockApi = require('../../../lib/api');
        expect(mockApi.listStandaloneTasks).toHaveBeenCalled();
      });
    });

    test('displays correct task count', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        // Should show total of 2 tasks
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    test('filters tasks by search input', async () => {
      render(<TasksPage />);
      
      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText('Alpha Project Task')).toBeInTheDocument();
        expect(screen.getByText('Beta Standalone Task')).toBeInTheDocument();
      });

      // Search for 'beta'
      const searchInput = screen.getByPlaceholderText('Search by title, description, or project…');
      fireEvent.change(searchInput, { target: { value: 'beta' } });

      await waitFor(() => {
        expect(screen.queryByText('Alpha Project Task')).not.toBeInTheDocument();
        expect(screen.getByText('Beta Standalone Task')).toBeInTheDocument();
      });
    });

    test('shows empty state when no tasks match search', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Alpha Project Task')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by title, description, or project…');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No tasks found')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your filters or search.')).toBeInTheDocument();
      });
    });
  });

  describe('Task Actions', () => {
    test('opens create task modal when Add Task clicked', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Add Task')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add Task'));

      const TaskDetailModal = require('../../../components/TaskDetailModal');
      expect(TaskDetailModal).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          mode: 'create'
        }),
        expect.any(Object)
      );
    });

    test('opens create standalone task modal', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Standalone Task')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Standalone Task'));

      const StandaloneTaskModal = require('../../../components/StandaloneTaskModal');
      expect(StandaloneTaskModal).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true
        }),
        expect.any(Object)
      );
    });

    test('refreshes data when refresh button clicked', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        const mockApi = require('../../../lib/api');
        expect(mockApi.listAssignedTasks).toHaveBeenCalledTimes(2);
        expect(mockApi.listStandaloneTasks).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error when API fails', async () => {
      const mockApi = require('../../../lib/api');
      mockApi.listAssignedTasks.mockRejectedValueOnce(new Error('API Error'));

      render(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument();
      });
    });

    test('handles empty task lists', async () => {
      const mockApi = require('../../../lib/api');
      mockApi.listAssignedTasks.mockResolvedValueOnce([]);
      mockApi.listStandaloneTasks.mockResolvedValueOnce([]);

      render(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('No tasks found')).toBeInTheDocument();
      });
    });
  });

  describe('User Authentication State', () => {
    test('displays user name in header', async () => {
      render(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('Tasks assigned to Test User')).toBeInTheDocument();
      });
    });
  });

  describe('Data Edge Cases', () => {
    test('handles tasks with different date formats', async () => {
      const taskWithStringDate = {
        ...mockTasks[0],
        id: 'task-string-date',
        title: 'String Date Task',
        dueDate: '2025-12-31'
      };

      const taskWithTimestamp = {
        ...mockTasks[0],
        id: 'task-timestamp',
        title: 'Timestamp Task',
        dueDate: { seconds: 1735689600 }
      };

      const mockApi = require('../../../lib/api');
      mockApi.listAssignedTasks.mockResolvedValueOnce([taskWithStringDate, taskWithTimestamp]);

      render(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('String Date Task')).toBeInTheDocument();
        expect(screen.getByText('Timestamp Task')).toBeInTheDocument();
      });
    });

    test('handles tasks with null or missing priority', async () => {
      const taskWithNullPriority = {
        ...mockTasks[0],
        id: 'task-null-priority',
        title: 'Null Priority Task',
        priority: null
      };

      const mockApi = require('../../../lib/api');
      mockApi.listAssignedTasks.mockResolvedValueOnce([taskWithNullPriority]);

      render(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('Null Priority Task')).toBeInTheDocument();
      });
    });

    test('calculates overdue tasks correctly', async () => {
      const overdueTask = {
        ...mockTasks[0],
        id: 'overdue-task',
        title: 'Overdue Task',
        dueDate: new Date('2020-01-01').toISOString(),
        status: 'in_progress'
      };

      const mockApi = require('../../../lib/api');
      mockApi.listAssignedTasks.mockResolvedValueOnce([overdueTask]);

      render(<TasksPage />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // Overdue count
      });
    });
  });

  describe('UI Component Integration', () => {
    test('renders select components for filtering', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        const selects = screen.getAllByTestId('select');
        expect(selects.length).toBeGreaterThan(0);
      });
    });

    test('displays task priority badges', async () => {
      render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getAllByTestId('badge').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Component Cleanup', () => {
    test('handles component unmounting gracefully', async () => {
      const { unmount } = render(<TasksPage />);
      
      await waitFor(() => {
        expect(screen.getByText('My Tasks')).toBeInTheDocument();
      });

      // Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });
  });
});