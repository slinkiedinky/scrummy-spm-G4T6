import { auth } from "./firebase";

// ---- Standalone Task Comments ----
export async function listStandaloneComments(taskId) {
  const r = await fetch(`${API}/standalone-tasks/${taskId}/comments`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Failed to load comments (${r.status})`);
  return r.json();
}

export async function addStandaloneComment(taskId, payload) {
  const r = await fetch(`${API}/standalone-tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Failed to add comment (${r.status})`);
  return r.json();
}

export async function editStandaloneComment(taskId, commentId, payload) {
  const r = await fetch(
    `${API}/standalone-tasks/${taskId}/comments/${commentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!r.ok) throw new Error(`Failed to edit comment (${r.status})`);
  return r.json();
}

export async function deleteStandaloneComment(taskId, commentId) {
  const r = await fetch(
    `${API}/standalone-tasks/${taskId}/comments/${commentId}`,
    {
      method: "DELETE",
    }
  );
  if (!r.ok) throw new Error(`Failed to delete comment (${r.status})`);
  return r.json();
}
// ---- Comments ----
export async function listComments(projectId, taskId) {
  const r = await fetch(
    `${API}/tasks/${taskId}/comments?project_id=${projectId}`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error(`Failed to load comments (${r.status})`);
  return r.json();
}

export async function addComment(projectId, taskId, payload) {
  const r = await fetch(
    `${API}/tasks/${taskId}/comments?project_id=${projectId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!r.ok) throw new Error(`Failed to add comment (${r.status})`);
  return r.json();
}

export async function editComment(projectId, taskId, commentId, payload) {
  const r = await fetch(
    `${API}/tasks/${taskId}/comments/${commentId}?project_id=${projectId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!r.ok) throw new Error(`Failed to edit comment (${r.status})`);
  return r.json();
}

export async function deleteComment(projectId, taskId, commentId) {
  const r = await fetch(
    `${API}/tasks/${taskId}/comments/${commentId}?project_id=${projectId}`,
    {
      method: "DELETE",
    }
  );
  if (!r.ok) throw new Error(`Failed to delete comment (${r.status})`);
  return r.json();
}

// ---- Subtask Comments ----
export async function listSubtaskComments(projectId, taskId, subtaskId) {
  const r = await fetch(
    `${API}/tasks/${taskId}/subtasks/${subtaskId}/comments?project_id=${projectId}`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error(`Failed to load subtask comments (${r.status})`);
  return r.json();
}

export async function addSubtaskComment(projectId, taskId, subtaskId, payload) {
  const r = await fetch(
    `${API}/tasks/${taskId}/subtasks/${subtaskId}/comments?project_id=${projectId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!r.ok) throw new Error(`Failed to add subtask comment (${r.status})`);
  return r.json();
}

export async function editSubtaskComment(
  projectId,
  taskId,
  subtaskId,
  commentId,
  payload
) {
  const r = await fetch(
    `${API}/tasks/${taskId}/subtasks/${subtaskId}/comments/${commentId}?project_id=${projectId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!r.ok) throw new Error(`Failed to edit subtask comment (${r.status})`);
  return r.json();
}

export async function deleteSubtaskComment(
  projectId,
  taskId,
  subtaskId,
  commentId
) {
  const r = await fetch(
    `${API}/tasks/${taskId}/subtasks/${subtaskId}/comments/${commentId}?project_id=${projectId}`,
    {
      method: "DELETE",
    }
  );
  if (!r.ok) throw new Error(`Failed to delete subtask comment (${r.status})`);
  return r.json();
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

// ---- Projects ----
export async function listProjects(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API}/projects/${qs ? `?${qs}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to load projects (${r.status})`);
  return r.json();
}

export async function getProject(id, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API}/projects/${id}${qs ? `?${qs}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error ||
      data?.message ||
      text ||
      `Project request failed (${r.status})`;
    throw new Error(message);
  }
  return data;
}

export async function createProject(payload) {
  const r = await fetch(`${API}/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error || data?.message || text || `Create failed (${r.status})`;
    throw new Error(message);
  }
  return data; // { id, message }
}

export async function updateProject(id, patch) {
  // Add current user ID for backend authorization
  const payload = { ...patch };
  try {
    const user = auth?.currentUser;
    if (user && !payload.userId) {
      payload.userId = user.uid;
    }
  } catch (e) {
    /* best-effort */
  }

  const r = await fetch(`${API}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Update failed (${r.status})`);
  return r.json();
}

export async function deleteProject(id) {
  const r = await fetch(`${API}/projects/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`Delete failed (${r.status})`);
  return r.json();
}

// ---- Users ----
export async function listUsers() {
  const r = await fetch(`${API}/users/`, { cache: "no-store" });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error ||
      data?.message ||
      text ||
      `Failed to load users (${r.status})`;
    throw new Error(message);
  }
  return data || [];
}

// Tasks -------------------------------------------------------
export const listTasks = async (projectId, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const url = `${API}/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error || data?.message || text || "Failed to load tasks";
    throw new Error(message);
  }
  return data;
};

export const getTask = async (projectId, taskId) => {
  const r = await fetch(`${API}/projects/${projectId}/tasks/${taskId}`);
  if (!r.ok) throw new Error("Failed to load task");
  return await r.json();
};

export const createTask = async (projectId, payload) => {
  const r = await fetch(`${API}/projects/${projectId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error || data?.message || text || "Create task failed";
    throw new Error(message);
  }
  return data;
};

export const updateTask = async (projectId, taskId, patch) => {
  try {
    const user = auth?.currentUser;
    if (user && !patch?.updatedBy && !patch?.userId && !patch?.currentUserId) {
      patch = { ...patch, updatedBy: user.uid };
    }
  } catch (e) {
    // best-effort
  }

  const r = await fetch(`${API}/projects/${projectId}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("Update task failed");
  return r.json();
};

export const deleteTask = async (projectId, taskId) => {
  // Get current user id for backend authorization
  let userId = "";
  try {
    const user = auth?.currentUser;
    if (user) userId = user.uid;
  } catch (e) {
    /* best-effort */
  }

  const r = await fetch(`${API}/projects/${projectId}/tasks/${taskId}?userId=${userId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("Delete task failed");
  return r.json();
};

export const listAssignedTasks = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const url = `${API}/projects/assigned/tasks${qs ? `?${qs}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error || data?.message || text || "Failed to load assigned tasks";
    throw new Error(message);
  }
  return data;
};

// ---- Subtasks ----
export const listSubtasks = async (projectId, taskId) => {
  const url = `${API}/projects/${projectId}/tasks/${taskId}/subtasks`;
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error || data?.message || text || "Failed to load subtasks";
    throw new Error(message);
  }
  return data || [];
};

export const getSubtask = async (projectId, taskId, subtaskId) => {
  const r = await fetch(
    `${API}/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`
  );
  if (!r.ok) throw new Error("Failed to load subtask");
  return await r.json();
};

export const createSubtask = async (projectId, taskId, payload) => {
  const r = await fetch(
    `${API}/projects/${projectId}/tasks/${taskId}/subtasks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message =
      data?.error || data?.message || text || "Create subtask failed";
    throw new Error(message);
  }
  return data;
};

export const updateSubtask = async (projectId, taskId, subtaskId, patch) => {
  const r = await fetch(
    `${API}/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }
  );
  if (!r.ok) throw new Error("Update subtask failed");
  return r.json();
};

export const deleteSubtask = async (projectId, taskId, subtaskId) => {
  const r = await fetch(
    `${API}/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`,
    {
      method: "DELETE",
    }
  );
  if (!r.ok) throw new Error("Delete subtask failed");
  return r.json();
};

// ============================================================================
// STANDALONE TASKS
// ============================================================================

export const createStandaloneTask = async (payload) => {
  const r = await fetch(`${API}/projects/standalone/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Create standalone task failed");
  return r.json();
};

export const listStandaloneTasks = async (ownerId) => {
  const r = await fetch(`${API}/projects/standalone/tasks?ownerId=${ownerId}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("List standalone tasks failed");
  return r.json();
};

export const getStandaloneTask = async (taskId) => {
  const r = await fetch(`${API}/projects/standalone/tasks/${taskId}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("Get standalone task failed");
  return r.json();
};

export const updateStandaloneTask = async (taskId, patch) => {
  const r = await fetch(`${API}/projects/standalone/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("Update standalone task failed");
  return r.json();
};

export const deleteStandaloneTask = async (taskId) => {
  const r = await fetch(`${API}/projects/standalone/tasks/${taskId}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("Delete standalone task failed");
  return r.json();
};

// Standalone task subtasks
export const listStandaloneSubtasks = async (taskId) => {
  const r = await fetch(`${API}/projects/standalone/tasks/${taskId}/subtasks`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("List standalone subtasks failed");
  return r.json();
};

export const createStandaloneSubtask = async (taskId, payload) => {
  const r = await fetch(`${API}/projects/standalone/tasks/${taskId}/subtasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Create standalone subtask failed");
  return r.json();
};

export const getStandaloneSubtask = async (taskId, subtaskId) => {
  const r = await fetch(
    `${API}/projects/standalone/tasks/${taskId}/subtasks/${subtaskId}`,
    {
      cache: "no-store",
    }
  );
  if (!r.ok) throw new Error("Get standalone subtask failed");
  return r.json();
};

export const updateStandaloneSubtask = async (taskId, subtaskId, patch) => {
  const r = await fetch(
    `${API}/projects/standalone/tasks/${taskId}/subtasks/${subtaskId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }
  );
  if (!r.ok) throw new Error("Update standalone subtask failed");
  return r.json();
};

export const deleteStandaloneSubtask = async (taskId, subtaskId) => {
  const r = await fetch(
    `${API}/projects/standalone/tasks/${taskId}/subtasks/${subtaskId}`,
    {
      method: "DELETE",
    }
  );
  if (!r.ok) throw new Error("Delete standalone subtask failed");
  return r.json();
};
