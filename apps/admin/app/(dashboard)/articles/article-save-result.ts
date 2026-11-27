export const articleSaveUnconfirmed = { outcome: "unconfirmed" } as const;

export class UnconfirmedArticleSaveError extends Error {
  constructor() {
    super("Сервер не подтвердил результат сохранения статьи.");
    this.name = "UnconfirmedArticleSaveError";
  }
}

export async function requestArticleMutation<T extends { status: number }>(
  run: () => PromiseLike<T>
): Promise<T> {
  let response: T;
  try {
    response = await run();
  } catch {
    throw new UnconfirmedArticleSaveError();
  }
  // A transport or gateway failure can arrive after Postgres commits.
  if (response.status === 0 || response.status === 408 || response.status === 499 ||
      (response.status >= 500 && response.status <= 599)) {
    throw new UnconfirmedArticleSaveError();
  }
  return response;
}
