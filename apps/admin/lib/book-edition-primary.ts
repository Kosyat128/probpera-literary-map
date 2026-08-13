type PrimaryEditionCompensationOptions<Result> = {
  enabled: boolean;
  readPreviousPrimaryIds: () => Promise<string[]>;
  demotePreviousPrimaries: (ids: readonly string[]) => Promise<void>;
  persist: () => Promise<Result>;
  restorePreviousPrimaries: (ids: readonly string[]) => Promise<void>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "неизвестная ошибка");
}

/**
 * Supabase's HTTP client cannot wrap multiple statements in a client-side SQL
 * transaction. This guard therefore makes the primary handoff compensating:
 * when persistence fails after a successful demotion, the previous primary is
 * restored and that restoration is itself checked rather than ignored.
 */
export async function persistWithPrimaryEditionCompensation<Result>({
  enabled,
  readPreviousPrimaryIds,
  demotePreviousPrimaries,
  persist,
  restorePreviousPrimaries,
}: PrimaryEditionCompensationOptions<Result>) {
  const previousPrimaryIds = enabled ? await readPreviousPrimaryIds() : [];
  if (previousPrimaryIds.length) {
    await demotePreviousPrimaries(previousPrimaryIds);
  }

  try {
    return await persist();
  } catch (persistenceError) {
    if (!previousPrimaryIds.length) throw persistenceError;
    try {
      await restorePreviousPrimaries(previousPrimaryIds);
    } catch (restorationError) {
      throw new Error(
        `Не удалось сохранить издание и автоматически вернуть прежнее основное издание. ` +
          `Сохранение: ${errorMessage(persistenceError)}. ` +
          `Восстановление: ${errorMessage(restorationError)}.`,
        { cause: persistenceError }
      );
    }
    throw persistenceError;
  }
}
