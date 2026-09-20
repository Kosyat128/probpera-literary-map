import { PLANET_MASCOT_ROUTES, type PlanetMascotRoute } from "./planetMascotRoutes";

export type BookyVersionProgress = Readonly<{
  routeVersion: number;
  acknowledgedStepIds: readonly string[];
}>;
export type BookyTourProgress = BookyVersionProgress & Readonly<{ route: PlanetMascotRoute }>;
export type BookyVersionCursor = Readonly<{ routeVersion: number; stepId: string }>;
export type BookyRouteHistory = Readonly<{
  currentVersion: number;
  versions: readonly Readonly<{ version: number; stepIds: readonly string[] }>[];
  migrations: readonly Readonly<{
    fromVersion: number;
    toVersion: number;
    /** Every old step needs an explicit equivalent, or null when retired. */
    stepMap: Readonly<Record<string, string | null>>;
    /** A retired cursor returns here without acknowledging this step. */
    safeCheckpoint: string;
  }>[];
}>;
export type BookyRouteState = Readonly<{
  resume: BookyVersionCursor | null;
  progress: readonly BookyVersionProgress[];
}>;

const versionHistory = (route: PlanetMascotRoute): BookyRouteHistory => Object.freeze({
  currentVersion: PLANET_MASCOT_ROUTES[route].version,
  versions: Object.freeze([Object.freeze({
    version: PLANET_MASCOT_ROUTES[route].version,
    stepIds: Object.freeze(PLANET_MASCOT_ROUTES[route].steps.map(step => step.id)),
  })]),
  migrations: Object.freeze([]),
});

/** Add actual historical versions and explicit mappings when authored routes
 * change. There is deliberately no guessed migration from a step index. */
export const BOOKY_ROUTE_HISTORIES: Readonly<Record<PlanetMascotRoute, BookyRouteHistory>> = Object.freeze({
  overview: versionHistory("overview"),
  "country-to-book": versionHistory("country-to-book"),
});

export function isBookyRoute(value: unknown): value is PlanetMascotRoute {
  return value === "overview" || value === "country-to-book";
}

/** Pure route-version resolver. Original acknowledged steps remain in their
 * historical record; only explicit equivalents become current acknowledgements.
 * Unknown versions/IDs or incomplete migration plans are never guessed. */
