/** Logo chips. Brand marks come from simple-icons (CC0 paths, imported individually); generic ones from lucide.
 *  Not in simple-icons v16: Amazon S3, dbt, Apache Iceberg, Debezium -> these use a lucide icon or a plain text mark. */
import {
  Archive, BarChart3, Bot, Boxes, Building2, Cpu, DatabaseZap, FileText, FlaskConical, Layers, Radio, Server,
  ShieldCheck, Table2, TestTube2, Workflow, Files, Code2, Gauge, ShieldAlert, ListChecks,
} from 'lucide-react';
import { siApachekafka, siDatabricks, siDuckdb, siFastapi, siPython, siReact, siSnowflake } from 'simple-icons';

const BRANDS = {
  kafka: siApachekafka, snowflake: siSnowflake, databricks: siDatabricks,
  duckdb: siDuckdb, python: siPython, fastapi: siFastapi, react: siReact,
} as const;

const GENERIC = {
  sensors: Radio, gateway: Server, erp: Building2, cdc: DatabaseZap, archive: Archive, raw: Layers, canonical: Table2,
  metrics: Gauge, bi: BarChart3, ai: Bot, shield: ShieldCheck, regression: TestTube2, questions: ListChecks,
  files: Files, code: Code2, cpu: Cpu, flask: FlaskConical, doc: FileText, boxes: Boxes, flow: Workflow, alert: ShieldAlert,
} as const;

export type LogoKind = keyof typeof BRANDS | keyof typeof GENERIC | 'dbt';

export function Logo({ kind, size = 'md' }: { kind: LogoKind; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 15 : 20;
  if (kind in BRANDS) {
    const icon = BRANDS[kind as keyof typeof BRANDS];
    return (
      <span className={`logo-chip ${size}`} title={icon.title}>
        <svg viewBox="0 0 24 24" width={px} height={px} role="img" aria-label={icon.title}>
          <path d={icon.path} fill={`#${icon.hex}`} />
        </svg>
      </span>
    );
  }
  if (kind === 'dbt') {
    return <span className={`logo-chip ${size}`} title="dbt" style={{ color: '#ff694a', fontWeight: 800, fontSize: size === 'sm' ? 10 : 12 }}>dbt</span>;
  }
  const Icon = GENERIC[kind as keyof typeof GENERIC];
  return <span className={`logo-chip generic ${size}`}><Icon size={px} /></span>;
}
