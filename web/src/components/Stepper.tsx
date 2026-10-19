import { Check, Circle, Loader2, X } from 'lucide-react';

export type StepState = 'pending' | 'active' | 'done' | 'failed';
export function Stepper({ steps }: { steps: { label: string; state: StepState; note?: string }[] }) {
  return (
    <div className="stepper">
      {steps.map((s) => (
        <div key={s.label} className={`st ${s.state === 'pending' ? '' : s.state}`}>
          <span className="ico">
            {s.state === 'done' ? <Check size={17} /> : s.state === 'active' ? <Loader2 size={17} className="spin" />
              : s.state === 'failed' ? <X size={17} /> : <Circle size={17} />}
          </span>
          <span>{s.label}{s.note && <span className="small muted" style={{ fontWeight: 400 }}> {s.note}</span>}</span>
        </div>
      ))}
    </div>
  );
}
