export function errorMessage(error) {
  return error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
}

export function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "—";
  const date = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", options).format(date);
}

export function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const escape = (value) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(value)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [Object.keys(rows[0]), ...rows.map((row) => Object.values(row))]
    .map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
