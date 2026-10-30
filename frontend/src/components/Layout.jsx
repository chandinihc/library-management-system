import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight, Bell, BookOpen, ChartNoAxesCombined, ChevronDown, ChevronLeft, ChevronRight,
  CircleDollarSign, LayoutDashboard, LibraryBig, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen,
  Search, Settings2, Sun, Tags, Users, X
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { errorMessage, formatDate } from "../utils";
import { useToast } from "../context/ToastContext";

const links = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/books", label: "Book collection", icon: BookOpen },
  { to: "/circulation", label: "Circulation", studentLabel: "My loans", icon: ArrowUpRight },
  { to: "/reservations", label: "Reservations", icon: LibraryBig },
  { to: "/students", label: "Students", icon: Users, staff: true },
  { to: "/directory", label: "Categories & authors", icon: Tags, staff: true },
  { to: "/fines", label: "Fines & payments", icon: CircleDollarSign },
  { to: "/reports", label: "Reports & analytics", icon: ChartNoAxesCombined, staff: true },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "My profile", icon: Settings2 }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(localStorage.getItem("library_sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem("library_theme") === "dark");
  const [notifications, setNotifications] = useState([]);
  const notificationError = useRef(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("library_theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setNotificationOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    let active = true;
    const load = () => api.get("/notifications").then(({ data }) => {
      if (active) {
        notificationError.current = false;
        setNotifications(data);
      }
    }).catch((error) => {
      if (active && !notificationError.current) {
        notify(errorMessage(error), "error");
        notificationError.current = true;
      }
    });
    load();
    const interval = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, [notify]);
  useEffect(() => {
    let active = true;
    const check = () => api.get("/health/database").then(() => { if (active) setApiOnline(true); }).catch(() => { if (active) setApiOnline(false); });
    check();
    const interval = window.setInterval(check, 30000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const isStaff = user?.role === "admin" || user?.role === "librarian";
  const unread = notifications.filter((item) => !item.read_at).length;
  const pageTitle = links.find((item) => item.to === location.pathname)?.label || "Library";
  const filteredLinks = links.filter((item) => !item.staff || isStaff);
  const initials = (user?.full_name || "Library User").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const navClass = collapsed ? "sidebar sidebar-collapsed" : "sidebar";

  function toggleSidebar() {
    setCollapsed((value) => {
      localStorage.setItem("library_sidebar", value ? "expanded" : "collapsed");
      return !value;
    });
  }
  function goSearch(event) {
    event.preventDefault();
    navigate(`/books${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`);
    setSearch("");
  }
  async function markNotification(notification) {
    if (!notification.read_at) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      } catch {
        notify("That notification could not be marked as read.", "error");
      }
    }
    navigate("/notifications");
    setNotificationOpen(false);
  }

  return (
    <div className={`app-shell ${mobileOpen ? "mobile-nav-open" : ""}`}>
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={navClass}>
        <div className="brand-row">
          <div className="brand-mark"><LibraryBig size={21} strokeWidth={2.2} /></div>
          {!collapsed && <div className="brand-copy"><b>Library<span>OS</span></b><small>MANAGEMENT SUITE</small></div>}
          <button className="icon-button sidebar-mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-switch"><span className="workspace-avatar">N</span>{!collapsed && <><span><b>Northstar Library</b><small>Campus collection</small></span><ChevronDown size={15} /></>}</div>
        <div className="nav-caption">{!collapsed && "WORKSPACE"}</div>
        <nav className="side-nav">
          {filteredLinks.map(({ to, label, studentLabel, icon: Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{!isStaff && studentLabel ? studentLabel : label}</span>
              {label === "Notifications" && unread > 0 && <span className="nav-count">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        {!collapsed && (
          <div className="sidebar-bottom">
            <div className="sidebar-tip"><div className="tip-glow">✦</div><b>Library, in sync.</b><p>Your collection and lending activity are up to date.</p><span className="sync-status"><i style={{ background: apiOnline ? undefined : "#d76775" }} /> {apiOnline ? "Database connected" : "Database unavailable"}</span></div>
            <div className="sidebar-user">
              <div className="avatar">{initials}</div>
              <div className="user-copy"><b>{user?.full_name}</b><small>{user?.role}</small></div>
              <button className="icon-button" title="Sign out" onClick={() => { logout(); navigate("/login"); }}><LogOut size={17} /></button>
            </div>
          </div>
        )}
        <button className="sidebar-collapse icon-button" onClick={toggleSidebar} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{pageTitle}</b></div>
          <div className="topbar-actions">
            <form className="global-search" onSubmit={goSearch}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search books, ISBN..." /><kbd>↵</kbd></form>
            <button className="icon-button theme-toggle" title="Toggle color theme" onClick={() => setDark((value) => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="dropdown-anchor">
              <button className={`icon-button notification-trigger ${notificationOpen ? "selected" : ""}`} onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false); }} aria-label="Notifications">
                <Bell size={18} />{unread > 0 && <i className="notification-dot" />}
              </button>
              {notificationOpen && <div className="popover notification-popover">
                <div className="popover-head"><div><b>Notifications</b><small>{unread ? `${unread} unread` : "You're all caught up"}</small></div><button className="text-button" onClick={() => navigate("/notifications")}>View all</button></div>
                {notifications.slice(0, 4).map((item) => <button className={`mini-notification ${item.read_at ? "" : "unread"}`} key={item.id} onClick={() => markNotification(item)}>
                  <i className={`notice-dot notice-${item.type}`} /><span><b>{item.title}</b><small>{item.message}</small><time>{formatDate(item.created_at, { month: "short", day: "numeric" })}</time></span>
                </button>)}
                {!notifications.length && <div className="popover-empty">New updates will appear here.</div>}
              </div>}
            </div>
            <div className="dropdown-anchor">
              <button className="profile-trigger" onClick={() => { setProfileOpen((value) => !value); setNotificationOpen(false); }}><span className="avatar avatar-small">{initials}</span><ChevronDown size={14} /></button>
              {profileOpen && <div className="popover profile-popover">
                <div className="profile-popover-title"><div className="avatar avatar-small">{initials}</div><span><b>{user?.full_name}</b><small>{user?.email}</small></span></div>
                <button onClick={() => navigate("/profile")}><Settings2 size={16} /> Account settings</button>
                <button className="danger-action" onClick={() => { logout(); navigate("/login"); }}><LogOut size={16} /> Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
        <footer className="app-footer"><span>LibraryOS <span className="footer-dot">·</span> Campus library operations</span><span>Secure, role-based access <span className="footer-dot">·</span> {user?.role}</span></footer>
      </main>
    </div>
  );
}
