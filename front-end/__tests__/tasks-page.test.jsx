import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TasksPage from "@/app/tasks/page";
import { onAuthStateChanged } from "firebase/auth";
import {
  deleteTask,
  getTask,
  listAssignedTasks,
  listUsers,
  updateTask,
  listStandaloneTasks,
  createStandaloneTask,
  getStandaloneTask,
  updateStandaloneTask,
  deleteStandaloneTask,
  listStandaloneSubtasks,
  getStandaloneSubtask,
  updateStandaloneSubtask,
  deleteStandaloneSubtask,
  listSubtasks,
  getSubtask,
  updateSubtask,
  deleteSubtask,
  getProject,
} from "@/lib/api";

const taskDetailModalSpy = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock("@/components/TaskDetailModal", () => ({
  TaskDetailModal: (props) => {
    taskDetailModalSpy(props);
    return (
      <div data-testid="task-detail-modal">
        <span>{props.task?.title}</span>
        <button
          type="button"
          onClick={props.onClose}
          data-testid="close-task-detail"
        >
          close-modal
        </button>
        <button
          type="button"
          onClick={async () => {
            if (props.onSubtaskChange) {
              await props.onSubtaskChange();
            }
          }}
          data-testid="trigger-subtask-change"
        >
          trigger-subtask-change
        </button>
      </div>
    );
  },
}));

