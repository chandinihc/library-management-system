import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BookOpen, CalendarClock, Check, Clock3, Plus, Search, Undo2 } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EmptyState, LoadError, Modal, PageHeader, SearchBox, Spinner } from "../components/Ui";
import { errorMessage, formatDate, money } from "../utils";

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return dateInputValue(date);
}

export default function Circulation() {
  const { user } = useAuth();
  const { notify } = useToast();
  const staff = user?.role === "admin" || user?.role === "librarian";
  const [issues, setIssues] = useState([]);
  const [books, setBooks] = useState([]);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ book_id: "", student_id: "", due_at: defaultDueDate() });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get("/issues", { params: { status: status || undefined } });
      setIssues(data);
    } catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    if (!staff) return;
    Promise.all([
      api.get("/books", { params: { limit: 100 } }),
      api.get("/students", { params: { status: "active", limit: 100 } })
    ]).then(([bookResult, studentResult]) => {
      setBooks(bookResult.data.items);
      setStudents(studentResult.data.items.filter((student) => student.status === "active"));
    }).catch((error) => notify(errorMessage(error), "error"));
  }, [staff]);

  function openIssue() {
    setForm({ book_id: "", student_id: "", due_at: defaultDueDate() });
    setModal({ mode: "issue" });
  }
  async function issueBook(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/issues", form);
      notify(data.message);
      setModal(null);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  async function returnBook() {
    setBusy(true);
    try {
      const { data } = await api.post(`/issues/${modal.issue.id}/return`);
      notify(data.fineAmount > 0 ? `Book returned. ${money(data.fineAmount)} fine recorded.` : data.message);
      setModal(null);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  const filtered = useMemo(() => {
    if (!search.trim()) return issues;
    const term = search.toLowerCase();
    return issues.filter((item) => `${item.book_title} ${item.student_name} ${item.student_code} ${item.issue_code}`.toLowerCase().includes(term));
  }, [issues, search]);
  const overdue = issues.filter((item) => item.status === "overdue").length;
  const checkedOut = issues.filter((item) => item.status === "issued" || item.status === "overdue").length;

  return <>
    <PageHeader eyebrow={staff ? "LENDING DESK" : "YOUR LIBRARY"} title={staff ? "Circulation" : "My loans"} description={staff ? "Check books in and out, and keep every loan on track." : "Your active loans, due dates, and full borrowing history."} actions={staff && <button className="button button-primary" onClick={openIssue}><Plus size={17} /> Check out a book</button>} />
    {!loadError && <div className="mini-stat-row"><div className="mini-stat"><span className="mini-stat-icon violet"><BookOpen size={17} /></span><span><small>{staff ? "Active loans shown" : "Currently borrowed"}</small><b>{checkedOut}</b></span></div><div className="mini-stat"><span className={`mini-stat-icon ${overdue ? "rose" : "mint"}`}><CalendarClock size={17} /></span><span><small>Overdue shown</small><b>{overdue}</b></span></div><div className="mini-stat"><span className="mini-stat-icon amber"><Clock3 size={17} /></span><span><small>Transactions shown</small><b>{issues.length}</b></span></div></div>}
    <section className="panel data-panel">
      <div className="data-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search title, student or loan ID..." /><select className="toolbar-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All loan statuses</option><option value="issued">On loan</option><option value="overdue">Overdue</option><option value="returned">Returned</option></select><span className="result-count">{filtered.length} transactions</span></div>
      {loading ? <Spinner label="Loading loan history..." /> : loadError ? <LoadError message={loadError} onRetry={() => load()} /> : filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>BOOK</th>{staff && <th>STUDENT</th>}<th>CHECKED OUT</th><th>DUE DATE</th><th>RETURNED</th><th>STATUS</th>{staff && <th>FINE</th>}<th /></tr></thead><tbody>{filtered.map((issue) => <tr key={issue.id}>
        <td><div className="table-book"><span className="table-book-icon"><BookOpen size={17} /></span><span><b>{issue.book_title}</b><small>{issue.book_code} · {issue.issue_code}</small></span></div></td>
        {staff && <td><b className="table-primary">{issue.student_name}</b><small>{issue.student_code}</small></td>}
        <td>{formatDate(issue.issued_at)}</td><td className={issue.status === "overdue" ? "text-danger" : ""}>{formatDate(issue.due_at)}</td><td>{formatDate(issue.returned_at)}</td>
        <td><span className={`status-pill status-${issue.status}`}>{issue.status}</span></td>
        {staff && <td>{Number(issue.fine_amount) ? money(Math.max(0, Number(issue.fine_amount) - Number(issue.paid_amount))) : "—"}</td>}
        <td>{staff && ["issued", "overdue"].includes(issue.status) && <button className="button button-secondary button-sm" onClick={() => setModal({ mode: "return", issue })}><Undo2 size={14} /> Return</button>}</td>
      </tr>)}</tbody></table></div> : <EmptyState title={search ? "No matching loans" : "No loan activity yet"} text={search ? "Try a different search term." : staff ? "When a book is checked out, it will appear here." : "Books you borrow will appear here."} />}
      <div className="table-footnote"><span><i className="sync-status-dot" /> Loan and stock changes are recorded atomically</span><span>Up to 250 recent transactions</span></div>
    </section>
    {modal?.mode === "issue" && <Modal title="Check out a book" subtitle="Select an available title, a student, and a return date." onClose={() => setModal(null)}>
      <form className="modal-form" onSubmit={issueBook}><label>Book<select className="text-input" required value={form.book_id} onChange={(e) => setForm({ ...form, book_id: e.target.value })}><option value="">Choose a book</option>{books.map((book) => <option value={book.id} key={book.id} disabled={Number(book.available_copies) < 1}>{book.title} · {book.available_copies} available</option>)}</select></label><label>Student<select className="text-input" required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}><option value="">Choose a student</option>{students.map((student) => <option value={student.id} key={student.id}>{student.full_name} · {student.student_code}</option>)}</select></label><label>Due date<input className="text-input" required type="date" min={new Date().toISOString().slice(0, 10)} value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></label><div className="inline-note"><CalendarClock size={16} /> Default borrowing period is 14 days. The due date is saved with the issue.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Checking out..." : "Confirm checkout"} <ArrowUpRight size={15} /></button></div></form>
    </Modal>}
    {modal?.mode === "return" && <Modal title="Return this book?" subtitle="The copy will be marked available immediately." onClose={() => setModal(null)}><div className="confirm-box"><div className="confirm-icon mint"><BookOpen size={20} /></div><p><b>{modal.issue.book_title}</b><br />Borrowed by {modal.issue.student_name} · Due {formatDate(modal.issue.due_at)}</p></div><div className="inline-note"><CalendarClock size={16} /> Any overdue fine will be calculated automatically and added to the student's account.</div><div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy} onClick={returnBook}>{busy ? "Returning..." : "Confirm return"} <ArrowDownRight size={15} /></button></div></Modal>}
  </>;
}
