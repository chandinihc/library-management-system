import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, CircleAlert, Clock3, LibraryBig } from "lucide-react";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { EmptyState, LoadError, PageHeader, Spinner } from "../components/Ui";
import { errorMessage, formatDate } from "../utils";

const icons = { overdue: CircleAlert, reservation: BellRing, issue: LibraryBig, return: CheckCheck, reminder: Clock3 };

export default function Notifications() {
  const { notify } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  async function load() {
    setLoading(true);
    setLoadError("");
    try { const { data } = await api.get("/notifications"); setItems(data); }
    catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function markAll() {
    try {
      await api.patch("/notifications/read-all");
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      notify("All notifications marked as read.");
    } catch (error) { notify(errorMessage(error), "error"); }
  }
  const unread = items.filter((item) => !item.read_at).length;
  return <>
    <PageHeader eyebrow="UPDATES & REMINDERS" title="Notifications" description="Stay on top of due dates, reservations, and changes to your library account." actions={!loadError && unread > 0 && <button className="button button-secondary" onClick={markAll}><CheckCheck size={16} /> Mark all as read</button>} />
    <section className="panel notification-page-panel"><div className="notification-page-head"><div><b>All updates</b><small>{loadError ? "Unable to retrieve notifications" : `${unread ? `${unread} unread · ` : ""}${items.length} total`}</small></div><span className="notification-head-icon"><Bell size={17} /></span></div>
      {loading ? <Spinner label="Loading notifications..." /> : loadError ? <LoadError message={loadError} onRetry={() => load()} /> : items.length ? <div className="notification-list">{items.map((item) => {
        const Icon = icons[item.type] || Bell;
        return <article className={`notification-row ${item.read_at ? "" : "notification-unread"}`} key={item.id}><span className={`notification-type-icon notice-${item.type}`}><Icon size={18} /></span><div className="notification-row-copy"><div><b>{item.title}</b>{!item.read_at && <i className="unread-indicator" />}</div><p>{item.message}</p><time>{formatDate(item.created_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></div><span className={`notification-type-label type-label-${item.type}`}>{item.type}</span></article>;
      })}</div> : <EmptyState title="You're all caught up" text="Book and account updates will appear here." />}
    </section>
  </>;
}
