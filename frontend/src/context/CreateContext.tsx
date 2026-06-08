import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Project } from '../api/client';

// 新規作成フロー(US-038)で全ステップが共有する「作成中プロジェクト(draft)」。
// localStorage に id を持ち、ステップ間を移動しても同じプロジェクトを編集し続ける。
interface CreateCtx {
  draftId: string;
  draft: Project | null;
  loaded: boolean;
  setDraft: (id: string) => void;
  clearDraft: () => void;
  reload: () => void;
}

const Ctx = createContext<CreateCtx | null>(null);
const STORAGE_KEY = 'reqtrack.createProjectId';

export function CreateProvider({ children }: { children: ReactNode }) {
  const [draftId, setDraftId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [draft, setDraftProject] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);

  function setDraft(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setDraftId(id);
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY);
    setDraftId('');
    setDraftProject(null);
  }

  function reload() {
    if (!draftId) {
      setDraftProject(null);
      setLoaded(true);
      return;
    }
    api
      .listProjects()
      .then((ps) => {
        const found = ps.find((p) => p.id === draftId) ?? null;
        setDraftProject(found);
        // 参照先が消えていたら draft を解除
        if (!found) localStorage.removeItem(STORAGE_KEY);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  useEffect(reload, [draftId]);

  return (
    <Ctx.Provider value={{ draftId, draft, loaded, setDraft, clearDraft, reload }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCreate(): CreateCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCreate must be used within CreateProvider');
  return v;
}
