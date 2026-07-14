/** RFC 4180: quote a field when it contains a delimiter, quote or newline. */
export function csvField(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvLine(fields: (string | number)[]) {
  return fields.map(csvField).join(",");
}
