"""Generate the deterministic synthetic fixtures under data/landed/.

Developer-only script: the generated files are committed, so the demo never
generates or downloads data at runtime. Re-running with the same seed produces
byte-identical outputs.

All data are SYNTHETIC. Facilities, products, rates and volumes are invented
design targets and make no claim about any real client.

Usage:  uv run python scripts/generate_fixtures.py
"""

from __future__ import annotations

import csv
import hashlib
import json
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pyarrow as pa
import pyarrow.parquet as pq

SEED = 20261019
ROOT = Path(__file__).resolve().parents[1]
LANDED = ROOT / "data" / "landed"

START = date(2026, 6, 1)
DAYS = 90
INTERVAL_MIN = 15
SHIFT_MIN = 720
INTERVALS_PER_SHIFT = SHIFT_MIN // INTERVAL_MIN

# --------------------------------------------------------------------------
# Reference / master data
# --------------------------------------------------------------------------
FACILITIES = [
    # id, name, country, tz, legacy MES site code
    ("F-OH", "Dayton Assembly", "US", "America/New_York", "DAY"),
    ("F-MX", "Monterrey Components", "MX", "America/Monterrey", "MTY"),
    ("F-DE", "Stuttgart Precision", "DE", "Europe/Berlin", "STR"),
]
LINE_TYPES = {
    "L1": ("Motor Assembly", ["P-100", "P-101", "P-102", "P-103"]),
    "L2": ("Drive & Controller Assembly", ["P-104", "P-105", "P-106", "P-107"]),
}
PRODUCTS = [
    # id, name, family, std material cost per unit USD, ideal cycle seconds
    ("P-100", "Servo Motor 1kW", "Motors", 182.0, 62),
    ("P-101", "Servo Motor 3kW", "Motors", 311.0, 84),
    ("P-102", "Induction Motor 5kW", "Motors", 268.0, 96),
    ("P-103", "Gear Motor GM-40", "Motors", 224.0, 75),
    ("P-104", "Variable Frequency Drive 7.5kW", "Drives", 405.0, 118),
    ("P-105", "Variable Frequency Drive 15kW", "Drives", 612.0, 140),
    ("P-106", "Motion Controller MC-2", "Controllers", 254.0, 70),
    ("P-107", "Edge I/O Module", "Controllers", 96.0, 45),
]
SHIFTS = [("DAY", "Day shift", time(6, 0)), ("NIGHT", "Night shift", time(18, 0))]
MACHINE_TYPES = ["Winding cell", "Assembly robot", "End-of-line tester"]
RATED_KW = {"Winding cell": 38.0, "Assembly robot": 22.0, "End-of-line tester": 14.0}

TARIFFS = [
    # facility, effective_from, effective_to (inclusive), usd_per_kwh
    ("F-OH", date(2026, 1, 1), date(2026, 6, 30), 0.082),
    ("F-OH", date(2026, 7, 1), date(2026, 9, 30), 0.094),  # summer peak rate
    ("F-MX", date(2026, 1, 1), date(2026, 7, 31), 0.071),
    ("F-MX", date(2026, 8, 1), date(2026, 12, 31), 0.076),
    ("F-DE", date(2026, 1, 1), date(2026, 7, 14), 0.212),
    ("F-DE", date(2026, 7, 15), date(2026, 12, 31), 0.188),  # renegotiated contract
]

# Story knobs (documented in docs/data_dictionary.md)
INEFFICIENT_LINE = "MX-L2"            # persistent downtime + slow cycles
ENERGY_HOG = "M-OH-L1-01"             # winding cell drawing 1.6x its peers
QUALITY_EXCURSION = ("DE-L2", "P-105", date(2026, 7, 6), date(2026, 7, 26))
DE_WH_CUTOVER = date(2026, 7, 15)     # gateway firmware v2 reports Wh instead of kWh
UNMAPPED_TAG = "MTY-PLC-0299"         # new machine not yet in master data
COPPER_STEP = date(2026, 7, 1)        # +6% material cost on motors

DEFECT_CODES = ["WINDING_SHORT", "BEARING_NOISE", "TORQUE_OUT_OF_SPEC",
                "PCB_SOLDER", "FIRMWARE_FLASH", "HOUSING_CRACK", "INSULATION_FAIL"]


