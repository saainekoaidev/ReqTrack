// backend API クライアント。dev は Vite proxy 経由で /api を叩く。
// 本番などでベース URL を切り替えたい場合は VITE_API_BASE を設定する。
const BASE = import.meta.env.VITE_API_BASE ?? '';

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
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  listMembers: () => request<Member[]>('/api/members'),
};
