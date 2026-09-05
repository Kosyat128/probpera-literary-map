export function parseCsv(source) {
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  const text = source.replace(/^\ufeff/, "");
  const endField = () => { row.push(field); field = ""; closed = false; };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"') {
      if (field || closed) throw new Error("Unexpected CSV quote");
      quoted = true;
    } else if (char === ",") endField();
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endField(); rows.push(row); row = [];
    } else {
      if (closed) throw new Error("Unexpected text after CSV quote");
      field += char;
    }
  }
  if (quoted) throw new Error("Unterminated CSV quote");
  if (field || closed || row.length) { endField(); rows.push(row); }
  const headers = rows.shift();
  if (!headers?.length || headers.some(header => !header) || new Set(headers).size !== headers.length) {
    throw new Error("Invalid CSV headers");
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2}: column count mismatch`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}
export function formatCsv(rows, headers) {
  const escape = value => /[",\r\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value);
  return [headers, ...rows.map(row => headers.map(header => row[header] ?? ""))]
    .map(row => row.map(escape).join(",")).join("\n") + "\n";
}
