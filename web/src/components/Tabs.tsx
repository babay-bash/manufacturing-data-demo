import type { ReactNode } from 'react';

export interface TabDef { id: string; label: string; icon: ReactNode }

export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} className="tab" onClick={() => onChange(t.id)}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}
