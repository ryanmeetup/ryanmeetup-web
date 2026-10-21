/**
 * RFC 4180 CSV, kept deliberately small. The fulfillment center reads back the
 * file it sent, so the header order and every cell it wrote survive a round
 * trip untouched; only the `Verified?` column is ever rewritten.
 */

export type CsvTable = { headers: string[]; rows: string[][] };

export class CsvParseError extends Error {}

export function parseCsv(text: string): CsvTable {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
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
          closedQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (closedQuote && char !== "," && char !== "\n" && char !== "\r")
      throw new CsvParseError(
        "There is unexpected text after a quoted CSV cell. Check the file's quotes.",
      );
    if (char === '"' && field !== "")
      throw new CsvParseError(
        "A CSV quote appears inside an unquoted cell. Check the file's quotes.",
      );
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
      closedQuote = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      closedQuote = false;
    } else {
      field += char;
    }
  }
  if (quoted)
    throw new CsvParseError(
      "A quoted CSV cell was not closed. Check the file's quotes.",
    );
  if (field !== "" || record.length || closedQuote) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((row) => row.some((cell) => cell !== ""));
  const [headers = [], ...rows] = nonEmpty;
  const wrong = rows.findIndex((row) => row.length !== headers.length);
  if (wrong >= 0)
    throw new CsvParseError(
      `CSV data row ${wrong + 1} has ${rows[wrong].length} cells; expected ${headers.length}. Check its delimiters.`,
    );
  return { headers, rows };
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
