import { useEffect, useState } from "react";
import { ArrowDownToLine, BarChart3, BookOpen, CalendarRange, CircleDollarSign, RefreshCw, Users } from "lucide-react";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { EmptyState, LoadError, PageHeader, Spinner } from "../components/Ui";
import { downloadCsv, errorMessage, formatDate, money } from "../utils";

export default function Reports() {
  const { notify } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [range, setRange] = useState({ start_date: "", end_date: "" });
  async function load(nextRange = range) {
    setLoading(true);
    setLoadError("");
    setData(null);
    try {
      const { data: result } = await api.get("/reports", { params: { start_date: nextRange.start_date || undefined, end_date: nextRange.end_date || undefined } });
      setData(result);
    } catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function exportRows() {
    if (!data) return;
    const summary = [
      { section: "Inventory", metric: "Titles", value: data.inventory.titles },
      { section: "Inventory", metric: "Total copies", value: data.inventory.total_copies },
      { section: "Inventory", metric: "Available copies", value: data.inventory.available_copies }
    ];
    downloadCsv("library-report.csv", [
      ...summary,
      ...data.borrowed.map((item) => ({ section: "Borrowing", metric: item.book_title, value: `${item.student_name} · ${item.student_code} · ${item.status} · ${item.issued_at}` })),
      ...data.overdue.map((item) => ({ section: "Overdue", metric: item.book_title, value: `${item.student_name} · ${item.days_overdue} days overdue` })),
      ...data.fines.map((item) => ({ section: "Payments", metric: item.book_title, value: `${item.student_name} · ${item.amount} · ${item.method} · ${item.paid_at}` })),
      ...data.categories.map((item) => ({ section: "Categories", metric: item.category, value: `${item.titles} titles · ${item.copies} copies · ${item.loans} loans` })),
      ...data.leastBorrowed.map((item) => ({ section: "Least borrowed", metric: item.title, value: `${item.loan_count} loans` })),
      ...data.monthly.map((item) => ({ section: "Monthly circulation", metric: item.month, value: `${item.issues} issues · ${item.returns_count} returns` }))
    ]);
  }
  return <>
    <PageHeader eyebrow="INSIGHTS & EXPORTS" title="Reports & analytics" description="Explore circulation, collection health, and fine activity with a custom date range." actions={<button className="button button-secondary" onClick={exportRows} disabled={!data}><ArrowDownToLine size={16} /> Export report CSV</button>} />
    <section className="panel report-filter"><div className="report-filter-copy"><span className="mini-stat-icon violet"><CalendarRange size={17} /></span><div><b>Filter report period</b><small>Use issue date and payment date to narrow the results.</small></div></div><div className="report-date-fields"><label>From<input className="text-input" type="date" value={range.start_date} onChange={(e) => setRange({ ...range, start_date: e.target.value })} /></label><label>To<input className="text-input" type="date" value={range.end_date} onChange={(e) => setRange({ ...range, end_date: e.target.value })} /></label><button className="button button-primary" onClick={() => load()} disabled={loading}><RefreshCw size={15} /> Apply</button><button className="button button-quiet" onClick={() => { const clean = { start_date: "", end_date: "" }; setRange(clean); load(clean); }}>Reset</button></div></section>
    {loading ? <Spinner label="Building reports from library records..." /> : loadError && !data ? <LoadError message={loadError} onRetry={() => load()} /> : data ? <>
      {loadError && <LoadError message={loadError} onRetry={() => load()} />}
      <div className="report-summary-grid"><div className="report-summary-card"><span className="report-summary-icon violet"><BookOpen size={18} /></span><small>Titles in collection</small><strong>{Number(data.inventory.titles).toLocaleString()}</strong><span>{Number(data.inventory.total_copies).toLocaleString()} total copies</span></div><div className="report-summary-card"><span className="report-summary-icon mint"><BarChart3 size={18} /></span><small>Copies available</small><strong>{Number(data.inventory.available_copies).toLocaleString()}</strong><span>{Number(data.inventory.total_copies) - Number(data.inventory.available_copies)} currently issued</span></div><div className="report-summary-card"><span className="report-summary-icon amber"><Users size={18} /></span><small>Transactions in range</small><strong>{data.borrowed.length.toLocaleString()}</strong><span>{range.start_date || range.end_date ? "Filtered period" : "All recorded issues"}</span></div><div className="report-summary-card"><span className="report-summary-icon rose"><CircleDollarSign size={18} /></span><small>Payments in range</small><strong>{money(data.fines.reduce((sum, item) => sum + Number(item.amount), 0))}</strong><span>{data.fines.length} payments recorded</span></div></div>
      <div className="report-grid">
        <section className="panel data-panel report-section"><div className="panel-head"><div><h2>Borrowing history</h2><p>Issues in the selected date range</p></div><span className="result-count">{data.borrowed.length} rows</span></div>{data.borrowed.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>BOOK</th><th>STUDENT</th><th>ISSUED</th><th>DUE</th><th>STATUS</th></tr></thead><tbody>{data.borrowed.slice(0, 100).map((item) => <tr key={item.issue_code}><td><b>{item.book_title}</b><small>{item.issue_code}</small></td><td><b className="table-primary">{item.student_name}</b><small>{item.student_code}</small></td><td>{formatDate(item.issued_at)}</td><td>{formatDate(item.due_at)}</td><td><span className={`status-pill status-${item.status}`}>{item.status}</span></td></tr>)}</tbody></table></div> : <EmptyState title="No borrowing records" text="There are no issues for this date range." />}</section>
        <section className="panel data-panel report-section"><div className="panel-head"><div><h2>Overdue books</h2><p>Currently overdue, across all dates</p></div><span className="result-count">{data.overdue.length} rows</span></div>{data.overdue.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>BOOK / STUDENT</th><th>DUE DATE</th><th>DAYS LATE</th></tr></thead><tbody>{data.overdue.map((item) => <tr key={item.issue_code}><td><b>{item.book_title}</b><small>{item.student_name} · {item.student_code}</small></td><td className="text-danger">{formatDate(item.due_at)}</td><td><span className="overdue-days">{item.days_overdue}d</span></td></tr>)}</tbody></table></div> : <div className="all-clear"><span>✓</span><div><b>All caught up</b><small>No overdue books right now.</small></div></div>}</section>
        <section className="panel data-panel report-section"><div className="panel-head"><div><h2>Category performance</h2><p>Collection size and circulation by category</p></div></div>{data.categories.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>CATEGORY</th><th>TITLES</th><th>COPIES</th><th>LOANS</th></tr></thead><tbody>{data.categories.map((item) => <tr key={item.category}><td><b>{item.category}</b></td><td>{item.titles}</td><td>{item.copies}</td><td>{item.loans}</td></tr>)}</tbody></table></div> : <EmptyState title="No category data" text="Add categories and books to see collection performance." />}</section>
        <section className="panel data-panel report-section"><div className="panel-head"><div><h2>Least borrowed titles</h2><p>Books with the fewest recorded checkouts</p></div></div>{data.leastBorrowed.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>BOOK</th><th>LOANS</th></tr></thead><tbody>{data.leastBorrowed.map((item) => <tr key={item.id}><td><b>{item.title}</b></td><td>{item.loan_count}</td></tr>)}</tbody></table></div> : <EmptyState title="No books in the collection" text="Add titles to see borrowing comparisons." />}</section>
        <section className="panel data-panel report-section"><div className="panel-head"><div><h2>Monthly circulation</h2><p>Issues and returns over the last 12 months</p></div></div>{data.monthly.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>MONTH</th><th>ISSUES</th><th>RETURNS</th></tr></thead><tbody>{data.monthly.map((item) => <tr key={item.month}><td><b>{formatDate(`${item.month}-01`, { month: "long", year: "numeric" })}</b></td><td>{item.issues}</td><td>{item.returns_count}</td></tr>)}</tbody></table></div> : <EmptyState title="No circulation data" text="Monthly issues and returns will appear here." />}</section>
        <section className="panel data-panel report-section"><div className="panel-head"><div><h2>Fine payments</h2><p>Recorded payments in the selected range</p></div><span className="result-count">{data.fines.length} payments</span></div>{data.fines.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>STUDENT / BOOK</th><th>METHOD</th><th>AMOUNT</th><th>PAID ON</th></tr></thead><tbody>{data.fines.map((item, index) => <tr key={`${item.reference}-${item.paid_at}-${index}`}><td><b>{item.student_name}</b><small>{item.book_title}</small></td><td>{item.method.replace("_", " ")}</td><td className="text-green">{money(item.amount)}</td><td>{formatDate(item.paid_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="No payments in this range" text="Try widening the selected date range." />}</section>
      </div>
    </> : null}
  </>;
}
