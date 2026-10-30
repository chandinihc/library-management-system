import { useEffect, useState } from "react";
import { ArrowDownUp, ArrowRight, BookOpen, Edit3, Eye, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EmptyState, LoadError, Modal, PageHeader, SearchBox, Spinner } from "../components/Ui";
import { downloadCsv, errorMessage, formatDate, money } from "../utils";

const blank = { full_name: "", email: "", phone: "", password: "", department: "", course: "", year_of_study: "", address: "" };

export default function Students() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ active_students: 0, departments: 0, outstanding_fines: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blank);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const pageSize = 10;
  async function load(currentPage = page) {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get("/students", { params: { page: currentPage, limit: pageSize, search: search || undefined, status: status || undefined } });
      setStudents(data.items);
      setTotal(data.total);
      setSummary(data.summary);
    } catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  }
  useEffect(() => {
    setPage(1);
    const timer = window.setTimeout(() => load(1), search ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [search, status]);
  function openForm(student) {
    setForm(student ? {
      full_name: student.full_name, email: student.email, phone: student.phone || "", department: student.department,
      course: student.course, year_of_study: student.year_of_study || "", address: student.address || "", status: student.status
    } : blank);
    setModal(student ? { mode: "edit", id: student.id } : { mode: "create" });
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (modal.mode === "create") await api.post("/students", form);
      else await api.put(`/students/${modal.id}`, form);
      notify(modal.mode === "create" ? "Student account created." : "Student profile updated.");
      setModal(null);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  async function showHistory(student) {
    try {
      const { data } = await api.get(`/students/${student.id}/history`);
      setHistory(data);
      setModal({ mode: "history", student });
    } catch (error) { notify(errorMessage(error), "error"); }
  }
  async function deactivate() {
    try {
      await api.delete(`/students/${pendingDelete.id}`);
      notify("Student account deactivated.");
      setPendingDelete(null);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); }
  }
  const canDeactivate = user?.role === "admin";

  return <>
    <PageHeader eyebrow="MEMBER DIRECTORY" title="Students" description="Manage student accounts, their borrowing activity, and outstanding balances." actions={<>
      <button className="button button-secondary" onClick={() => downloadCsv("library-students.csv", students.map(({ student_code, full_name, email, phone, department, course, active_loans, outstanding_fines, status }) => ({ student_code, full_name, email, phone, department, course, active_loans, outstanding_fines, status })))}><ArrowDownUp size={16} /> Export page</button>
      <button className="button button-primary" onClick={() => openForm(null)}><Plus size={17} /> Add student</button>
    </>} />
    {!loadError && <div className="mini-stat-row"><div className="mini-stat"><span className="mini-stat-icon violet"><UserRound size={17} /></span><span><small>Active members</small><b>{summary.active_students}</b></span></div><div className="mini-stat"><span className="mini-stat-icon mint"><BookOpen size={17} /></span><span><small>Departments</small><b>{summary.departments}</b></span></div><div className="mini-stat"><span className="mini-stat-icon rose"><span className="currency-small">₹</span></span><span><small>Outstanding fines</small><b>{money(summary.outstanding_fines)}</b></span></div></div>}
    <section className="panel data-panel">
      <div className="data-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search name, ID, email or department..." /><select className="toolbar-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All account statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><span className="result-count">{students.length} students</span></div>
      {loading ? <Spinner label="Loading student directory..." /> : loadError ? <LoadError message={loadError} onRetry={() => load()} /> : students.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>DEPARTMENT / COURSE</th><th>BOOKS OUT</th><th>OUTSTANDING</th><th>STATUS</th><th /></tr></thead><tbody>{students.map((student, index) => <tr key={student.id}>
        <td><div className="table-person"><span className={`avatar table-avatar avatar-color-${index % 5}`}>{student.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><b>{student.full_name}</b><small>{student.email}</small></span></div></td>
        <td><span className="code-label">{student.student_code}</span></td>
        <td><b className="table-primary">{student.department}</b><small>{student.course}{student.year_of_study ? ` · Year ${student.year_of_study}` : ""}</small></td>
        <td><span className={Number(student.active_loans) ? "loan-count" : "muted-text"}>{student.active_loans}</span></td>
        <td className={Number(student.outstanding_fines) ? "text-danger" : "muted-text"}>{money(student.outstanding_fines)}</td>
        <td><span className={`status-pill status-${student.status}`}>{student.status}</span></td>
        <td><div className="row-actions"><button className="icon-button" title="Borrowing history" onClick={() => showHistory(student)}><Eye size={16} /></button><button className="icon-button" title="Edit student" onClick={() => openForm(student)}><Edit3 size={15} /></button>{canDeactivate && student.status === "active" && <button className="icon-button danger-hover" title="Deactivate student" onClick={() => setPendingDelete(student)}><Trash2 size={15} /></button>}</div></td>
      </tr>)}</tbody></table></div> : <EmptyState title="No students found" text={search ? "Try another search term." : "Add a student to create the first member account."} />}
      {!loadError && <div className="pagination-row"><span>Showing <b>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}</b> of <b>{total}</b> students</span><div><button className="button button-secondary button-sm" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}>Previous</button><button className="button button-secondary button-sm" disabled={page * pageSize >= total} onClick={() => { setPage(page + 1); load(page + 1); }}>Next <ArrowRight size={14} /></button></div></div>}
    </section>
    {modal?.mode === "create" || modal?.mode === "edit" ? <Modal title={modal.mode === "create" ? "Add a student" : "Edit student"} subtitle="Student account and academic details." onClose={() => setModal(null)} wide>
      <form className="modal-form" onSubmit={submit}><div className="form-grid">
        <label>Full name<input className="text-input" required minLength="2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label>Email address<input className="text-input" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        {modal.mode === "create" && <label className="span-two">Temporary password<input className="text-input" required minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small className="field-hint">The student can change this password from their account settings.</small></label>}
        <label>Phone<input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Department<input className="text-input" required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
        <label>Course<input className="text-input" required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /></label>
        <label>Year of study<input className="text-input" type="number" min="1" max="10" value={form.year_of_study} onChange={(e) => setForm({ ...form, year_of_study: e.target.value })} /></label>
        <label className="span-two">Address<input className="text-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        {modal.mode === "edit" && <label>Account status<select className="text-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
      </div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving..." : modal.mode === "create" ? "Create student" : "Save changes"}</button></div></form>
    </Modal> : null}
    {modal?.mode === "history" && <Modal wide title={`${modal.student.full_name} — borrowing history`} subtitle={`${modal.student.student_code} · ${history.length} recorded transactions`} onClose={() => setModal(null)}>
      {history.length ? <div className="table-scroll history-table"><table><thead><tr><th>BOOK</th><th>ISSUED</th><th>DUE</th><th>RETURNED</th><th>STATUS</th><th>FINE</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><b>{item.title}</b><small>{item.issue_code}</small></td><td>{formatDate(item.issued_at)}</td><td>{formatDate(item.due_at)}</td><td>{formatDate(item.returned_at)}</td><td><span className={`status-pill status-${item.status}`}>{item.status}</span></td><td>{item.fine_amount ? money(Number(item.fine_amount) - Number(item.paid_amount || 0)) : "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No borrowing history" text="This student has not borrowed any books yet." />}
      <div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)}>Close</button></div>
    </Modal>}
    {pendingDelete && <Modal title="Deactivate this account?" subtitle="The student will no longer be able to sign in." onClose={() => setPendingDelete(null)}><div className="confirm-box"><div className="confirm-icon"><UserRound size={20} /></div><p><b>{pendingDelete.full_name}</b>'s library account will be deactivated.</p></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setPendingDelete(null)}>Cancel</button><button className="button button-danger" onClick={deactivate}>Deactivate account</button></div></Modal>}
  </>;
}
