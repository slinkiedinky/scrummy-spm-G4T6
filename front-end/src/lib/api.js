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
    const message = data?.error || data?.message || text || `Project request failed (${r.status})`;
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
    const message = data?.error || data?.message || text || `Create failed (${r.status})`;
    throw new Error(message);
  }
  return data; // { id, message }
}

export async function updateProject(id, patch) {
  const r = await fetch(`${API}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
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
    const message = data?.error || data?.message || text || `Failed to load users (${r.status})`;
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
    const message = data?.error || data?.message || text || "Failed to load tasks";
    throw new Error(message);
  }
  return data;
};

export const createTask = async (projectId, payload) => {
  const r = await fetch(`${API}/projects/${projectId}/tasks`, {
    method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload)
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!r.ok) {
    const message = data?.error || data?.message || text || "Create task failed";
    throw new Error(message);
  }
  return data;
};

export const updateTask = async (projectId, taskId, patch) => {
  const r = await fetch(`${API}/projects/${projectId}/tasks/${taskId}`, {
    method: "PUT", headers: { "Content-Type":"application/json" }, body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error("Update task failed");
  return r.json();
};

export const deleteTask = async (projectId, taskId) => {
  const r = await fetch(`${API}/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
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
    const message = data?.error || data?.message || text || "Failed to load assigned tasks";
    throw new Error(message);
  }
  return data;
};
