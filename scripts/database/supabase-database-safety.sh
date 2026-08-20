#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly DEFAULT_DATABASE_IMAGE="public.ecr.aws/supabase/postgres:17.6.1.136"
readonly EXPECTED_PRODUCTION_PROJECT_REF="sjqejjmwpzfsczxdghvw"
readonly EXPECTED_PRODUCTION_API_HOST="${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co"
DATABASE_IMAGE="${DATABASE_IMAGE:-$DEFAULT_DATABASE_IMAGE}"
RESTORE_CONTAINER=""
RESTORE_IDENTITY_BODY=""
RESTORE_IDENTITY_RAW=""
RESTORE_IDENTITY_COUNT=""
RESTORE_IDENTITY_DIGEST=""

die() {
  echo "::error::$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command is unavailable: $1"
}

require_env() {
  [[ -n "${!1:-}" ]] || die "Required environment variable is missing: $1"
}

absolute_path() {
  local path="$1"
  local directory
  directory="$(dirname "$path")"
  mkdir -p "$directory"
  directory="$(cd "$directory" && pwd -P)"
  printf '%s/%s\n' "$directory" "$(basename "$path")"
}

pull_database_image() {
  require_command docker
  docker pull "$DATABASE_IMAGE" >/dev/null
}

cleanup_restore() {
  local active_container="${RESTORE_CONTAINER:-}"
  local identity_body="${RESTORE_IDENTITY_BODY:-}"
  local identity_raw="${RESTORE_IDENTITY_RAW:-}"
  local cleanup_failed=false

  if [[ -n "$active_container" ]] \
    && ! docker rm --force "$active_container" >/dev/null 2>&1; then
    echo "::error::Failed to remove the isolated restore container." >&2
    cleanup_failed=true
  fi
  if [[ -n "$identity_body" ]] && ! rm -f -- "$identity_body"; then
    echo "::error::Failed to remove validated identity seed material." >&2
    cleanup_failed=true
  fi
  if [[ -n "$identity_raw" ]] && ! rm -f -- "$identity_raw"; then
    echo "::error::Failed to remove raw identity seed material." >&2
    cleanup_failed=true
  fi

  RESTORE_CONTAINER=""
  RESTORE_IDENTITY_BODY=""
  RESTORE_IDENTITY_RAW=""
  RESTORE_IDENTITY_COUNT=""
  RESTORE_IDENTITY_DIGEST=""
  [[ "$cleanup_failed" == false ]]
}

