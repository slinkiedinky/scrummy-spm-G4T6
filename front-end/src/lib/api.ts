export async function fetchProjects() {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
    return res.json();
  }
  