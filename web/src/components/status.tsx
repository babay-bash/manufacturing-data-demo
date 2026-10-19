/** Status polling (GET /api/status every 3s) shared through context, plus the top-bar pill. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Status } from '../api/types';
import { Badge } from './ui';

interface StatusCtx { status: Status | null; error: boolean; refresh: () => void }
const Ctx = createContext<StatusCtx>({ status: null, error: false, refresh: () => {} });
export const useStatus = () => useContext(Ctx);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(() => {
    api.status().then((s) => { setStatus(s); setError(false); }).catch(() => setError(true));
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);
  return <Ctx.Provider value={{ status, error, refresh }}>{children}</Ctx.Provider>;
}

export function StatusPill() {
  const { status, error } = useStatus();
  if (error || !status) return <Badge tone="bad"><span className="pill-dot" />{error ? 'API offline' : 'connecting…'}</Badge>;
  if (status.running) return <Badge tone="accent"><span className="pill-dot pulse" />running</Badge>;
  if (status.ready) return <Badge tone="ok"><span className="pill-dot" />ready</Badge>;
  return <Badge tone="warn"><span className="pill-dot" />not built</Badge>;
}