validate_identity_sidecar() {
  local sidecar="$1"
  local format_line count_line digest_line separator_line
  local expected_count expected_digest actual_count=0 actual_digest user_id

  [[ -s "$sidecar" ]] || die "Auth user ID sidecar is missing or empty."
  require_command cmp
  require_command mktemp
  require_command sha256sum
  require_command sort

  RESTORE_IDENTITY_BODY="$(mktemp)"
  RESTORE_IDENTITY_RAW="$(mktemp)"
  : > "$RESTORE_IDENTITY_BODY"

  exec 3< "$sidecar"
  IFS= read -r format_line <&3 \
    || die "Auth user ID sidecar is missing its format header."
  IFS= read -r count_line <&3 \
    || die "Auth user ID sidecar is missing its count header."
  IFS= read -r digest_line <&3 \
    || die "Auth user ID sidecar is missing its digest header."
  IFS= read -r separator_line <&3 \
    || die "Auth user ID sidecar is missing its body separator."
  cat <&3 > "$RESTORE_IDENTITY_RAW"
  exec 3<&-

  [[ "$format_line" == "format=probpera-auth-user-ids-v1" ]] \
    || die "Auth user ID sidecar format is not allowlisted."
  [[ "$count_line" =~ ^count=(0|[1-9][0-9]*)$ ]] \
    || die "Auth user ID sidecar count header is invalid."
  expected_count="${BASH_REMATCH[1]}"
  [[ "$digest_line" =~ ^sha256=([0-9a-f]{64})$ ]] \
    || die "Auth user ID sidecar digest header is invalid."
  expected_digest="${BASH_REMATCH[1]}"
  [[ "$separator_line" == "--" ]] \
    || die "Auth user ID sidecar body separator is invalid."

  while IFS= read -r user_id || [[ -n "$user_id" ]]; do
    [[ "$user_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] \
      || die "Auth user ID sidecar contains a non-UUID row."
    printf '%s\n' "$user_id" >> "$RESTORE_IDENTITY_BODY"
    actual_count=$((actual_count + 1))
  done < "$RESTORE_IDENTITY_RAW"

  cmp --silent "$RESTORE_IDENTITY_RAW" "$RESTORE_IDENTITY_BODY" \
    || die "Auth user ID sidecar body is not in canonical line format."
  LC_ALL=C sort -c -u "$RESTORE_IDENTITY_BODY" >/dev/null 2>&1 \
    || die "Auth user ID sidecar must be strictly ordered and unique."
  [[ "$actual_count" == "$expected_count" ]] \
    || die "Auth user ID sidecar count does not match its body."

  actual_digest="$(sha256sum "$RESTORE_IDENTITY_BODY")"
  actual_digest="${actual_digest%% *}"
  [[ "$actual_digest" == "$expected_digest" ]] \
    || die "Auth user ID sidecar digest does not match its body."

  RESTORE_IDENTITY_COUNT="$actual_count"
  RESTORE_IDENTITY_DIGEST="$actual_digest"
}

verify_seeded_identity_ids() {
  local restored_count restored_digest

  docker exec "$RESTORE_CONTAINER" psql \
    --username=postgres \
    --dbname=probpera_restore \
    --no-psqlrc \
    --quiet \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --command="select lower(id::text) from auth.users order by id;" \
    > "$RESTORE_IDENTITY_RAW"
  cmp --silent "$RESTORE_IDENTITY_BODY" "$RESTORE_IDENTITY_RAW" \
    || die "Seeded auth user IDs do not exactly match the validated sidecar."

  restored_digest="$(sha256sum "$RESTORE_IDENTITY_RAW")"
  restored_digest="${restored_digest%% *}"
  [[ "$restored_digest" == "$RESTORE_IDENTITY_DIGEST" ]] \
    || die "Seeded auth user ID digest does not match the validated sidecar."

  restored_count="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select count(*) from auth.users;"
  )"
  [[ "$restored_count" == "$RESTORE_IDENTITY_COUNT" ]] \
    || die "Seeded auth user ID count does not match the validated sidecar."
}

wait_for_initialized_restore_database() {
  local ready=false
  local platform_state=""

  for _attempt in {1..60}; do
    # The upstream postgres entrypoint first exposes a temporary server while it
    # runs init scripts, then stops it and execs the final postgres process.
    # pg_isready alone can therefore succeed too early.  Require PID 1 to be the
    # final server as well as the exact initialized Supabase base contract. Vault
    # is bootstrapped separately only after its completely absent state is proven.
    if docker exec "$RESTORE_CONTAINER" sh -ceu \
        '[ "$(cat /proc/1/comm)" = "postgres" ]' >/dev/null 2>&1 \
      && docker exec "$RESTORE_CONTAINER" pg_isready \
        --username=postgres --dbname=probpera_restore >/dev/null 2>&1 \
      && platform_state="$(
        docker exec "$RESTORE_CONTAINER" psql \
          --username=postgres \
          --dbname=probpera_restore \
          --no-psqlrc \
          --tuples-only \
          --no-align \
          --set=ON_ERROR_STOP=1 \
          --command="select current_database() = 'probpera_restore', to_regclass('auth.users') is not null, to_regnamespace('auth') is not null, (select count(*) = 6 from pg_catalog.pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin')), (exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'id' and udt_schema = 'pg_catalog' and udt_name = 'uuid' and is_nullable = 'NO' and is_identity = 'NO' and is_generated = 'NEVER') and exists (select 1 from pg_catalog.pg_constraint c join pg_catalog.pg_class r on r.oid = c.conrelid join pg_catalog.pg_namespace n on n.oid = r.relnamespace join pg_catalog.pg_attribute a on a.attrelid = r.oid where n.nspname = 'auth' and r.relname = 'users' and a.attname = 'id' and c.contype in ('p', 'u') and cardinality(c.conkey) = 1 and a.attnum = any(c.conkey)) and not exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name <> 'id' and is_nullable = 'NO' and column_default is null and is_identity = 'NO' and is_generated = 'NEVER'));" \
          2>/dev/null
      )" \
      && [[ "$platform_state" == "t|t|t|t|t" ]]; then
      ready=true
      break
    fi
    sleep 2
  done

  [[ "$ready" == true ]] || {
    local diagnostic_state="unavailable"
    if [[ "$platform_state" =~ ^[tf]\|[tf]\|[tf]\|[tf]\|[tf]$ ]]; then
      diagnostic_state="$platform_state"
    fi
    echo "::error::Isolated base vector (database|auth_users|auth_schema|roles|auth_id_contract): $diagnostic_state" >&2
    docker logs "$RESTORE_CONTAINER" >&2
    die "Isolated Supabase PostgreSQL did not reach the exact initialized base platform state."
  }
}

