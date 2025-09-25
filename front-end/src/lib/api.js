const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

// ---- Projects ----
export async function listProjects(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API}/projects/${qs ? `?${qs}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to load projects (${r.status})`);
  return r.json();
}

export async function getProject(id) {
  const r = await fetch(`${API}/projects/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Project not found (${id})`);
  return r.json();
}

export async function createProject(payload) {
  const r = await fetch(`${API}/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Create failed (${r.status})`);
  return r.json(); // { id, message }
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

// Tasks -------------------------------------------------------
export const listTasks = async (projectId) => {
  const r = await fetch(`${API}/projects/${projectId}/tasks`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load tasks");
  return r.json();
};

export const createTask = async (projectId, payload) => {
  const r = await fetch(`${API}/projects/${projectId}/tasks`, {
    method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error("Create task failed");
  return r.json();
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