export function articleEditPath(
  id: string,
  params: Record<string, string | number | boolean | null | undefined> = {}
) {
  const search = new URLSearchParams({ id });

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }

  return `/articles/edit?${search.toString()}`;
}
