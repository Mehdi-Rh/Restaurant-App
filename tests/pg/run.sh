#!/bin/sh
# Runs supabase/test_rls.sql on a throwaway local Postgres 16. Usage: sh tests/pg/run.sh
set -e
BIN=/usr/lib/postgresql/16/bin; D=${PGTEST_DIR:-/var/tmp/pgtest-run}; P=5498
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/sh -c "$1"; else sh -c "$1"; fi; }
[ -d "$D" ] && { as_pg "$BIN/pg_ctl -D $D/data stop -m fast" >/dev/null 2>&1 || true; rm -rf $D; }
mkdir -p $D; [ "$(id -u)" = 0 ] && chown postgres $D
as_pg "$BIN/initdb -D $D/data -U postgres -A trust" >/dev/null
as_pg "$BIN/pg_ctl -D $D/data -o '-p $P -k $D' -l $D/log start" >/dev/null
Q="psql -h $D -p $P -U postgres -q -v ON_ERROR_STOP=1"
R=$(dirname "$0")/../..
export PGOPTIONS="-c client_min_messages=warning"; $Q -f $R/tests/pg/stub.sql && $Q -f $R/supabase/schema.sql && $Q -f $R/supabase/schema.sql; unset PGOPTIONS
$Q -f $R/supabase/test_rls.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -E 'PASS|FAIL|ERROR' ; RC=$?
as_pg "$BIN/pg_ctl -D $D/data stop -m fast" >/dev/null
