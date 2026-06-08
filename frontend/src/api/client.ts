// backend API クライアント。dev は Vite proxy 経由で /api を叩く。
// 本番などでベース URL を切り替えたい場合は VITE_API_BASE を設定する。
const BASE = import.meta.env.VITE_API_BASE ?? '';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Settings {
  id: string;
  hoursPerDay: number;
  minEstimateDays: number;
  reviewRatio: number;
  reviewMinDays: number;
  defaultUtilization: number;
}

export interface ReferenceFile {
  id: string;
  path: string;
  size: number;
  ext: string | null;
  excerpt: string | null;
}

export interface ReferenceProject {
  id: string;
  name: string;
  rootPath: string;
  note: string | null;
  scannedAt: string | null;
  createdAt: string;
  files?: ReferenceFile[];
  _count?: { files: number };
}

export interface Requirement {
  id: string;
  projectId: string;
  content: string;
  source: string | null;
  createdAt: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface Member {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  hourlyRate: number | null;
  createdAt: string;
}

export interface DelayItem {
  taskId: string;
  name: string;
  assigneeName: string | null;
  expectedProgress: number;
  actualProgress: number;
  behindBy: number;
  isDelayed: boolean;
  latestComment: string | null;
}

export interface DailyReportEntry {
  id: string;
  taskId: string;
  progress: number;
  comment: string | null;
  task?: Task | null;
}

export interface DailyReport {
  id: string;
  projectId: string;
  memberId: string;
  reportDate: string;
  note: string | null;
  createdAt: string;
  member?: Member | null;
  entries?: DailyReportEntry[];
  _count?: { entries: number };
}

export interface DailyReportInput {
  projectId: string;
  memberId: string;
  reportDate: string;
  note?: string;
  entries: { taskId: string; progress: number; comment?: string }[];
}

export interface DelayedMember {
  assigneeId: string;
  name: string;
  totalBehind: number;
  taskIds: string[];
}

export interface RecoveryAction {
  taskId: string;
  taskName: string;
  severity: 'high' | 'medium' | 'low';
  behindBy: number;
  remainingDays: number;
  suggestions: string[];
}

export interface RecoveryPlan {
  delayedCount: number;
  totalRemainingDays: number;
  actions: RecoveryAction[];
}

export interface Task {
  id: string;
  projectId: string;
  requirementId: string | null;
  name: string;
  estimateDays: number;
  utilizationRate: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  progress: number;
  assigneeId: string | null;
  level: number;
  wbsId: string | null;
  parentId: string | null;
  phase: string | null;
  estimateNote: string | null;
  kind: string;
  assignee?: Member | null;
  requirement?: Requirement | null;
}

export interface CreateTaskInput {
  projectId: string;
  requirementId?: string;
  name: string;
  estimateDays?: number;
  utilizationRate?: number;
  plannedStart?: string;
  plannedEnd?: string;
  assigneeId?: string;
  level?: number;
  parentId?: string;
  wbsId?: string;
  phase?: string;
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

