export function formatDate(date?: string) {
  if (!date) return "";

  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) return date;

  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}
