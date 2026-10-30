import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDownUp, ArrowLeft, ArrowRight, BookOpen, Edit3, Eye, Filter, Plus, Trash2, UploadCloud } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EmptyState, LoadError, Modal, PageHeader, SearchBox, Spinner } from "../components/Ui";
import { downloadCsv, errorMessage, formatDate } from "../utils";

const blankForm = { title: "", isbn: "", category_id: "", publisher: "", publication_year: "", edition: "", description: "", total_copies: 1, author_ids: [] };
const coverUrl = (value) => value ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:4000"}${value}` : null;

export default function Books() {
  const { user } = useAuth();
  const { notify } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const staff = user?.role === "admin" || user?.role === "librarian";
  const canDelete = user?.role === "admin";
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [search, setSearch] = useState(new URLSearchParams(location.search).get("search") || "");
  const [category, setCategory] = useState(new URLSearchParams(location.search).get("category_id") || "");
  const [availability, setAvailability] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [cover, setCover] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const limit = 12;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      loadBooks(1);
    }, search ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [search, category, availability]);
  useEffect(() => {
    api.get("/directory/categories").then(({ data }) => setCategories(data)).catch((error) => notify(errorMessage(error), "error"));
    api.get("/directory/authors").then(({ data }) => setAuthors(data)).catch((error) => notify(errorMessage(error), "error"));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("search") || "");
    setCategory(params.get("category_id") || "");
  }, [location.search]);

  async function loadBooks(currentPage = page) {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get("/books", { params: { page: currentPage, limit, search: search || undefined, category_id: category || undefined, availability: availability || undefined } });
      setBooks(data.items);
      setTotal(Number(data.total));
    } catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  }
  async function refresh() { await loadBooks(); }
  function openForm(book = null) {
    setCover(null);
    if (book) {
      const selectedAuthorIds = Array.isArray(book.authors) ? book.authors.map((item) => item.id) : [];
      setForm({ title: book.title, isbn: book.isbn, category_id: book.category_id || "", publisher: book.publisher || "", publication_year: book.publication_year || "", edition: book.edition || "", description: book.description || "", total_copies: book.total_copies, author_ids: selectedAuthorIds, cover_image: book.cover_image });
      setModal({ mode: "edit", id: book.id });
    } else {
      setForm(blankForm);
      setModal({ mode: "create" });
    }
  }
  async function openDetail(id) {
    try {
      const { data } = await api.get(`/books/${id}`);
      setDetail(data);
    } catch (error) { notify(errorMessage(error), "error"); }
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "author_ids") payload.append(key, JSON.stringify(value));
        else if (value !== undefined && value !== null) payload.append(key, String(value));
      });
      if (cover) payload.set("cover", cover);
      if (modal.mode === "create") await api.post("/books", payload);
      else await api.put(`/books/${modal.id}`, payload);
      notify(modal.mode === "create" ? "Book added to the collection." : "Book details updated.");
      setModal(null);
      await refresh();
    } catch (error) { notify(errorMessage(error), "error"); } finally { setSaving(false); }
  }
  async function deleteBook() {
    try {
      await api.delete(`/books/${pendingDelete.id}`);
      notify("Book removed from the collection.");
      setPendingDelete(null);
      await refresh();
    } catch (error) { notify(errorMessage(error), "error"); }
  }
  async function reserve(book) {
    try {
      const { data } = await api.post("/reservations", { book_id: book.id });
      notify(data.message);
    } catch (error) { notify(errorMessage(error), "error"); }
  }

  const pages = Math.ceil(total / limit);
  const showingFrom = total ? (page - 1) * limit + 1 : 0;
  const showingTo = Math.min(page * limit, total);
  const availableCount = useMemo(() => books.filter((book) => Number(book.available_copies) > 0).length, [books]);
  function updateSearch(value) {
    setSearch(value);
    setPage(1);
    const params = new URLSearchParams(location.search);
    if (value.trim()) params.set("search", value);
    else params.delete("search");
    const query = params.toString();
    navigate(`/books${query ? `?${query}` : ""}`, { replace: true });
  }

  return <>
    <PageHeader eyebrow="THE COLLECTION" title="Book collection" description="Explore, organize, and keep track of every title in your library." actions={<>
      <button className="button button-secondary" disabled={!books.length || loading || Boolean(loadError)} onClick={() => downloadCsv("library-books.csv", books.map(({ book_code, title, authors: authorList, isbn, category: cat, available_copies, total_copies }) => ({ book_code, title, authors: authorList, isbn, category: cat, available_copies, total_copies })))}><ArrowDownUp size={16} /> Export page</button>
      {staff && <button className="button button-primary" onClick={() => openForm()}><Plus size={17} /> Add a book</button>}
    </>} />

    <section className="panel collection-panel">
      <div className="collection-toolbar">
        <SearchBox value={search} onChange={updateSearch} placeholder="Search title, author or ISBN..." />
        <div className="filter-control"><Filter size={16} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="filter-control"><BookOpen size={16} /><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option value="available">Available now</option><option value="unavailable">Currently checked out</option></select></div>
        {!loadError && <div className="collection-summary"><span className="summary-green-dot" />{total.toLocaleString()} titles <span className="summary-divider">·</span>{availableCount} on this page available</div>}
      </div>
      {loading ? <Spinner label="Loading the collection..." /> : loadError ? <LoadError message={loadError} onRetry={() => loadBooks()} /> : books.length ? <>
        <div className="book-grid">{books.map((book) => <article className="book-card" key={book.id}>
          <div className="book-cover-area">
            {book.cover_image ? <img src={coverUrl(book.cover_image)} alt={`${book.title} cover`} className="book-cover-image" /> : <div className={`book-cover-placeholder cover-tone-${book.id % 5}`}><div className="cover-emblem"><BookOpen size={21} /></div><div className="cover-title">{book.title}</div><div className="cover-author">{book.authors || "Library edition"}</div><i /></div>}
            <span className={`availability-pill ${Number(book.available_copies) > 0 ? "available" : "unavailable"}`}><i />{Number(book.available_copies) > 0 ? `${book.available_copies} available` : "Checked out"}</span>
            <button className="quick-view-button" title="View book details" onClick={() => openDetail(book.id)}><Eye size={16} /></button>
          </div>
          <div className="book-card-body"><div className="book-category">{book.category || "Uncategorized"}</div><h3>{book.title}</h3><div className="book-author-line">{book.authors || "Author not listed"}</div>
            <div className="book-card-bottom"><span>ISBN {book.isbn}</span><div className="book-card-actions">
              <button className="icon-button" title="View details" onClick={() => openDetail(book.id)}><Eye size={16} /></button>
              {staff && <button className="icon-button" title="Edit book" onClick={() => openForm(book)}><Edit3 size={15} /></button>}
              {canDelete && <button className="icon-button danger-hover" title="Delete book" onClick={() => setPendingDelete(book)}><Trash2 size={15} /></button>}
              {!staff && Number(book.available_copies) < 1 && <button className="icon-button" title="Reserve book" onClick={() => reserve(book)}><Plus size={16} /></button>}
            </div></div>
          </div>
        </article>)}</div>
        <div className="pagination-row"><span>Showing <b>{showingFrom}–{showingTo}</b> of <b>{total}</b> titles</span><div><button className="button button-secondary button-sm" disabled={page <= 1} onClick={() => { setPage(page - 1); loadBooks(page - 1); }}><ArrowLeft size={15} /> Previous</button><button className="button button-secondary button-sm" disabled={page >= pages} onClick={() => { setPage(page + 1); loadBooks(page + 1); }}>Next <ArrowRight size={15} /></button></div></div>
      </> : <EmptyState title="No books found" text={search || category || availability ? "Try a different search or clear some filters." : "Add a book to start building your collection."} />}
    </section>

    {modal && <Modal wide title={modal.mode === "create" ? "Add a book" : "Edit book"} subtitle="Book details are saved to your library collection." onClose={() => setModal(null)}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-two">Book title<input className="text-input" required minLength="2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title of the book" /></label>
          <label>ISBN<input className="text-input" required value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} placeholder="978-..." /></label>
          <label>Category<select className="text-input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Uncategorized</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Authors<select className="text-input author-select" multiple value={form.author_ids.map(String)} onChange={(e) => setForm({ ...form, author_ids: Array.from(e.target.selectedOptions, (option) => Number(option.value)) })}>{authors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small className="field-hint">Hold Ctrl (Windows) or ⌘ (Mac) to select several authors.</small></label>
          <label>Publisher<input className="text-input" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></label>
          <label>Publication year<input className="text-input" type="number" min="1000" max="2200" value={form.publication_year} onChange={(e) => setForm({ ...form, publication_year: e.target.value })} /></label>
          <label>Edition<input className="text-input" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} /></label>
          <label>Total copies<input className="text-input" type="number" min="1" required value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} /></label>
          <label className="span-two">Description<textarea className="text-input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A short overview of this title..." /></label>
          <label className="span-two upload-control"><span>Cover image <small>JPG, PNG or WebP, up to 5 MB</small></span><div className="upload-box"><UploadCloud size={19} /><span>{cover?.name || "Choose a cover image"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] || null)} /></div></label>
        </div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving..." : modal.mode === "create" ? "Add to collection" : "Save changes"}</button></div>
      </form>
    </Modal>}
    {detail && <Modal title={detail.title} subtitle={`${detail.book_code} · ISBN ${detail.isbn}`} onClose={() => setDetail(null)}>
      <div className="book-detail"><div className="detail-cover">{detail.cover_image ? <img src={coverUrl(detail.cover_image)} alt="" /> : <div className="book-cover-placeholder cover-tone-2"><BookOpen size={26} /></div>}</div><div className="detail-fields">
        <div><small>AUTHOR{detail.authors?.length === 1 ? "" : "S"}</small><b>{detail.authors?.map((author) => author.name).join(", ") || "Not listed"}</b></div>
        <div><small>CATEGORY</small><b>{detail.category || "Uncategorized"}</b></div>
        <div><small>AVAILABILITY</small><b>{detail.available_copies} of {detail.total_copies} copies available</b></div>
        <div><small>PUBLISHER / YEAR</small><b>{detail.publisher || "—"} {detail.publication_year ? `· ${detail.publication_year}` : ""}</b></div>
        <div><small>EDITION</small><b>{detail.edition || "—"}</b></div>
        <div><small>ADDED</small><b>{formatDate(detail.created_at)}</b></div>
      </div></div>
      {detail.description && <p className="detail-description">{detail.description}</p>}
      <div className="modal-actions"><button className="button button-secondary" onClick={() => setDetail(null)}>Close</button>{!staff && Number(detail.available_copies) < 1 && <button className="button button-primary" onClick={() => { reserve(detail); setDetail(null); }}>Reserve this book <ArrowRight size={15} /></button>}</div>
    </Modal>}
    {pendingDelete && <Modal title="Remove this book?" subtitle="This action cannot be undone." onClose={() => setPendingDelete(null)}>
      <div className="confirm-box"><div className="confirm-icon"><Trash2 size={20} /></div><p><b>{pendingDelete.title}</b> will be removed from the collection.</p></div>
      <div className="modal-actions"><button className="button button-secondary" onClick={() => setPendingDelete(null)}>Cancel</button><button className="button button-danger" onClick={deleteBook}>Delete book</button></div>
    </Modal>}
  </>;
}
