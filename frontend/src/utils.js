export function errorMessage(error) {
  return error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
}

export function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", options).format(date);
}

export function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [Object.keys(rows[0]), ...rows.map((row) => Object.values(row))]
    .map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
