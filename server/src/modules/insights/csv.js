// Quote every cell; prefix formula-capable text even after whitespace/control characters.
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(text) && /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function csv(columns, rows) { return '\uFEFF' + [columns.map((c) => csvCell(c.label + (c.unit ? ` (${c.unit})` : ''))).join(','), ...rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(','))].join('\r\n') + '\r\n'; }