bootstrap_isolated_restore_vault() {
  local vault_precondition vault_state

  vault_precondition="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select to_regnamespace('vault') is null, not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault'), to_regclass('vault.secrets') is null, exists (select 1 from pg_catalog.pg_available_extensions where name = 'supabase_vault' and default_version is not null);"
  )"
  [[ "$vault_precondition" == "t|t|t|t" ]] \
    || die "Isolated Vault bootstrap requires a completely absent Vault state and an available default supabase_vault version."

  # Existence-tolerant DDL and disconnect tolerance are forbidden: a concurrent
  # or partial state, or any hook failure, aborts the transaction and the drill.
  docker exec "$RESTORE_CONTAINER" psql \
    --username=postgres \
    --dbname=probpera_restore \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --single-transaction \
    --command="create schema vault;" \
    --command="create extension supabase_vault with schema vault;" \
    >/dev/null

  vault_state="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select current_database() = 'probpera_restore', to_regnamespace('vault') is not null, exists (select 1 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace join pg_catalog.pg_available_extensions a on a.name = e.extname where e.extname = 'supabase_vault' and n.nspname = 'vault' and e.extversion = a.default_version), exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'vault' and c.relname = 'secrets' and c.relkind in ('r', 'p'));"
  )"
  [[ "$vault_state" == "t|t|t|t" ]] \
    || die "Isolated Vault bootstrap did not reach the exact extension version, schema, and secrets table state."
}

assert_empty_application_schema() {
  local application_empty
  application_empty="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select to_regnamespace('public') is not null, to_regclass('public.articles') is null, not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')), not exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'), not exists (select 1 from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'), not exists (select 1 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace where n.nspname = 'public'), (select count(*) = 0 from auth.users);"
  )"
  [[ "$application_empty" == "t|t|t|t|t|t|t" ]] \
    || die "Isolated application schema is not empty."
}

validate_database_url() {
  require_env SUPABASE_DB_URL
  require_env SUPABASE_URL

  case "$SUPABASE_DB_URL" in
    postgres://*|postgresql://*) ;;
    *) die "SUPABASE_DB_URL must be a PostgreSQL connection URL." ;;
  esac

  case "${SUPABASE_DB_URL,,}" in
    *sslmode=disable*|*sslmode=allow*|*sslmode=prefer*)
      die "SUPABASE_DB_URL must not weaken TLS verification."
      ;;
  esac

  local api_host project_ref db_without_scheme db_authority db_path_query db_path db_query
  local db_userinfo db_hostport db_user db_host db_port
  api_host="${SUPABASE_URL#https://}"
  api_host="${api_host%/}"
  api_host="${api_host%%/*}"
  project_ref="${api_host%%.*}"
  [[ "$api_host" == "$EXPECTED_PRODUCTION_API_HOST" ]] \
    || die "SUPABASE_URL does not identify the allowlisted production project."
  [[ "$project_ref" == "$EXPECTED_PRODUCTION_PROJECT_REF" ]] \
    || die "SUPABASE_URL project reference is not the allowlisted production reference."

  # Pin the database endpoint independently as well. Supabase direct connections
  # encode the project in db.<ref>.supabase.co; pooler connections encode it in
  # the postgres.<ref> username. Merely finding the ref anywhere in the secret is
  # insufficient because it could occur in a password for an unrelated database.
  db_without_scheme="${SUPABASE_DB_URL#*://}"
  db_authority="${db_without_scheme%%/*}"
  db_path_query="${db_without_scheme#*/}"
  [[ "$db_without_scheme" != "$db_path_query" ]] \
    || die "SUPABASE_DB_URL must name the postgres database explicitly."
  [[ "$db_authority" != *","* && "${db_authority,,}" != *"%2c"* ]] \
    || die "SUPABASE_DB_URL must contain exactly one database host."
  [[ "$db_path_query" != *"#"* ]] \
    || die "SUPABASE_DB_URL fragments are not allowed."

  db_path="${db_path_query%%\?*}"
  [[ "$db_path" == "postgres" ]] \
    || die "SUPABASE_DB_URL must connect only to the postgres database."
  db_query=""
  if [[ "$db_path_query" == *"?"* ]]; then
    db_query="${db_path_query#*\?}"
    [[ "$db_query" == "sslmode=require" || "$db_query" == "sslmode=verify-full" ]] \
      || die "SUPABASE_DB_URL query may contain only an approved strict sslmode."
  fi

  [[ "$db_authority" == *@* ]] \
    || die "SUPABASE_DB_URL must include an explicit Supabase database user."
  db_userinfo="${db_authority%@*}"
  db_hostport="${db_authority##*@}"
  db_user="${db_userinfo%%:*}"
  db_host="${db_hostport%%:*}"
  db_port=""
  if [[ "$db_hostport" == *":"* ]]; then
    db_port="${db_hostport#*:}"
    [[ "$db_port" =~ ^[0-9]{1,5}$ ]] \
      || die "SUPABASE_DB_URL contains an invalid database port."
  fi

  if [[ "$db_host" == "db.${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co" ]]; then
    [[ "$db_user" == "postgres" ]] \
      || die "Direct production database URL must use the postgres user."
  elif [[ "$db_host" == *.pooler.supabase.com ]]; then
    [[ "$db_user" == "postgres.${EXPECTED_PRODUCTION_PROJECT_REF}" ]] \
      || die "Pooler database URL does not identify the allowlisted production project."
  else
    die "SUPABASE_DB_URL host is not an allowlisted Supabase production endpoint."
  fi
}