jest.mock("@/lib/api", () => ({
  listAssignedTasks: jest.fn(),
  listUsers: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  getTask: jest.fn(),
  listStandaloneTasks: jest.fn(),
  createStandaloneTask: jest.fn(),
  getStandaloneTask: jest.fn(),
  updateStandaloneTask: jest.fn(),
  deleteStandaloneTask: jest.fn(),
  listStandaloneSubtasks: jest.fn(),
  getStandaloneSubtask: jest.fn(),
  updateStandaloneSubtask: jest.fn(),
  deleteStandaloneSubtask: jest.fn(),
  listSubtasks: jest.fn(),
  getSubtask: jest.fn(),
  updateSubtask: jest.fn(),
  deleteSubtask: jest.fn(),
  getProject: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const SelectContext = React.createContext(null);

  function Select({ value, onValueChange, children }) {
    const [open, setOpen] = React.useState(false);
    const [label, setLabel] = React.useState("");

    const contextValue = React.useMemo(
      () => ({
        value,
        onValueChange,
        open,
        setOpen,
        label,
        setLabel,
      }),
      [value, onValueChange, open, label]
    );

    return (
      <SelectContext.Provider value={contextValue}>
        <div data-testid="mock-select">{children}</div>
      </SelectContext.Provider>
    );
  }

  function SelectTrigger({ children, ...props }) {
    const { setOpen } = React.useContext(SelectContext);
    return (
      <button
        type="button"
        data-slot="select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        {...props}
      >
        {children}
      </button>
    );
  }

  function SelectContent({ children }) {
    const { open } = React.useContext(SelectContext);
    if (!open) return null;
    return <div>{children}</div>;
  }

  function SelectItem({ value, children, ...props }) {
    const { onValueChange, setOpen, setLabel } =
      React.useContext(SelectContext);
    return (
      <button
        type="button"
        onClick={() => {
          onValueChange(value);
          setLabel(
            typeof children === "string" ? children : String(value ?? "")
          );
          setOpen(false);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }

  function SelectValue({ placeholder }) {
    const { label, value } = React.useContext(SelectContext);
    return <span>{label || value || placeholder}</span>;
  }

  return {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
  };
});

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe("TasksPage", () => {
  let authStateCallback;
  let user;

  const createTasks = () => [
    {
      id: "task-1",
      projectId: "proj-1",
      projectName: "Project Phoenix",
      title: "Draft documentation",
      description: "Document the new release",
      status: "To-Do",
      priority: 7,
      dueDate: "2000-01-05T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      tags: ["docs", "writing"],
      collaboratorsIds: ["user-2"],
      assigneeId: "user-1",
    },
    {
      id: "task-2",
      projectId: "proj-2",
      projectName: "Project Pegasus",
      title: "Fix login bug",
      description: "Resolve the login race condition",
      status: "Completed",
      priority: 3,
      dueDate: "2999-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      tags: ["bug"],
      collaboratorsIds: [],
      assigneeId: "user-1",
    },
  ];

  const createUsers = () => [
    {
      id: "user-1",
      fullName: "Alice Example",
      email: "alice@example.com",
    },
    {
      id: "user-2",
      fullName: "Bob Example",
      email: "bob@example.com",
    },
  ];

  const renderPage = () => render(<TasksPage />);

  const advanceAuthState = async (userInfo) => {
    await act(async () => {
      authStateCallback?.(userInfo);
    });
  };

  beforeEach(() => {
    user = userEvent.setup();
    authStateCallback = undefined;
    taskDetailModalSpy.mockClear();
    onAuthStateChanged.mockImplementation((_, callback) => {
      authStateCallback = callback;
      return jest.fn();
    });
    listAssignedTasks.mockReset();
    listUsers.mockReset();
    updateTask.mockReset();
    deleteTask.mockReset();
    getTask.mockReset();
    listStandaloneTasks.mockReset();
    createStandaloneTask.mockReset();
    getStandaloneTask.mockReset();
    updateStandaloneTask.mockReset();
    deleteStandaloneTask.mockReset();
    listStandaloneSubtasks.mockReset();
    getStandaloneSubtask.mockReset();
    updateStandaloneSubtask.mockReset();
    deleteStandaloneSubtask.mockReset();
    listSubtasks.mockReset();
    getSubtask.mockReset();
    updateSubtask.mockReset();
    deleteSubtask.mockReset();
    getProject.mockReset();
    listAssignedTasks.mockResolvedValue([]);
    listUsers.mockResolvedValue([]);
    listStandaloneTasks.mockResolvedValue([]);
    listStandaloneSubtasks.mockResolvedValue([]);
    createStandaloneTask.mockResolvedValue({ id: "standalone" });
    getStandaloneTask.mockResolvedValue(null);
    updateStandaloneTask.mockResolvedValue({});
    deleteStandaloneTask.mockResolvedValue({});
    getStandaloneSubtask.mockResolvedValue(null);
    updateStandaloneSubtask.mockResolvedValue({});
    deleteStandaloneSubtask.mockResolvedValue({});
    listSubtasks.mockResolvedValue([]);
    getSubtask.mockResolvedValue({});
    updateSubtask.mockResolvedValue({});
    deleteSubtask.mockResolvedValue({});
    getProject.mockResolvedValue({
      id: "proj-1",
      name: "Project Phoenix",
      teamIds: ["user-1"],
    });
  });

  it("shows the session validation state before authentication resolves", () => {
    renderPage();
    expect(
      screen.getByText(/Validating session…/i)
    ).toBeInTheDocument();
    expect(listAssignedTasks).not.toHaveBeenCalled();
  });

  it("renders grouped tasks, stats, and collaborator labels after loading data", async () => {
    listAssignedTasks.mockResolvedValueOnce(createTasks());
    listUsers.mockResolvedValueOnce(createUsers());

    renderPage();

    await advanceAuthState({
      uid: "user-1",
      displayName: "Alice Example",
      email: "alice@example.com",
    });

    await waitFor(() =>
      expect(screen.getByText("Project Phoenix")).toBeInTheDocument()
    );

    expect(listAssignedTasks).toHaveBeenCalledWith({ assignedTo: "user-1" });
    expect(listUsers).toHaveBeenCalledTimes(1);

    expect(
      screen.getByText(/Tasks assigned to Alice Example/)
    ).toBeInTheDocument();

    const totalCard = screen.getByText("Total tasks").closest("div");
    expect(within(totalCard).getByText("2")).toBeInTheDocument();

    const overdueCard = screen.getByText("Overdue").closest("div");
    expect(within(overdueCard).getByText("1")).toBeInTheDocument();

    const projectCard = screen.getByText("Active projects").closest("div");
    expect(within(projectCard).getByText("2")).toBeInTheDocument();

    expect(screen.getByText("Draft documentation")).toBeInTheDocument();
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.getByText("Bob Example")).toBeInTheDocument();
    expect(screen.getByText("Priority 7")).toBeInTheDocument();
    expect(screen.getByText("Priority 3")).toBeInTheDocument();
  });

  it("filters tasks via the search input", async () => {
    listAssignedTasks.mockResolvedValueOnce(createTasks());
    listUsers.mockResolvedValueOnce(createUsers());

    renderPage();
    await advanceAuthState({
      uid: "user-1",
      displayName: "Alice Example",
    });

    await waitFor(() =>
      expect(screen.getByText("Project Phoenix")).toBeInTheDocument()
    );

    const searchInput = screen.getByPlaceholderText(
      /Search by title, description, or project/i
    );

    await user.type(searchInput, "login");

    expect(screen.queryByText("Draft documentation")).not.toBeInTheDocument();
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "nothing matches");

    expect(screen.getByText(/No tasks found/i)).toBeInTheDocument();
  });

  it("applies filter dropdown selections", async () => {
    listAssignedTasks.mockResolvedValueOnce(createTasks());
    listUsers.mockResolvedValueOnce(createUsers());

    renderPage();
    await advanceAuthState({
      uid: "user-1",
      email: "alice@example.com",
    });

    await waitFor(() =>
      expect(screen.getByText("Project Phoenix")).toBeInTheDocument()
    );

    const selectRoots = document.querySelectorAll("[data-testid='mock-select']");
    expect(selectRoots).toHaveLength(3);

    const projectSelect = selectRoots[2];
    const projectTrigger = projectSelect.querySelector(
      "[data-slot='select-trigger']"
    );
    await user.click(projectTrigger);
    await user.click(
      within(projectSelect).getByRole("button", {
        name: "Project Phoenix",
      })
    );

    expect(screen.getByText("Draft documentation")).toBeInTheDocument();
    expect(
      screen.queryByText("Fix login bug")
    ).not.toBeInTheDocument();

    await user.click(projectTrigger);
    await user.click(
      within(projectSelect).getByRole("button", { name: "All Projects" })
    );

    const statusSelect = selectRoots[1];
    const statusTrigger = statusSelect.querySelector(
      "[data-slot='select-trigger']"
    );
    await user.click(statusTrigger);
    await user.click(
      within(statusSelect).getByRole("button", { name: "Completed" })
    );

    expect(
      screen.queryByText("Draft documentation")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });

  it("reloads tasks when the refresh button is pressed", async () => {
    listAssignedTasks
      .mockResolvedValueOnce(createTasks())
      .mockResolvedValueOnce([
        {
          id: "task-3",
          projectId: "proj-3",
          projectName: "Project Atlas",
          title: "Write onboarding guide",
          description: "Explain the new onboarding flow",
          status: "in progress",
          priority: 5,
          dueDate: "2999-01-01T00:00:00.000Z",
          updatedAt: "2024-01-03T00:00:00.000Z",
          tags: ["docs"],
          collaboratorsIds: [],
          assigneeId: "user-1",
        },
      ]);
    listUsers.mockResolvedValue(createUsers());

    renderPage();
    await advanceAuthState({
      uid: "user-1",
      email: "alice@example.com",
    });

    await waitFor(() =>
      expect(screen.getByText("Project Phoenix")).toBeInTheDocument()
    );

    const refreshButton = screen.getByRole("button", { name: /Refresh/i });
    await user.click(refreshButton);

    await waitFor(() =>
      expect(screen.getByText("Project Atlas")).toBeInTheDocument()
    );
    expect(screen.queryByText("Draft documentation")).not.toBeInTheDocument();
    expect(listAssignedTasks).toHaveBeenCalledTimes(2);
  });

  it("refreshes task details after the subtask callback runs", async () => {
    listAssignedTasks.mockResolvedValueOnce(createTasks());
    listUsers.mockResolvedValueOnce(createUsers());
    getTask.mockResolvedValue({
      id: "task-1",
      projectId: "proj-1",
      projectName: "Project Phoenix",
      title: "Draft documentation (updated)",
      description: "Updated description",
      status: "in progress",
      priority: 8,
      dueDate: "2999-01-01T00:00:00.000Z",
      updatedAt: "2024-02-01T00:00:00.000Z",
      collaboratorsIds: ["user-2"],
      assigneeId: "user-2",
      createdBy: "user-1",
    });

    renderPage();
    await advanceAuthState({
      uid: "user-1",
      email: "alice@example.com",
    });

    await waitFor(() =>
      expect(screen.getByText("Project Phoenix")).toBeInTheDocument()
    );

    const taskButton = screen.getByText("Draft documentation");
    await user.click(taskButton);

    await waitFor(() =>
      expect(screen.getByTestId("task-detail-modal")).toBeInTheDocument()
    );

    const latestCall =
      taskDetailModalSpy.mock.calls[taskDetailModalSpy.mock.calls.length - 1];
    const modalProps = latestCall?.[0];
    expect(modalProps?.task?.title).toBe("Draft documentation");

    jest.useFakeTimers();
    await act(async () => {
      const promise = modalProps.onSubtaskChange();
      jest.advanceTimersByTime(300);
      await promise;
    });
    jest.useRealTimers();

    expect(getTask).toHaveBeenCalledWith("proj-1", "task-1");

    await waitFor(() => {
      const lastProps =
        taskDetailModalSpy.mock.calls[taskDetailModalSpy.mock.calls.length - 1]?.[0];
      expect(lastProps.task.title).toBe("Draft documentation (updated)");
      expect(lastProps.task.assigneeSummary?.name).toBe("Bob Example");
    });
  });

  it("shows a fallback message when teammate details fail to load", async () => {
    listAssignedTasks.mockResolvedValueOnce(createTasks());
    listUsers.mockRejectedValueOnce(new Error("boom"));

    renderPage();
    await advanceAuthState({
      uid: "user-1",
      email: "alice@example.com",
    });

    await waitFor(() =>
      expect(screen.getByText("Project Phoenix")).toBeInTheDocument()
    );

    expect(
      screen.getByText(
        /Unable to load teammate details. Collaborator names may be limited./i
      )
    ).toBeInTheDocument();
  });
});