export function migrateBookyRouteState(
  state: BookyRouteState, history: BookyRouteHistory,
): (BookyRouteState & Readonly<{ migrated: boolean }>) | null {
  const versions = new Map(history.versions.map(version => [version.version, version]));
  if (versions.size !== history.versions.length || !versions.has(history.currentVersion)
    || history.versions.some(version => !Number.isSafeInteger(version.version) || version.version < 1
      || version.version > history.currentVersion || !version.stepIds.length
      || version.stepIds.some(id => typeof id !== "string" || !id.length)
      || new Set(version.stepIds).size !== version.stepIds.length)) return null;
  const mappings = new Map(history.migrations.map(migration => [migration.fromVersion, migration]));
  if (mappings.size !== history.migrations.length) return null;
  for (const migration of history.migrations) {
    const from = versions.get(migration.fromVersion), to = versions.get(migration.toVersion);
    if (!from || !to || migration.toVersion <= migration.fromVersion
      || !to.stepIds.includes(migration.safeCheckpoint)
      || Object.keys(migration.stepMap).length !== from.stepIds.length
      || from.stepIds.some(id => !Object.prototype.hasOwnProperty.call(migration.stepMap, id)
        || (migration.stepMap[id] !== null && !to.stepIds.includes(migration.stepMap[id]!)))) return null;
  }
  for (const version of versions.keys()) {
    let destination = version;
    while (destination !== history.currentVersion) {
      const mapping = mappings.get(destination);
      if (!mapping) return null;
      destination = mapping.toVersion;
    }
  }
  const acknowledged = new Map<number, Set<string>>();
  for (const record of state.progress) {
    const version = versions.get(record.routeVersion);
    if (!version || acknowledged.has(record.routeVersion)
      || record.acknowledgedStepIds.some(id => !version.stepIds.includes(id))
      || new Set(record.acknowledgedStepIds).size !== record.acknowledgedStepIds.length) return null;
    acknowledged.set(record.routeVersion, new Set(record.acknowledgedStepIds));
  }
  let resume = state.resume, migrated = false;
  if (resume) {
    if (!versions.get(resume.routeVersion)?.stepIds.includes(resume.stepId)) return null;
    while (resume.routeVersion !== history.currentVersion) {
      const mapping = mappings.get(resume.routeVersion);
      if (!mapping) return null;
      resume = { routeVersion: mapping.toVersion, stepId: mapping.stepMap[resume.stepId] ?? mapping.safeCheckpoint };
      migrated = true;
    }
  }
  // Ascending versions also merges explicit acknowledgements through a chain.
  for (const version of [...versions.keys()].sort((left, right) => left - right)) {
    const old = acknowledged.get(version);
    if (!old || version === history.currentVersion) continue;
    const mapping = mappings.get(version);
    if (!mapping) return null;
    const next = acknowledged.get(mapping.toVersion) ?? new Set<string>();
    for (const id of old) {
      const equivalent = mapping.stepMap[id];
      if (equivalent !== null && !next.has(equivalent)) { next.add(equivalent); migrated = true; }
    }
    if (next.size && !acknowledged.has(mapping.toVersion)) acknowledged.set(mapping.toVersion, next);
  }
  const progress = [...acknowledged.keys()].sort((left, right) => left - right).map(routeVersion => Object.freeze({
    routeVersion,
    acknowledgedStepIds: Object.freeze(versions.get(routeVersion)!.stepIds.filter(id => acknowledged.get(routeVersion)!.has(id))),
  }));
  return Object.freeze({ resume: resume ? Object.freeze({ ...resume }) : null, progress: Object.freeze(progress), migrated });
}

/** Only an explicit, prerequisite-checked controller action calls this helper. */
export function acknowledgeBookyStep(
  progress: readonly BookyTourProgress[], route: PlanetMascotRoute, stepId: string,
): readonly BookyTourProgress[] {
  if (!isBookyRoute(route)) return progress;
  const definition = PLANET_MASCOT_ROUTES[route];
  if (!definition.steps.some(step => step.id === stepId)) return progress;
  const old = progress.find(record => record.route === route && record.routeVersion === definition.version);
  if (old?.acknowledgedStepIds.includes(stepId)) return progress;
  const acknowledged = new Set([...(old?.acknowledgedStepIds ?? []), stepId]);
  const next = Object.freeze({ route, routeVersion: definition.version,
    acknowledgedStepIds: Object.freeze(definition.steps.filter(step => acknowledged.has(step.id)).map(step => step.id)) });
  const result = [...progress.filter(record => record !== old), next];
  result.sort((left, right) => Object.keys(PLANET_MASCOT_ROUTES).indexOf(left.route)
    - Object.keys(PLANET_MASCOT_ROUTES).indexOf(right.route) || left.routeVersion - right.routeVersion);
  return Object.freeze(result);
}

export function isBookyRouteComplete(progress: readonly BookyTourProgress[], route: PlanetMascotRoute): boolean {
  if (!isBookyRoute(route)) return false;
  const definition = PLANET_MASCOT_ROUTES[route];
  const acknowledged = progress.find(record => record.route === route && record.routeVersion === definition.version)?.acknowledgedStepIds;
  return !!acknowledged && definition.steps.every(step => acknowledged.includes(step.id));
}

/** Forget one route, including its historical acknowledgements; visibility and
 * any other route remain the controller's independent choices. */
export function forgetBookyRoute(progress: readonly BookyTourProgress[], route: PlanetMascotRoute): readonly BookyTourProgress[] {
  if (!progress.some(record => record.route === route)) return progress;
  return Object.freeze(progress.filter(record => record.route !== route));
}
