/**
 * RFC 4180 CSV, kept deliberately small. The fulfillment center reads back the
 * file it sent, so the header order and every cell it wrote survive a round
 * trip untouched; only the `Verified?` column is ever rewritten.
 */

export type CsvTable = { headers: string[]; rows: string[][] };

export function parseCsv(text: string): CsvTable {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  // A leading byte-order mark belongs to the encoding, not the first header.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((row) => row.some((cell) => cell !== ""));
  const [headers = [], ...rows] = nonEmpty;
  return {
    headers,
    rows: rows.map((row) => headers.map((_, column) => row[column] ?? "")),
  };
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializeCsv({ headers, rows }: CsvTable) {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")
    .concat("\r\n");
}

/** Column index by header, ignoring case and surrounding space. */
export function csvColumn(headers: string[], name: string) {
  const wanted = name.trim().toLowerCase();
  return headers.findIndex((header) => header.trim().toLowerCase() === wanted);
}