run_remote_psql() {
  local sql_file="$1"
  local output_file="${2:-}"
  local sql_absolute sql_directory sql_name
  sql_absolute="$(absolute_path "$sql_file")"
  [[ -s "$sql_absolute" ]] || die "SQL input is missing or empty."
  sql_directory="$(dirname "$sql_absolute")"
  sql_name="$(basename "$sql_absolute")"

  if [[ -n "$output_file" ]]; then
    docker run --rm \
      --env PGSSLMODE=require \
      --volume "$sql_directory:/probpera-sql:ro" \
      --entrypoint psql \
      "$DATABASE_IMAGE" \
      --dbname="$SUPABASE_DB_URL" \
      --no-psqlrc \
      --set=ON_ERROR_STOP=1 \
      --single-transaction \
      --file "/probpera-sql/$sql_name" > "$output_file"
  else
    docker run --rm \
      --env PGSSLMODE=require \
      --volume "$sql_directory:/probpera-sql:ro" \
      --entrypoint psql \
      "$DATABASE_IMAGE" \
      --dbname="$SUPABASE_DB_URL" \
      --no-psqlrc \
      --set=ON_ERROR_STOP=1 \
      --single-transaction \
      --file "/probpera-sql/$sql_name"
  fi
}

command_validate_target() {
  validate_database_url
  pull_database_image

  local verification
  verification="$(
    docker run --rm \
      --env PGSSLMODE=require \
      --entrypoint psql \
      "$DATABASE_IMAGE" \
      --dbname="$SUPABASE_DB_URL" \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select current_database() = 'postgres', not pg_is_in_recovery(), to_regclass('public.articles') is not null;"
  )"
  [[ "$verification" == "t|t|t" ]] \
    || die "Database target failed the non-mutating production identity probe."
}