  // 全体設定 (US-027)
  getSettings: () => request<Settings>('/api/settings'),
  updateSettings: (input: Omit<Settings, 'id'>) =>
    request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(input) }),

  // projects
  listProjects: () => request<Project[]>('/api/projects'),
  createProject: (input: {
    name: string;
    description?: string;
    kind?: 'new' | 'existing';
    referenceProjectId?: string;
  }) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),

  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  // 参照資料プロジェクト (US-024)
  listReferenceProjects: () => request<ReferenceProject[]>('/api/reference-projects'),
  getReferenceProject: (id: string) => request<ReferenceProject>(`/api/reference-projects/${id}`),
  createReferenceProject: (input: { name: string; rootPath: string; note?: string }) =>
    request<ReferenceProject>('/api/reference-projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  scanReferenceProject: (id: string) =>
    request<{ scanned: number }>(`/api/reference-projects/${id}/scan`, { method: 'POST' }),
  deleteReferenceProject: (id: string) =>
    request<void>(`/api/reference-projects/${id}`, { method: 'DELETE' }),

  // requirements (US-001)
  listRequirements: (projectId: string) =>
    request<Requirement[]>(`/api/requirements?projectId=${encodeURIComponent(projectId)}`),
  createRequirement: (input: { projectId: string; content: string; source?: string }) =>
    request<Requirement>('/api/requirements', { method: 'POST', body: JSON.stringify(input) }),

  // members (US-005)
  listMembers: () => request<Member[]>('/api/members'),
  createMember: (input: { name: string; role?: string; email?: string; hourlyRate?: number }) =>
    request<Member>('/api/members', { method: 'POST', body: JSON.stringify(input) }),
  deleteMember: (id: string) => request<void>(`/api/members/${id}`, { method: 'DELETE' }),

  // holidays (US-006)
  listHolidays: () => request<Holiday[]>('/api/holidays'),
  createHoliday: (input: { date: string; name: string }) =>
    request<Holiday>('/api/holidays', { method: 'POST', body: JSON.stringify(input) }),
  deleteHoliday: (id: string) => request<void>(`/api/holidays/${id}`, { method: 'DELETE' }),
  importHolidays: (year: number) =>
    request<{ year: string; added: number; fetched: number }>(
      `/api/holidays/import?year=${year}`,
      { method: 'POST' },
    ),

  // tasks (US-002〜)
  listTasks: (projectId?: string) =>
    request<Task[]>(`/api/tasks${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  createTask: (input: CreateTaskInput) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  updateTask: (
    id: string,
    patch: Partial<Omit<CreateTaskInput, 'projectId' | 'assigneeId' | 'phase'>> & {
      progress?: number;
      phase?: string | null;
      estimateNote?: string | null;
      assigneeId?: string | null;
    },
  ) => request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // 要件から WBS+標準工程を展開 (US-013)
  expandWbs: (
    requirementId: string,
    input: { targets?: string[]; phases?: string[]; assigneeId?: string } = {},
  ) =>
    request<Task[]>(`/api/requirements/${requirementId}/expand`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // レビュー自動展開 / 効率化調整 (US-014)
  expandReviews: (projectId: string) =>
    request<Task[]>(`/api/projects/${projectId}/expand-reviews`, { method: 'POST' }),
  addEfficiency: (projectId: string, input: { estimateDays: number; note?: string }) =>
    request<Task>(`/api/projects/${projectId}/efficiency`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // 見積 Excel(.xlsx) のダウンロード URL (US-016)
  estimateXlsxUrl: (projectId: string) =>
    `${BASE}/api/projects/${projectId}/estimate.xlsx`,
  // 柔軟な取込 (US-019)
  importRequirementsText: (projectId: string, text: string, expand = true) =>
    request<{ requirements: number; tasks: number }>(
      `/api/projects/${projectId}/import/requirements-text`,
      { method: 'POST', body: JSON.stringify({ text, expand }) },
    ),
  importRequirementsFile: async (projectId: string, file: File, expand = true) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('expand', String(expand));
    const res = await fetch(`${BASE}/api/projects/${projectId}/import/requirements-file`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json() as Promise<{ requirements: number; tasks: number }>;
  },
  importEstimateFile: async (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE}/api/projects/${projectId}/import/estimate-file`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json() as Promise<{ tasks: number }>;
  },

  // 日報 (US-017)
  listDailyReports: (projectId: string) =>
    request<DailyReport[]>(`/api/daily-reports?projectId=${encodeURIComponent(projectId)}`),
  getDailyReport: (id: string) => request<DailyReport>(`/api/daily-reports/${id}`),
  createDailyReport: (input: DailyReportInput) =>
    request<DailyReport>('/api/daily-reports', { method: 'POST', body: JSON.stringify(input) }),
  // ガント初版生成 (US-004)
  generateSchedule: (projectId: string, startDate: string) =>
    request<Task[]>('/api/tasks/schedule', {
      method: 'POST',
      body: JSON.stringify({ projectId, startDate }),
    }),
  // 進捗報告 (US-007 → 進捗率反映 US-008)
  addReport: (taskId: string, input: { memberId: string; progress: number; comment?: string }) =>
    request<unknown>(`/api/tasks/${taskId}/reports`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // 遅延検出 (US-009)
  getDelays: (projectId?: string) =>
    request<DelayItem[]>(
      `/api/tasks/delays${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
    ),
  // 遅れ要員の洗い出し (US-010)
  getDelayedMembers: (projectId?: string) =>
    request<DelayedMember[]>(
      `/api/tasks/delays/members${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
    ),
  // リカバリプラン (US-011)
  getRecoveryPlan: (projectId?: string) =>
    request<RecoveryPlan>(
      `/api/tasks/recovery${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
    ),
};