@dataclass(frozen=True)
class Machine:
    machine_id: str
    line_id: str
    facility_id: str
    machine_type: str
    rated_kw: float
    telemetry_tag: str
    mes_code: str


def stable_id(*parts: object) -> str:
    """Deterministic short hash id, stable across runs and Python versions."""
    return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()[:16]


def iso(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_machines() -> list[Machine]:
    out = []
    for fac_id, _, _, _, site in FACILITIES:
        short = fac_id.split("-")[1]
        for ln in ("L1", "L2"):
            for i, mtype in enumerate(MACHINE_TYPES, start=1):
                mid = f"M-{short}-{ln}-{i:02d}"
                kw = RATED_KW[mtype] * (1.6 if mid == ENERGY_HOG else 1.0)
                out.append(Machine(
                    machine_id=mid, line_id=f"{short}-{ln}", facility_id=fac_id,
                    machine_type=mtype, rated_kw=kw,
                    telemetry_tag=f"{site}-PLC-{ln[1]}{i:03d}",
                    # The acquired Monterrey site still uses its legacy MES codes.
                    mes_code=(f"{site}/LINEA{ln[1]}/MAQ{i:02d}" if fac_id == "F-MX" else mid),
                ))
    return out


def write_csv(path: Path, header: list[str], rows: list[list]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def main() -> None:
    rng = random.Random(SEED)
    machines = build_machines()
    tz_of = {f[0]: ZoneInfo(f[3]) for f in FACILITIES}
    product = {p[0]: p for p in PRODUCTS}
    expected: dict[str, int | float | str] = {}

    # ---------------- reference ----------------
    ref = LANDED / "reference"
    write_csv(ref / "facilities.csv", ["facility_id", "facility_name", "country_code", "timezone"],
              [[f[0], f[1], f[2], f[3]] for f in FACILITIES])
    write_csv(ref / "lines.csv", ["line_id", "facility_id", "line_name"],
              [[f"{f[0].split('-')[1]}-{ln}", f[0], LINE_TYPES[ln][0]]
               for f in FACILITIES for ln in ("L1", "L2")])
    write_csv(ref / "machines.csv", ["machine_id", "line_id", "machine_type", "rated_kw"],
              [[m.machine_id, m.line_id, m.machine_type, m.rated_kw] for m in machines])
    write_csv(ref / "products.csv",
              ["product_id", "product_name", "product_family", "std_material_cost_usd", "ideal_cycle_seconds"],
              [list(p) for p in PRODUCTS])
    write_csv(ref / "shifts.csv", ["shift_code", "shift_name", "local_start_time", "duration_minutes"],
              [[s[0], s[1], s[2].strftime("%H:%M"), SHIFT_MIN] for s in SHIFTS])
    xwalk = [["TELEMETRY_HISTORIAN", m.telemetry_tag, "machine", m.machine_id] for m in machines]
    xwalk += [["MES_MTY", m.mes_code, "machine", m.machine_id] for m in machines if m.facility_id == "F-MX"]
    write_csv(ref / "source_id_crosswalk.csv", ["source_system", "source_id", "entity_type", "canonical_id"], xwalk)
    write_csv(LANDED / "erp" / "energy_tariffs.csv",
              ["facility_id", "effective_from", "effective_to", "usd_per_kwh"],
              [[t[0], t[1].isoformat(), t[2].isoformat(), t[3]] for t in TARIFFS])

    # ---------------- simulate operations ----------------
    mes_rows, qms_rows, erp_rows, tele = [], [], [], []
    # Deterministic forced anomalies: full-shift outages and quality holds.
    all_slots = [(m, START + timedelta(d), s) for m in machines for d in range(DAYS) for s in SHIFTS]
    forced = rng.sample(range(len(all_slots)), 7)
    full_outage = set(forced[:3])        # machine down all shift -> zero units
    quality_hold = set(forced[3:])       # every unit rejected -> zero good units
    wo_seq = 0
    current_run: dict[str, tuple[str, str, int]] = {}  # machine -> (product, work order, remaining shifts)
    skipped = 0

    for idx, (m, d, (shift_code, _, local_start)) in enumerate(all_slots):
        # ~1.5% of shifts have no scheduled production (planned maintenance).
        if rng.random() < 0.015 and idx not in full_outage and idx not in quality_hold:
            skipped += 1
            continue
        tz = tz_of[m.facility_id]
        start_local = datetime.combine(d, local_start, tzinfo=tz)
        start_utc = start_local.astimezone(timezone.utc)
        end_utc = start_utc + timedelta(minutes=SHIFT_MIN)

        # Product runs span several shifts on a machine under one work order.
        run = current_run.get(m.machine_id)
        if run is None or run[2] <= 0:
            prod_id = rng.choice(LINE_TYPES[m.line_id.split("-")[1]][1])
            wo_seq += 1
            run = (prod_id, f"WO-{wo_seq:06d}", rng.randint(2, 8))
        prod_id, wo_id, remaining = run
        current_run[m.machine_id] = (prod_id, wo_id, remaining - 1)
        _, _, _, std_cost, cycle_s = product[prod_id]
        op_id = f"OP-{m.machine_id[2:]}-{d:%Y%m%d}-{shift_code[0]}"

        # Interval machine states.
        slow = m.line_id == INEFFICIENT_LINE
        states = ["RUNNING"] * INTERVALS_PER_SHIFT
        if idx in full_outage:
            states = ["DOWN"] * INTERVALS_PER_SHIFT
        else:
            if rng.random() < (0.38 if slow else 0.12):
                blen = rng.randint(2, 16)
                b0 = rng.randint(0, INTERVALS_PER_SHIFT - blen)
                states[b0:b0 + blen] = ["DOWN"] * blen
            for i in range(INTERVALS_PER_SHIFT):
                if states[i] == "RUNNING" and rng.random() < (0.07 if slow else 0.03):
                    states[i] = "IDLE"
        operating_min = states.count("RUNNING") * INTERVAL_MIN

        perf = min(0.97, max(0.55, rng.gauss(0.78 if slow else 0.90, 0.04)))
        units = int(operating_min * 60 / cycle_s * perf)

        # Rejected units (distinct serials), with a seasonal quality excursion.
        line, prod_x, ex_from, ex_to = QUALITY_EXCURSION
        scrap_p = 0.09 if (m.line_id == line and prod_id == prod_x and ex_from <= d <= ex_to) else 0.015
        if slow:
            scrap_p += 0.01
        rejected = units if idx in quality_hold else sum(rng.random() < scrap_p for _ in range(units))

        mes_rows.append([op_id, wo_id, m.facility_id.replace("F-", "") if m.facility_id != "F-MX" else "MTY",
                         m.mes_code, prod_id, d.isoformat(), shift_code, iso(start_utc), iso(end_utc),
                         SHIFT_MIN, units, cycle_s, iso(end_utc + timedelta(minutes=rng.randint(5, 90)))])

        # QMS: one reject event per rejected unit, ~15% of units get a second defect code.
        for k in range(rejected):
            serial = f"SN-{op_id[3:]}-{k:04d}"
            n_defects = 2 if rng.random() < 0.15 else 1
            for code in rng.sample(DEFECT_CODES, n_defects):
                ev_ts = start_utc + timedelta(seconds=rng.randint(0, SHIFT_MIN * 60 - 1))
                qms_rows.append({"event_id": f"QE-{stable_id(serial, code)}", "operation_id": op_id,
                                 "unit_serial": serial, "defect_code": code, "disposition": "SCRAP",
                                 "event_ts": iso(ev_ts), "source_updated_at": iso(ev_ts + timedelta(hours=2))})

        # ERP: material issued for all produced units, split over 1-3 goods-issue transactions.
        if units > 0:
            drift = 1.06 if (prod_id in LINE_TYPES["L1"][1] and d >= COPPER_STEP) else 1.0
            total_cost = round(units * std_cost * drift * rng.uniform(0.97, 1.03), 2)
            n = rng.randint(1, 3)
            weights = [rng.random() + 0.2 for _ in range(n)]
            parts = [round(total_cost * w / sum(weights), 2) for w in weights]
            parts[-1] = round(total_cost - sum(parts[:-1]), 2)
            for j, amt in enumerate(parts):
                ts = start_utc + timedelta(minutes=rng.randint(0, SHIFT_MIN))
                erp_rows.append([f"GI-{stable_id(op_id, j)}", op_id, wo_id, amt, "USD", iso(ts), iso(ts + timedelta(hours=1))])

        # Telemetry: one state + one energy-delta event per 15-minute interval.
        for i, st in enumerate(states):
            ts = start_utc + timedelta(minutes=INTERVAL_MIN * i)
            load = {"RUNNING": rng.uniform(0.72, 0.95), "IDLE": 0.2, "DOWN": 0.03}[st]
            kwh = round(m.rated_kw * load * INTERVAL_MIN / 60, 4)
            v2 = m.facility_id == "F-DE" and ts.astimezone(tz).date() >= DE_WH_CUTOVER
            ingest = ts + timedelta(minutes=INTERVAL_MIN, seconds=rng.randint(20, 300))
            tele.append(dict(event_id=stable_id(m.telemetry_tag, "state", iso(ts)), source_tag=m.telemetry_tag,
                             event_type="machine_state", event_ts=ts, ingested_at=ingest, value_num=None,
                             value_text=st, unit=None, quality_code="GOOD", schema_version=2 if v2 else 1))
            tele.append(dict(event_id=stable_id(m.telemetry_tag, "kwh", iso(ts)), source_tag=m.telemetry_tag,
                             event_type="energy_interval_kwh", event_ts=ts, ingested_at=ingest,
                             value_num=round(kwh * 1000, 1) if v2 else kwh, value_text=None,
                             unit="Wh" if v2 else "kWh", quality_code="GOOD", schema_version=2 if v2 else 1))

    # ---------------- injected anomalies ----------------
    energy_idx = [i for i, e in enumerate(tele) if e["event_type"] == "energy_interval_kwh"]
    bad = rng.sample(energy_idx, 600)
    for i in bad:
        tele[i]["quality_code"] = "BAD"
        tele[i]["value_num"] = rng.choice([-1.0, 99999.0])
    late = rng.sample(range(len(tele)), 1800)   # gateway offline, flushed 1-3 days later
    for i in late:
        tele[i]["ingested_at"] = tele[i]["event_ts"] + timedelta(hours=rng.randint(24, 72))
    dups = [dict(tele[i], ingested_at=tele[i]["ingested_at"] + timedelta(hours=rng.randint(1, 6)))
            for i in rng.sample(range(len(tele)), 1200)]
    tele.extend(dups)
    # Unmapped tag: a newly installed Monterrey machine not yet in master data (10 days).
    unmapped = 0
    for dd in range(10):
        for i in range(96):
            ts = datetime.combine(date(2026, 8, 10) + timedelta(dd), time(0), tzinfo=timezone.utc) + timedelta(minutes=15 * i)
            for et in ("machine_state", "energy_interval_kwh"):
                tele.append(dict(event_id=stable_id(UNMAPPED_TAG, et, iso(ts)), source_tag=UNMAPPED_TAG, event_type=et,
                                 event_ts=ts, ingested_at=ts + timedelta(minutes=16), value_num=None if et == "machine_state" else 5.0,
                                 value_text="RUNNING" if et == "machine_state" else None,
                                 unit=None if et == "machine_state" else "kWh", quality_code="GOOD", schema_version=1))
                unmapped += 1
    # Landed order = arrival order, so late events appear out of event-time order.
    tele.sort(key=lambda e: (e["ingested_at"], e["event_id"]))

    # QMS orphans (unknown operation) and ERP replays/corrections.
    for k in range(6):
        ts = datetime(2026, 7, 1 + k, 12, tzinfo=timezone.utc)
        qms_rows.append({"event_id": f"QE-ORPHAN-{k}", "operation_id": f"OP-XX-L9-99-202607{1 + k:02d}-D",
                         "unit_serial": f"SN-ORPHAN-{k}", "defect_code": "HOUSING_CRACK", "disposition": "SCRAP",
                         "event_ts": iso(ts), "source_updated_at": iso(ts)})
    replays = [list(r) for r in rng.sample(erp_rows, 40)]                       # exact duplicate re-export
    corrections = []
    for r in rng.sample(erp_rows, 15):                                           # later correction wins
        c = list(r)
        c[3] = round(r[3] * 1.05, 2)
        c[6] = iso(datetime.strptime(r[6], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) + timedelta(days=2))
        corrections.append(c)
    erp_all = erp_rows + replays + corrections
    erp_all.sort(key=lambda r: (r[6], r[0]))

    # ---------------- write ----------------
    write_csv(LANDED / "mes" / "production_orders.csv",
              ["operation_id", "work_order_id", "site_code", "machine_code", "product_code", "production_date",
               "shift_code", "shift_start_utc", "shift_end_utc", "scheduled_minutes", "units_produced",
               "ideal_cycle_seconds", "source_updated_at"], mes_rows)
    write_csv(LANDED / "erp" / "material_costs.csv",
              ["transaction_id", "operation_id", "work_order_id", "material_cost", "currency",
               "posting_ts", "source_updated_at"], erp_all)
    (LANDED / "qms").mkdir(parents=True, exist_ok=True)
    with (LANDED / "qms" / "quality_events.jsonl").open("w") as f:
        for r in sorted(qms_rows, key=lambda r: (r["source_updated_at"], r["event_id"])):
            f.write(json.dumps(r, sort_keys=True) + "\n")
    schema = pa.schema([("event_id", pa.string()), ("source_tag", pa.string()), ("event_type", pa.string()),
                        ("event_ts", pa.timestamp("us", tz="UTC")), ("ingested_at", pa.timestamp("us", tz="UTC")),
                        ("value_num", pa.float64()), ("value_text", pa.string()), ("unit", pa.string()),
                        ("quality_code", pa.string()), ("schema_version", pa.int16())])
    (LANDED / "telemetry").mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pylist(tele, schema=schema), LANDED / "telemetry" / "machine_signals.parquet",
                   compression="zstd")

    # ---------------- expected anomaly counts (used by tests) ----------------
    corrected_ids = {c[0] for c in corrections}
    latest_ingest: dict[str, tuple[datetime, datetime]] = {}
    for e in tele:
        prev = latest_ingest.get(e["event_id"])
        if prev is None or e["ingested_at"] > prev[1]:
            latest_ingest[e["event_id"]] = (e["event_ts"], e["ingested_at"])
    late_after_dedupe = sum(1 for ev, ing in latest_ingest.values() if ing - ev > timedelta(minutes=60))
    expected.update({
        "seed": SEED,
        "mes_operations": len(mes_rows),
        "skipped_planned_maintenance_shifts": skipped,
        "full_shift_outages": len(full_outage),
        "quality_hold_shifts": len(quality_hold),
        "zero_good_unit_operations": len(full_outage) + len(quality_hold),
        "telemetry_rows_landed": len(tele),
        "telemetry_duplicate_deliveries": len(dups),
        "telemetry_late_events_injected": len(late),
        # Dedupe keeps the latest delivery, so re-delivered events count as late too.
        "telemetry_late_events_after_dedupe": late_after_dedupe,
        "telemetry_bad_quality_events": len(bad),
        "telemetry_unmapped_events": unmapped,
        "telemetry_unique_events": len(tele) - len(dups),
        "qms_events": len(qms_rows),
        "qms_orphan_events": 6,
        "qms_rejected_units": len({r["unit_serial"] for r in qms_rows
                                   if not r["event_id"].startswith("QE-ORPHAN")}),
        "erp_rows_landed": len(erp_all),
        "erp_duplicate_replays": len(replays),
        "erp_corrections": len(corrections),
        "erp_unique_transactions": len(erp_rows),
        "erp_material_cost_after_dedupe": round(sum(
            r[3] * (1.05 if r[0] in corrected_ids else 1) for r in erp_rows), 2),
    })
    (LANDED / "_manifest.json").write_text(json.dumps(expected, indent=2) + "\n")
    print(json.dumps(expected, indent=2))


if __name__ == "__main__":
    main()
