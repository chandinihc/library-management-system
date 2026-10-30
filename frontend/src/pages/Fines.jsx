import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowRight, CircleDollarSign, CreditCard, Plus, WalletCards } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EmptyState, LoadError, Modal, PageHeader, SearchBox, Spinner } from "../components/Ui";
import { downloadCsv, errorMessage, formatDate, money } from "../utils";

export default function Fines() {
  const { user } = useAuth();
  const { notify } = useToast();
  const staff = user?.role === "admin" || user?.role === "librarian";
  const [fines, setFines] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ amount: "", method: "cash", reference: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const results = await Promise.all([api.get("/fines"), ...(staff ? [api.get("/payments")] : [])]);
      setFines(results[0].data);
      setPayments(staff ? results[1].data : []);
    } catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [staff]);
  function openPayment(fine) {
    const outstanding = Number(fine.amount) - Number(fine.paid_amount);
    setForm({ amount: outstanding.toFixed(2), method: "cash", reference: "" });
    setModal({ fine });
  }
  async function submitPayment(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/fines/${modal.fine.id}/payments`, form);
      notify("Payment recorded successfully.");
      setModal(null);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  const filtered = useMemo(() => fines.filter((fine) => !search || `${fine.student_name} ${fine.student_code} ${fine.book_title} ${fine.issue_code}`.toLowerCase().includes(search.toLowerCase())), [fines, search]);
  const outstanding = fines.reduce((sum, fine) => sum + Math.max(0, Number(fine.amount) - Number(fine.paid_amount)), 0);
  const collected = fines.reduce((sum, fine) => sum + Number(fine.paid_amount), 0);
  const pending = fines.filter((fine) => fine.status === "pending" || fine.status === "partial").length;

  return <>
    <PageHeader eyebrow="FINE LEDGER" title={staff ? "Fines & payments" : "My fines"} description={staff ? "A clear record of overdue charges and the payments received." : "Review your library fines and payment status."} actions={<button className="button button-secondary" onClick={() => downloadCsv("library-fines.csv", fines.map(({ student_name, student_code, book_title, issue_code, amount, paid_amount, status }) => ({ student_name, student_code, book_title, issue_code, amount, paid_amount, outstanding: Number(amount) - Number(paid_amount), status })))}><ArrowDownToLine size={16} /> Export CSV</button>} />
    {!loadError && <div className="mini-stat-row"><div className="mini-stat"><span className="mini-stat-icon rose"><CircleDollarSign size={17} /></span><span><small>Outstanding balance</small><b>{money(outstanding)}</b></span></div><div className="mini-stat"><span className="mini-stat-icon mint"><WalletCards size={17} /></span><span><small>Payments recorded</small><b>{money(collected)}</b></span></div><div className="mini-stat"><span className="mini-stat-icon amber"><CreditCard size={17} /></span><span><small>Unsettled fines</small><b>{pending}</b></span></div></div>}
    <section className="panel data-panel"><div className="data-toolbar"><SearchBox value={search} onChange={setSearch} placeholder={staff ? "Search student, book or loan..." : "Search book or loan..."} /><span className="result-count">{filtered.length} fine records</span></div>
      {loading ? <Spinner label="Loading fine ledger..." /> : loadError ? <LoadError message={loadError} onRetry={() => load()} /> : filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{staff && <th>STUDENT</th>}<th>BOOK / LOAN</th><th>AMOUNT</th><th>PAID</th><th>OUTSTANDING</th><th>STATUS</th><th>RECORDED</th>{staff && <th />}</tr></thead><tbody>{filtered.map((fine) => {
        const remaining = Math.max(0, Number(fine.amount) - Number(fine.paid_amount));
        return <tr key={fine.id}>{staff && <td><b className="table-primary">{fine.student_name}</b><small>{fine.student_code}</small></td>}<td><b>{fine.book_title}</b><small>{fine.issue_code} · due {formatDate(fine.due_at)}</small></td><td>{money(fine.amount)}</td><td className="text-green">{money(fine.paid_amount)}</td><td className={remaining ? "text-danger" : "text-green"}>{money(remaining)}</td><td><span className={`status-pill status-${fine.status}`}>{fine.status}</span></td><td>{formatDate(fine.created_at)}</td>{staff && <td>{remaining > 0 && <button className="button button-secondary button-sm" onClick={() => openPayment(fine)}><Plus size={14} /> Record payment</button>}</td>}</tr>;
      })}</tbody></table></div> : <EmptyState title="No fine records" text="Overdue charges will be recorded here automatically when a book is returned." />}
    </section>
    {staff && !loadError && <section className="panel data-panel payment-panel"><div className="panel-head"><div><h2>Recent payments</h2><p>Payment history across all student accounts</p></div><span className="result-count">{payments.length} payments</span></div>{payments.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>STUDENT</th><th>BOOK</th><th>AMOUNT</th><th>METHOD</th><th>REFERENCE</th><th>PAID ON</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><b className="table-primary">{payment.student_name}</b><small>{payment.student_code}</small></td><td>{payment.book_title}</td><td className="text-green">{money(payment.amount)}</td><td><span className="method-pill">{payment.method.replace("_", " ")}</span></td><td>{payment.reference || "—"}</td><td>{formatDate(payment.paid_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="No payments recorded" text="When a student settles a fine, the payment history will appear here." />}</section>}
    {modal && <Modal title="Record a payment" subtitle={`Outstanding balance: ${money(Number(modal.fine.amount) - Number(modal.fine.paid_amount))}`} onClose={() => setModal(null)}><form className="modal-form" onSubmit={submitPayment}><label>Payment amount<input className="text-input" required type="number" min="0.01" max={Number(modal.fine.amount) - Number(modal.fine.paid_amount)} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>Payment method<select className="text-input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label><label>Reference <span className="optional">(optional)</span><input className="text-input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Receipt or transaction ID" /></label><div className="inline-note"><CreditCard size={16} /> This records a payment only. No external payment gateway is connected.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Recording..." : "Record payment"} <ArrowRight size={15} /></button></div></form></Modal>}
  </>;
}
