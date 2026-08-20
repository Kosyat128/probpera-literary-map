#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly DEFAULT_DATABASE_IMAGE="public.ecr.aws/supabase/postgres:17.6.1.136"
readonly EXPECTED_PRODUCTION_PROJECT_REF="sjqejjmwpzfsczxdghvw"
readonly EXPECTED_PRODUCTION_API_HOST="${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co"
DATABASE_IMAGE="${DATABASE_IMAGE:-$DEFAULT_DATABASE_IMAGE}"
RESTORE_CONTAINER=""

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
  [[ -n "$active_container" ]] || return 0
  docker rm --force "$active_container" >/dev/null 2>&1 || {
    echo "::error::Failed to remove the isolated restore container." >&2
    return 1
  }
  RESTORE_CONTAINER=""
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
  local output
  output="$(absolute_path "$1")"
  validate_database_url
  pull_database_image
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
  local dump plan result
  dump="$(absolute_path "$1")"
  plan="${2:-}"
  result="${3:-}"
  [[ -s "$dump" ]] || die "Restore drill dump is missing or empty."
  pull_database_image

  RESTORE_CONTAINER="probpera-restore-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${RANDOM}"
  trap cleanup_restore EXIT

  docker run --detach --name "$RESTORE_CONTAINER" \
    --env POSTGRES_PASSWORD=postgres \
    --env POSTGRES_DB=postgres \
    "$DATABASE_IMAGE" >/dev/null

  local ready=false
  for _attempt in {1..45}; do
    if docker exec "$RESTORE_CONTAINER" pg_isready \
      --username=postgres --dbname=postgres >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 2
  done
  [[ "$ready" == true ]] || {
    docker logs "$RESTORE_CONTAINER" >&2
    die "Isolated Supabase PostgreSQL did not become ready."
  }

  # pg_restore --clean emits DROP POLICY ... ON relation statements that fail
  # against a fresh database even with --if-exists.  Create the drill target
  # from template0, prove that it contains no user relations, and restore every
  # dump entry under --exit-on-error instead of excluding platform schemas.
  docker exec "$RESTORE_CONTAINER" createdb \
    --username=postgres \
    --template=template0 \
    probpera_restore

  local isolated_empty
  isolated_empty="$(
    docker exec "$RESTORE_CONTAINER" psql \
      --username=postgres \
      --dbname=probpera_restore \
      --no-psqlrc \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="select not exists (select 1 from pg_catalog.pg_class relation join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace where namespace.nspname <> 'information_schema' and namespace.nspname not like 'pg_%' and relation.relkind in ('r', 'p', 'v', 'm', 'S', 'f'));"
  )"
  [[ "$isolated_empty" == "t" ]] \
    || die "Isolated restore target is not empty."

  docker cp "$dump" "$RESTORE_CONTAINER:/tmp/probpera.dump"
  docker exec "$RESTORE_CONTAINER" pg_restore \
    --username=postgres \
    --dbname=probpera_restore \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    /tmp/probpera.dump

  local core restored_articles publication_schema
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
      printf 'publication_schema=%s\n' "$publication_schema"
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
  supabase-database-safety.sh dump OUTPUT
  supabase-database-safety.sh encrypt-verify INPUT ENCRYPTED VERIFIED
  supabase-database-safety.sh restore-drill DUMP [PLAN] [RESULT]
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
    [[ "$#" -eq 2 ]] || usage
    command_dump "$2"
    ;;
  encrypt-verify)
    [[ "$#" -eq 4 ]] || usage
    command_encrypt_verify "$2" "$3" "$4"
    ;;
  restore-drill)
    [[ "$#" -ge 2 && "$#" -le 4 ]] || usage
    command_restore_drill "$2" "${3:-}" "${4:-}"
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
