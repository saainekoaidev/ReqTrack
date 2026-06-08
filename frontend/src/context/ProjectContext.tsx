import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Project } from '../api/client';

// 進捗管理系で共有する「選択中プロジェクト」(US-021 / ADR 0008)。
interface ProjectCtx {
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  reload: () => void;
  loaded: boolean;
}

const Ctx = createContext<ProjectCtx | null>(null);
const STORAGE_KEY = 'reqtrack.projectId';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [projectId, setProjectIdState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  );

  function setProjectId(id: string) {
    setProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  function reload() {
    api
      .listProjects()
      .then((ps) => {
        setProjects(ps);
        setProjectIdState((cur) => {
          if (cur && ps.some((p) => p.id === cur)) return cur;
          const next = ps[0]?.id ?? '';
          if (next) localStorage.setItem(STORAGE_KEY, next);
          return next;
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  useEffect(reload, []);

  return (
    <Ctx.Provider value={{ projects, projectId, setProjectId, reload, loaded }}>{children}</Ctx.Provider>
  );
}

export function useProject(): ProjectCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProject must be used within ProjectProvider');
  return v;
}
