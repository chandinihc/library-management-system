import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BookCopy, BookOpen, CalendarClock,
  CircleDollarSign, Clock3, Library, Users, WalletCards
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import api from "../services/api";
import { PageHeader, Spinner } from "../components/Ui";
import { errorMessage, formatDate, money } from "../utils";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

const palette = ["#6e75dc", "#48ad90", "#e7a652", "#dd7892", "#58a4bd", "#a48bdd"];
const monthName = (value) => new Date(`${value}-01T00:00:00`).toLocaleDateString("en", { month: "short" });

function StatCard({ title, value, note, icon: Icon, tone, to }) {
  return <Link to={to} className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={1.9} /></div>
    <div className="stat-copy"><span>{title}</span><strong>{value}</strong><small>{note}</small></div>
    <div className="stat-arrow"><ArrowUpRight size={17} /></div>
  </Link>;
}

function AdminDashboard({ data, user }) {
  const { stats = {}, monthly = [], categories = [], popularBooks = [], studentActivity = [], overdue = [], recentTransactions = [] } = data;
  const months = [];
  const today = new Date();
  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const row = monthly.find((item) => item.month === key);
    months.push({ month: date.toLocaleDateString("en", { month: "short" }), issues: Number(row?.issues || 0), returns: Number(row?.returns_count || 0) });
  }
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <>
    <PageHeader eyebrow={new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase()} title={`${greeting}, ${user?.full_name?.split(" ")[0] || "there"}.`} description="Here's what's happening across your library today." actions={<span className="live-badge"><i /> Live data</span>} />
    <div className="stat-grid">
      <StatCard title="Book titles" value={Number(stats.totalTitles || 0).toLocaleString()} note={`${Number(stats.totalCopies || 0).toLocaleString()} copies in collection`} icon={BookOpen} tone="violet" to="/books" />
      <StatCard title="Available copies" value={Number(stats.availableCopies || 0).toLocaleString()} note={`${Number(stats.totalCopies || 0) - Number(stats.availableCopies || 0)} currently on loan`} icon={BookCopy} tone="mint" to="/books" />
      <StatCard title="Active students" value={Number(stats.totalStudents || 0).toLocaleString()} note="Registered student accounts" icon={Users} tone="amber" to="/students" />
      <StatCard title="Books on loan" value={Number(stats.activeLoans || 0).toLocaleString()} note="Currently checked out" icon={Library} tone="blue" to="/circulation" />
      <StatCard title="Overdue books" value={Number(stats.overdueBooks || 0).toLocaleString()} note="Require follow-up" icon={CalendarClock} tone="rose" to="/circulation" />
      <StatCard title="Reservations" value={Number(stats.pendingReservations || 0).toLocaleString()} note="Waiting or ready to collect" icon={Clock3} tone="lavender" to="/reservations" />
      <StatCard title="Fines collected" value={money(stats.finesCollected)} note="Payments recorded to date" icon={CircleDollarSign} tone="gold" to="/fines" />
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel chart-wide">
        <div className="panel-head"><div><h2>Circulation activity</h2><p>Issues and returns over the last six months</p></div><Link to="/reports" className="subtle-link">View reports <ArrowRight size={14} /></Link></div>
        <div className="chart-legend"><span><i className="legend-issue" /> Issues</span><span><i className="legend-return" /> Returns</span></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={months} margin={{ left: -20, right: 8, top: 12, bottom: 0 }}>
          <defs><linearGradient id="issuesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7776d7" stopOpacity={0.19} /><stop offset="100%" stopColor="#7776d7" stopOpacity={0} /></linearGradient><linearGradient id="returnsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54b99c" stopOpacity={0.15} /><stop offset="100%" stopColor="#54b99c" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }} />
          <Area type="monotone" dataKey="issues" stroke="#7776d7" strokeWidth={2.5} fill="url(#issuesFill)" />
          <Area type="monotone" dataKey="returns" stroke="#54b99c" strokeWidth={2.5} fill="url(#returnsFill)" />
        </AreaChart></ResponsiveContainer></div>
      </section>
      <section className="panel chart-panel category-panel">
        <div className="panel-head"><div><h2>Collection mix</h2><p>Titles by category</p></div><Link to="/directory" className="icon-link"><ArrowUpRight size={17} /></Link></div>
        {categories.length ? <div className="donut-content">
          <div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="count" nameKey="name" innerRadius="66%" outerRadius="92%" paddingAngle={3} stroke="none">{categories.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }} /></PieChart></ResponsiveContainer><div className="donut-total"><b>{categories.reduce((total, item) => total + Number(item.count), 0)}</b><small>titles</small></div></div>
          <div className="category-legend">{categories.slice(0, 5).map((item, index) => <div key={item.name}><i style={{ background: palette[index % palette.length] }} /><span>{item.name}</span><b>{item.count}</b></div>)}</div>
        </div> : <div className="chart-empty">Add categories to see your collection mix.</div>}
      </section>
      <section className="panel chart-panel popular-panel">
        <div className="panel-head"><div><h2>Most borrowed</h2><p>Popular titles across your library</p></div><Link to="/books" className="subtle-link">All books <ArrowRight size={14} /></Link></div>
        <div className="popular-list">{popularBooks.map((book, index) => <div className="popular-item" key={book.id}><span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><div className="popular-title"><b>{book.title}</b><small>{book.borrow_count} total checkouts</small></div><div className="mini-bar"><i style={{ width: `${Math.max(8, Number(book.borrow_count) / Math.max(1, Number(popularBooks[0]?.borrow_count)) * 100)}%` }} /></div></div>)}{!popularBooks.length && <div className="chart-empty">Borrowing activity will show here.</div>}</div>
      </section>
      <section className="panel chart-panel activity-panel">
        <div className="panel-head"><div><h2>Most active readers</h2><p>Student borrowing activity</p></div><Link to="/students" className="icon-link"><ArrowUpRight size={17} /></Link></div>
        <div className="activity-list">{studentActivity.map((student, index) => <div className="activity-item" key={student.name}><span className={`avatar activity-avatar activity-${index}`}>{student.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span><span className="activity-name"><b>{student.name}</b><small>Student member</small></span><b className="activity-count">{student.borrow_count}<small> loans</small></b></div>)}{!studentActivity.length && <div className="chart-empty">Student activity will show here.</div>}</div>
      </section>
      <section className="panel table-panel overdue-panel">
        <div className="panel-head"><div><h2>Needs attention</h2><p>Overdue books that need follow-up</p></div><Link to="/circulation" className="subtle-link">View all <ArrowRight size={14} /></Link></div>
        {overdue.length ? <div className="table-scroll"><table><thead><tr><th>BOOK / STUDENT</th><th>DUE DATE</th><th>FINE ACCRUED</th><th /></tr></thead><tbody>{overdue.map((item) => <tr key={item.id}><td><b>{item.book_title}</b><small>{item.student_name}</small></td><td className="text-danger">{formatDate(item.due_at)}</td><td>{money(item.fine_amount)}</td><td><Link to="/circulation" className="row-arrow"><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <div className="all-clear"><span>✓</span><div><b>All caught up</b><small>No overdue books need attention.</small></div></div>}
      </section>
      <section className="panel table-panel transactions-panel">
        <div className="panel-head"><div><h2>Recent activity</h2><p>The latest changes in your library</p></div><Link to="/reports" className="subtle-link">Full history <ArrowRight size={14} /></Link></div>
        {recentTransactions.length ? <div className="transaction-list">{recentTransactions.slice(0, 5).map((item, index) => <div className="transaction-item" key={`${item.reference}-${item.type}-${index}`}><span className={`transaction-icon ${item.type}`}>{item.type === "return" ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}</span><div><b>{item.student_name} <span>{item.type === "return" ? "returned" : "borrowed"}</span></b><small>{item.book_title}</small></div><time>{formatDate(item.occurred_at, { month: "short", day: "numeric" })}</time></div>)}</div> : <div className="chart-empty">Transactions will appear here.</div>}
      </section>
    </div>
  </>;
}

function StudentDashboard({ data }) {
  const { stats = {}, recentIssues = [], dueSoon = [] } = data;
  return <>
    <PageHeader eyebrow="YOUR LIBRARY" title={`Hello, ${data.name || "reader"}.`} description="A little space for your next great read." actions={<Link className="button button-primary" to="/books"><BookOpen size={16} /> Explore books</Link>} />
    <div className="student-welcome panel">
      <div><div className="eyebrow">YOUR READING JOURNEY</div><h2>Every great idea starts with a page.</h2><p>Keep track of your books, due dates, and reservations — all in one place.</p><Link to="/books" className="subtle-link">Browse the collection <ArrowRight size={14} /></Link></div>
      <div className="welcome-illustration"><div className="welcome-book"><span /><span /><span /><i>✦</i></div><div className="welcome-orbit" /></div>
    </div>
    <div className="stat-grid student-stat-grid">
      <StatCard title="Books checked out" value={stats.activeLoans || 0} note="Currently in your reading list" icon={BookOpen} tone="violet" to="/circulation" />
      <StatCard title="Overdue books" value={stats.overdueLoans || 0} note="Return or renew at the library" icon={CalendarClock} tone="rose" to="/circulation" />
      <StatCard title="Reservations" value={stats.reservations || 0} note="Books in your queue" icon={Library} tone="mint" to="/reservations" />
      <StatCard title="Outstanding fines" value={money(stats.outstandingFines)} note="Current balance" icon={WalletCards} tone="gold" to="/fines" />
    </div>
    <div className="student-lower-grid">
      <section className="panel table-panel">
        <div className="panel-head"><div><h2>Your reading list</h2><p>Books you've recently borrowed</p></div><Link to="/circulation" className="subtle-link">View history <ArrowRight size={14} /></Link></div>
        {recentIssues.length ? <div className="table-scroll"><table><thead><tr><th>BOOK</th><th>DUE DATE</th><th>STATUS</th></tr></thead><tbody>{recentIssues.map((issue) => <tr key={issue.id}><td><b>{issue.book_title}</b><small>{issue.issue_code}</small></td><td>{formatDate(issue.due_at)}</td><td><span className={`status-pill status-${issue.display_status}`}>{issue.display_status}</span></td></tr>)}</tbody></table></div> : <div className="all-clear"><BookOpen size={20} /><div><b>Your list is waiting</b><small>Explore the catalog to find your next read.</small></div></div>}
      </section>
      <section className="panel due-panel">
        <div className="panel-head"><div><h2>Coming up</h2><p>Due dates in the next 7 days</p></div><CalendarClock size={18} className="muted-icon" /></div>
        {dueSoon.length ? dueSoon.map((item) => <div className="due-item" key={`${item.book_title}-${item.due_at}`}><span className="due-icon"><BookOpen size={17} /></span><span><b>{item.book_title}</b><small>Due {formatDate(item.due_at)}</small></span><strong>{Number(item.days_remaining) === 0 ? "Today" : `${item.days_remaining}d`}</strong></div>) : <div className="all-clear due-clear"><span>✓</span><div><b>Nothing due soon</b><small>You're all caught up on due dates.</small></div></div>}
        <Link to="/reservations" className="due-footer">Manage reservations <ArrowRight size={14} /></Link>
      </section>
    </div>
  </>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();
  useEffect(() => {
    api.get("/dashboard").then(({ data: result }) => setData(result))
      .catch((error) => notify(errorMessage(error), "error"))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <Spinner label="Loading your dashboard..." />;
  if (!data) return <div className="error-panel">Your dashboard could not be loaded. Refresh to try again.</div>;
  if (data.role === "student") return <StudentDashboard data={{ ...data, name: user?.full_name?.split(" ")[0] }} />;
  return <AdminDashboard data={data} user={user} />;
}
