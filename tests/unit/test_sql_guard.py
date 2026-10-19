import pytest

from server.db import UnsafeQuery, validate_user_sql

ALLOWED = [
    "select 1",
    "SELECT * FROM marts.dim_facility;",
    "with x as (select 1 as a) select a from x",
    "select facility_id, count(*) from marts.fct_production_performance group by 1",
]
BLOCKED = [
    "select 1; select 2",
    "select 1; drop table marts.dim_date",
    "drop table marts.dim_date",
    "delete from marts.dim_date",
    "update marts.dim_shift set shift_name = 'x'",
    "insert into marts.dim_shift values ('X','x','00:00',1)",
    "create table t as select 1",
    "copy (select 1) to '/tmp/out.csv'",
    "attach '/tmp/other.duckdb' as other",
    "install httpfs",
    "set enable_external_access = true",
    "pragma database_list",
    "select * from read_csv('/etc/hosts')",
    "select * from read_parquet('x.parquet')",
    "select * from glob('/Users/*')",
    "select getenv('HOME')",
    "",
]


@pytest.mark.parametrize("sql", ALLOWED)
def test_allowed(sql):
    assert validate_user_sql(sql)


@pytest.mark.parametrize("sql", BLOCKED)
def test_blocked(sql):
    with pytest.raises(UnsafeQuery):
        validate_user_sql(sql)
