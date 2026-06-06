// backend API クライアント。dev は Vite proxy 経由で /api を叩く。
// 本番などでベース URL を切り替えたい場合は VITE_API_BASE を設定する。
const BASE = import.meta.env.VITE_API_BASE ?? '';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Requirement {
  id: string;
  projectId: string;
  content: string;
  source: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  // projects
  listProjects: () => request<Project[]>('/api/projects'),
  createProject: (input: { name: string; description?: string }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),

  // requirements (US-001)
  listRequirements: (projectId: string) =>
    request<Requirement[]>(`/api/requirements?projectId=${encodeURIComponent(projectId)}`),
  createRequirement: (input: { projectId: string; content: string; source?: string }) =>
    request<Requirement>('/api/requirements', { method: 'POST', body: JSON.stringify(input) }),

  // members
  listMembers: () => request<Member[]>('/api/members'),
};
