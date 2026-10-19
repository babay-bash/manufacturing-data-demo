import shutil

import pytest

from pipeline.fixtures import CONTRACTS, ContractError, validate
from pipeline.state import LANDED_DIR


def test_all_committed_fixtures_match_contracts():
    for c in CONTRACTS:
        validate(c)


def _copy_landed(tmp_path):
    dst = tmp_path / "landed"
    shutil.copytree(LANDED_DIR, dst)
    return dst


def test_schema_drift_is_rejected(tmp_path):
    landed = _copy_landed(tmp_path)
    f = landed / "erp" / "energy_tariffs.csv"
    f.write_text(f.read_text().replace("usd_per_kwh", "price"))
    contract = next(c for c in CONTRACTS if c.name == "erp_energy_tariffs")
    with pytest.raises(ContractError, match="schema drift"):
        validate(contract, landed)


def test_missing_file_is_rejected(tmp_path):
    landed = _copy_landed(tmp_path)
    (landed / "mes" / "production_orders.csv").unlink()
    contract = next(c for c in CONTRACTS if c.name == "mes_production_orders")
    with pytest.raises(ContractError, match="missing"):
        validate(contract, landed)
