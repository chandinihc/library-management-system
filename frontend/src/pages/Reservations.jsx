import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, BookOpen, CalendarClock, Clock3, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EmptyState, Modal, PageHeader, SearchBox, Spinner } from "../components/Ui";
import { errorMessage, formatDate } from "../utils";

export default function Reservations() {
  const { user } = useAuth();
  const { notify } = useToast();
  const isStudent = user?.role === "student";
  const [reservations, setReservations] = useState([]);
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [bookId, setBookId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/reservations");
      setReservations(data);
    } catch (error) { notify(errorMessage(error), "error"); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!isStudent) return;
    api.get("/books", { params: { limit: 100, availability: "unavailable" } })
      .then(({ data }) => setBooks(data.items)).catch((error) => notify(errorMessage(error), "error"));
  }, [isStudent]);
  async function reserve(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/reservations", { book_id: bookId });
      notify(data.message);
      setModal(null);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  async function cancel(reservation) {
    try {
      const { data } = await api.delete(`/reservations/${reservation.id}`);
      notify(data.message);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); }
  }
  const visible = useMemo(() => reservations.filter((item) => {
    if (!search) return true;
    return `${item.book_title} ${item.student_name} ${item.student_code} ${item.reservation_code}`.toLowerCase().includes(search.toLowerCase());
  }), [reservations, search]);
  const waitingCount = reservations.filter((item) => item.status === "pending").length;
  const readyCount = reservations.filter((item) => item.status === "ready").length;

  return <>
    <PageHeader eyebrow="BOOK QUEUE" title="Reservations" description={isStudent ? "Keep your place in the queue and we'll let you know when a book is ready." : "Manage the borrowing queue and help readers get the titles they need."} actions={isStudent && <button className="button button-primary" onClick={() => { setBookId(""); setModal({ mode: "create" }); }}><Plus size={16} /> Reserve a book</button>} />
    <div className="mini-stat-row"><div className="mini-stat"><span className="mini-stat-icon amber"><Clock3 size={17} /></span><span><small>In the queue</small><b>{waitingCount}</b></span></div><div className="mini-stat"><span className="mini-stat-icon mint"><BellRing size={17} /></span><span><small>Ready to collect</small><b>{readyCount}</b></span></div><div className="mini-stat"><span className="mini-stat-icon violet"><BookOpen size={17} /></span><span><small>Total reservations</small><b>{reservations.length}</b></span></div></div>
    {isStudent && readyCount > 0 && <div className="reservation-alert"><BellRing size={18} /><div><b>A book is ready for you</b><span>Visit the library before the reservation expires to collect it.</span></div><Link to="/notifications">View notifications <ArrowRight size={14} /></Link></div>}
    <section className="panel data-panel"><div className="data-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search book, student or reservation ID..." /><span className="result-count">{visible.length} reservations</span></div>
      {loading ? <Spinner label="Loading reservations..." /> : visible.length ? <div className="reservation-grid">{visible.map((reservation) => <article className={`reservation-card ${reservation.status === "ready" ? "reservation-ready" : ""}`} key={reservation.id}>
        <div className="reservation-card-top"><span className={`reservation-status status-${reservation.status}`}>{reservation.status}</span><span className="reservation-code">{reservation.reservation_code}</span></div>
        <div className="reservation-book"><span className="reservation-cover">{reservation.cover_image ? <img src={`${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:4000"}${reservation.cover_image}`} alt="" /> : <BookOpen size={22} />}</span><span><b>{reservation.book_title}</b><small>{reservation.student_name} · {reservation.student_code}</small></span></div>
        <div className="reservation-meta"><span><Clock3 size={14} /> {reservation.status === "pending" ? `Queue position ${reservation.queue_position || "—"}` : `Placed ${formatDate(reservation.queued_at)}`}</span>{reservation.expires_at && <span className="expiry-note"><CalendarClock size={14} /> Expires {formatDate(reservation.expires_at)}</span>}</div>
        <div className="reservation-card-footer"><span>{formatDate(reservation.queued_at)}</span>{["pending", "ready"].includes(reservation.status) && (isStudent || user?.role === "admin" || user?.role === "librarian") && <button className="text-button danger-text" onClick={() => cancel(reservation)}><X size={14} /> Cancel</button>}</div>
      </article>)}</div> : <EmptyState title="No reservations yet" text={isStudent ? "When a book is checked out, reserve your place in line." : "Student reservations will appear here."} />}
    </section>
    {modal && <Modal title="Reserve a book" subtitle="Join the waiting list for a title that is currently checked out." onClose={() => setModal(null)}><form className="modal-form" onSubmit={reserve}><label>Choose a book<select className="text-input" required value={bookId} onChange={(e) => setBookId(e.target.value)}><option value="">Select a title</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><div className="inline-note"><BellRing size={16} /> We'll add you to the queue and notify you when a copy becomes available.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Reserving..." : "Join reservation queue"} <ArrowRight size={15} /></button></div></form></Modal>}
  </>;
}
