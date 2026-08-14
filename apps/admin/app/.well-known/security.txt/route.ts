const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;
const EXPIRY_DAYS = 180;

export function createSecurityDocument(now = new Date()): string {
  const expires = new Date(now.getTime() + EXPIRY_DAYS * DAY_IN_MILLISECONDS);
  return [
    "Contact: mailto:probperasite@yandex.ru",
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: ru, en",
    "Canonical: https://admin.probpera.ru/.well-known/security.txt",
    "",
  ].join("\n");
}

export function GET() {
  return new Response(createSecurityDocument(), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