command_dump() {
  local output identity_output
  output="$(absolute_path "$1")"
  identity_output="$(absolute_path "$2")"
  [[ "$output" != "$identity_output" ]] \
    || die "Database dump and auth user ID sidecar must use different paths."
  validate_database_url
  pull_database_image
  require_command cmp
  require_command mktemp
  require_command sha256sum
  require_command sort
  umask 077

  docker run --rm \
    --env PGSSLMODE=require \
    --entrypoint pg_dump \
    "$DATABASE_IMAGE" \
    --dbname="$SUPABASE_DB_URL" \
    --format=custom \
    --no-owner \
    --no-privileges \
    > "$output"

  [[ -s "$output" ]] || die "pg_dump produced an empty file."
  local output_directory output_name
  output_directory="$(dirname "$output")"
  output_name="$(basename "$output")"
  docker run --rm \
    --volume "$output_directory:/probpera-backup:ro" \
    --entrypoint pg_restore \
    "$DATABASE_IMAGE" \
    --list "/probpera-backup/$output_name" >/dev/null

  (
    local identity_body="" identity_pending="" identity_count=0 identity_digest user_id
    cleanup_dump_identity() {
      [[ -z "$identity_body" ]] || rm -f -- "$identity_body"
      [[ -z "$identity_pending" ]] || rm -f -- "$identity_pending"
    }
    trap cleanup_dump_identity EXIT
    identity_body="$(mktemp)"
    identity_pending="$(mktemp "${identity_output}.tmp.XXXXXX")"

    docker run --rm \
      --env PGSSLMODE=require \
      --entrypoint psql \
      "$DATABASE_IMAGE" \
      --dbname="$SUPABASE_DB_URL" \
      --no-psqlrc \
      --quiet \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select lower(id::text) from auth.users order by id;" \
      > "$identity_body"

    while IFS= read -r user_id || [[ -n "$user_id" ]]; do
      [[ "$user_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] \
        || die "Production auth user ID export contains a non-UUID row."
      identity_count=$((identity_count + 1))
    done < "$identity_body"
    LC_ALL=C sort -c -u "$identity_body" >/dev/null 2>&1 \
      || die "Production auth user IDs are not strictly ordered and unique."
    identity_digest="$(sha256sum "$identity_body")"
    identity_digest="${identity_digest%% *}"

    {
      printf 'format=probpera-auth-user-ids-v1\n'
      printf 'count=%s\n' "$identity_count"
      printf 'sha256=%s\n' "$identity_digest"
      printf '%s\n' '--'
      cat "$identity_body"
    } > "$identity_pending"
    mv -- "$identity_pending" "$identity_output"
    identity_pending=""
  )
}

command_encrypt_verify() {
  local input encrypted verified
  input="$(absolute_path "$1")"
  encrypted="$(absolute_path "$2")"
  verified="$(absolute_path "$3")"
  require_env BACKUP_ENCRYPTION_KEY
  require_command openssl
  require_command sha256sum
  require_command cmp
  (( ${#BACKUP_ENCRYPTION_KEY} >= 32 )) \
    || die "BACKUP_ENCRYPTION_KEY must contain at least 32 characters."
  [[ -s "$input" ]] || die "Backup input is missing or empty."
  umask 077

  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
    -in "$input" -out "$encrypted" -pass env:BACKUP_ENCRYPTION_KEY
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "$encrypted" -out "$verified" -pass env:BACKUP_ENCRYPTION_KEY
  cmp --silent "$input" "$verified" \
    || die "Encrypted backup did not decrypt byte-for-byte."
  (
    cd "$(dirname "$encrypted")"
    sha256sum "$(basename "$encrypted")" \
      > "$(basename "$encrypted").sha256"
  )
}

command_restore_drill() {
  local dump identity_sidecar plan result
  dump="$(absolute_path "$1")"
  identity_sidecar="$(absolute_path "$2")"
  plan="${3:-}"
  result="${4:-}"
  [[ -s "$dump" ]] || die "Restore drill dump is missing or empty."
  trap cleanup_restore EXIT
  validate_identity_sidecar "$identity_sidecar"
  pull_database_image

  RESTORE_CONTAINER="probpera-restore-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${RANDOM}"

  docker run --detach --name "$RESTORE_CONTAINER" \
    --env POSTGRES_PASSWORD=postgres \
    --env POSTGRES_DB=probpera_restore \
    "$DATABASE_IMAGE" >/dev/null

  wait_for_initialized_restore_database
  bootstrap_isolated_restore_vault
  assert_empty_application_schema

  # Keep the unfiltered custom dump as the encrypted recovery artifact. For the
  # automated drill, insert only validated UUID identities needed by public
  # foreign keys; never load hosted GoTrue rows into a potentially different
  # initialized Auth schema. Managed platform definitions remain target-owned.
  # Every selected public entry is strict, with no exclusion list or hand-edited
  # table of contents.
  docker cp "$dump" "$RESTORE_CONTAINER:/tmp/probpera.dump"
  if (( RESTORE_IDENTITY_COUNT > 0 )); then
    docker exec --interactive "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --quiet \
      --set=ON_ERROR_STOP=1 \
      --command='\copy auth.users (id) from pstdin with (format text)' \
      < "$RESTORE_IDENTITY_BODY" >/dev/null
  fi

  verify_seeded_identity_ids

  docker exec "$RESTORE_CONTAINER" pg_restore \
    --username=postgres \
    --dbname=probpera_restore \
    --schema=public \
    --strict-names \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    /tmp/probpera.dump
  verify_seeded_identity_ids

  local core restored_articles restored_auth_users publication_schema
  restored_auth_users="$RESTORE_IDENTITY_COUNT"
  core="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select to_regclass('public.articles') is not null, to_regclass('public.admin_audit_log') is not null, (select count(*) from pg_catalog.pg_index where not indisvalid);"
  )"
  [[ "$core" == "t|t|0" ]] \
    || die "Restored database failed core schema and index probes."

  if [[ -n "$plan" ]]; then
    local plan_absolute
    plan_absolute="$(absolute_path "$plan")"
    [[ -s "$plan_absolute" ]] || die "Migration plan is missing or empty."
    docker cp "$plan_absolute" "$RESTORE_CONTAINER:/tmp/reconciliation.sql"
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --set=ON_ERROR_STOP=1 \
      --single-transaction \
      --file=/tmp/reconciliation.sql
  fi

  restored_articles="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select count(*) from public.articles;"
  )"
  [[ "$restored_articles" =~ ^[1-9][0-9]*$ ]] \
    || die "Restore drill found no production articles."

  publication_schema="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select case when to_regclass('public.public_build_outbox') is not null and to_regprocedure('public.get_editorial_schema_health()') is not null and to_regclass('public.probpera_schema_migrations') is not null then '20260814-current' else 'pre-20260814' end;"
  )"

  if [[ -n "$plan" && "$publication_schema" != "20260814-current" ]]; then
    die "Isolated reconciliation did not reach the expected schema version."
  fi

  if [[ -n "$result" ]]; then
    result="$(absolute_path "$result")"
    {
      printf 'restored_articles=%s\n' "$restored_articles"
      printf 'restored_auth_users=%s\n' "$restored_auth_users"
      printf 'publication_schema=%s\n' "$publication_schema"
      printf 'restore_scope=public-application-schema\n'
      printf 'identity_seed=auth-user-id-sidecar-v1\n'
      printf 'identity_seed_sha256=%s\n' "$RESTORE_IDENTITY_DIGEST"
      if [[ -n "$plan" ]]; then
        printf 'migration_plan=verified\n'
      else
        printf 'migration_plan=not-requested\n'
      fi
    } > "$result"
  fi

  cleanup_restore
  trap - EXIT
}

command_apply_plan() {
  local plan="$1"
  validate_database_url
  pull_database_image
  run_remote_psql "$plan"
}

command_verify_production() {
  local sql_file="$1"
  local output_file
  output_file="$(absolute_path "$2")"
  validate_database_url
  pull_database_image
  run_remote_psql "$sql_file" "$output_file"
}

usage() {
  cat >&2 <<'EOF'
Usage:
  supabase-database-safety.sh validate-target
  supabase-database-safety.sh dump OUTPUT AUTH_USER_IDS
  supabase-database-safety.sh encrypt-verify INPUT ENCRYPTED VERIFIED
  supabase-database-safety.sh restore-drill DUMP AUTH_USER_IDS [PLAN] [RESULT]
  supabase-database-safety.sh apply-plan PLAN
  supabase-database-safety.sh verify-production SQL OUTPUT
EOF
  exit 2
}

case "${1:-}" in
  validate-target)
    [[ "$#" -eq 1 ]] || usage
    command_validate_target
    ;;
  dump)
    [[ "$#" -eq 3 ]] || usage
    command_dump "$2" "$3"
    ;;
  encrypt-verify)
    [[ "$#" -eq 4 ]] || usage
    command_encrypt_verify "$2" "$3" "$4"
    ;;
  restore-drill)
    [[ "$#" -ge 3 && "$#" -le 5 ]] || usage
    command_restore_drill "$2" "$3" "${4:-}" "${5:-}"
    ;;
  apply-plan)
    [[ "$#" -eq 2 ]] || usage
    command_apply_plan "$2"
    ;;
  verify-production)
    [[ "$#" -eq 3 ]] || usage
    command_verify_production "$2" "$3"
    ;;
  *) usage ;;
esac
