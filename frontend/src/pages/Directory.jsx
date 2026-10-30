import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Edit3, Plus, Search, Tags, Trash2, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EmptyState, Modal, PageHeader, SearchBox, Spinner } from "../components/Ui";
import { errorMessage } from "../utils";

export default function Directory() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState("categories");
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const [categoryResult, authorResult] = await Promise.all([
        api.get("/directory/categories"),
        api.get("/directory/authors", { params: { search: search || undefined } })
      ]);
      setCategories(categoryResult.data);
      setAuthors(authorResult.data);
    } catch (error) { notify(errorMessage(error), "error"); } finally { setLoading(false); }
  }
  useEffect(() => {
    const timer = window.setTimeout(load, search ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [search]);
  function openForm(record) {
    setForm(record ? { name: record.name, description: record.description || "" } : { name: "", description: "" });
    setModal(record ? { mode: "edit", id: record.id } : { mode: "create" });
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const resource = tab;
    try {
      if (modal.mode === "create") await api.post(`/directory/${resource}`, form);
      else await api.put(`/directory/${resource}/${modal.id}`, form);
      notify(`${tab === "categories" ? "Category" : "Author"} ${modal.mode === "create" ? "created" : "updated"}.`);
      setModal(null);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  async function remove(record) {
    try {
      await api.delete(`/directory/${tab}/${record.id}`);
      notify(`${tab === "categories" ? "Category" : "Author"} deleted.`);
      await load();
    } catch (error) { notify(errorMessage(error), "error"); }
  }
  const rows = tab === "categories" ? categories : authors;

  return <>
    <PageHeader eyebrow="LIBRARY TAXONOMY" title="Categories & authors" description="Keep your collection organized and make every book easier to discover." actions={<button className="button button-primary" onClick={() => openForm(null)}><Plus size={17} /> Add {tab === "categories" ? "category" : "author"}</button>} />
    <div className="directory-tabs panel"><div className="tab-buttons"><button className={tab === "categories" ? "tab-button active" : "tab-button"} onClick={() => setTab("categories")}><Tags size={16} /> Categories <span>{categories.length}</span></button><button className={tab === "authors" ? "tab-button active" : "tab-button"} onClick={() => setTab("authors")}><UserRound size={16} /> Authors <span>{authors.length}</span></button></div><SearchBox value={search} onChange={setSearch} placeholder={`Search ${tab}...`} /></div>
    <div className="directory-description"><span className={`mini-stat-icon ${tab === "categories" ? "violet" : "mint"}`}>{tab === "categories" ? <Tags size={17} /> : <UserRound size={17} />}</span><div><b>{tab === "categories" ? "A place for every subject." : "The voices behind your collection."}</b><small>{tab === "categories" ? "Group books into meaningful topics your readers can explore." : "Browse authors and see the titles they've contributed to your library."}</small></div><div className="directory-total"><strong>{rows.length}</strong><small>{tab} in your directory</small></div></div>
    {loading ? <Spinner label={`Loading ${tab}...`} /> : rows.length ? tab === "categories" ? <div className="category-card-grid">{categories.filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase())).map((category, index) => <article className="category-card" key={category.id}>
      <div className={`category-art category-art-${index % 5}`}><span>{category.name.slice(0, 1).toUpperCase()}</span><div className="category-art-orbit" /><BookOpen size={22} /></div>
      <div className="category-card-body"><div className="category-card-title"><div><h3>{category.name}</h3><span>{category.book_count} {Number(category.book_count) === 1 ? "title" : "titles"}</span></div><div className="row-actions"><button className="icon-button" title="Edit category" onClick={() => openForm(category)}><Edit3 size={15} /></button>{isAdmin && <button className="icon-button danger-hover" title="Delete category" onClick={() => remove(category)}><Trash2 size={15} /></button>}</div></div>{category.description && <p>{category.description}</p>}<button className="category-browse" onClick={() => navigate(`/books?category_id=${category.id}`)}>Browse this category <ArrowRight size={14} /></button></div>
    </article>)}</div> : <section className="panel data-panel author-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>AUTHOR</th><th>ABOUT</th><th>BOOKS IN COLLECTION</th><th /></tr></thead><tbody>{authors.map((author, index) => <tr key={author.id}>
      <td><div className="table-person"><span className={`avatar table-avatar avatar-color-${index % 5}`}>{author.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><b>{author.name}</b><small>Author</small></span></div></td><td className="author-bio">{author.bio || "—"}</td><td><span className="author-books-count">{author.book_count} titles</span><small>{author.books || "No titles linked yet"}</small></td><td><div className="row-actions"><button className="icon-button" title="Edit author" onClick={() => openForm(author)}><Edit3 size={15} /></button>{isAdmin && <button className="icon-button danger-hover" title="Delete author" onClick={() => remove(author)}><Trash2 size={15} /></button>}</div></td>
    </tr>)}</tbody></table></div></section> : <EmptyState title={`No ${tab} found`} text={search ? "Try another search." : `Create your first ${tab.slice(0, -1)} to get started.`} />}
    {modal && <Modal title={`${modal.mode === "create" ? "Add" : "Edit"} ${tab === "categories" ? "category" : "author"}`} subtitle={tab === "categories" ? "A clear name helps readers browse your collection." : "Add author details and associate them with books."} onClose={() => setModal(null)}>
      <form className="modal-form" onSubmit={submit}><label>{tab === "categories" ? "Category" : "Author"} name<input className="text-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tab === "categories" ? "e.g. Computer Science" : "Full name"} /></label><label>Description / bio <span className="optional">(optional)</span><textarea className="text-input" rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A short description..." /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving..." : modal.mode === "create" ? "Create" : "Save changes"}</button></div></form>
    </Modal>}
  </>;
}
