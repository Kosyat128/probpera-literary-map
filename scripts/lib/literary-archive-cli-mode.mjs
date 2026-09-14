export function literaryArchiveDatabaseMode(argv) {
  return {
    applyChanges: argv.includes("--apply"),
    commitViaDatabase: argv.includes("--commit-via-database"),
    readViaDatabase: argv.includes("--read-via-database"),
    preflightOnly: argv.includes("--preflight"),
    postflightOnly: argv.includes("--postflight"),
  };
}

export function validateLiteraryArchiveDatabaseMode({
  applyChanges, commitViaDatabase, readViaDatabase, preflightOnly, postflightOnly,
}) {
  if ([applyChanges, preflightOnly, postflightOnly].filter(Boolean).length > 1) {
    throw new Error("Choose at most one database mode: --preflight, --postflight or --apply.");
  }
  if (commitViaDatabase && !applyChanges) {
    throw new Error("--commit-via-database is valid only with --apply.");
  }
  if (readViaDatabase && !applyChanges && !preflightOnly) {
    throw new Error("--read-via-database is valid only with --preflight or --apply.");
  }
}

export function requireNativeArchiveDatabaseCredentials(commitViaDatabase, env, readViaDatabase = false) {
  if (commitViaDatabase && !env.SUPABASE_DB_URL?.trim()) {
    throw new Error("--commit-via-database requires SUPABASE_DB_URL.");
  }
  if (readViaDatabase && !env.SUPABASE_DB_URL?.trim()) {
    throw new Error("--read-via-database requires SUPABASE_DB_URL.");
  }
}
