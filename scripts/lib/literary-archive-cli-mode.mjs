export function literaryArchiveDatabaseMode(argv) {
  return {
    applyChanges: argv.includes("--apply"),
    commitViaDatabase: argv.includes("--commit-via-database"),
    preflightOnly: argv.includes("--preflight"),
    postflightOnly: argv.includes("--postflight"),
  };
}

export function validateLiteraryArchiveDatabaseMode({
  applyChanges, commitViaDatabase, preflightOnly, postflightOnly,
}) {
  if ([applyChanges, preflightOnly, postflightOnly].filter(Boolean).length > 1) {
    throw new Error("Choose at most one database mode: --preflight, --postflight or --apply.");
  }
  if (commitViaDatabase && !applyChanges) {
    throw new Error("--commit-via-database is valid only with --apply.");
  }
}

export function requireNativeArchiveDatabaseCredentials(commitViaDatabase, env) {
  if (commitViaDatabase && !env.SUPABASE_DB_URL?.trim()) {
    throw new Error("--commit-via-database requires SUPABASE_DB_URL.");
  }
}
