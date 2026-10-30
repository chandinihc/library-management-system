import { LoaderCircle, Search, X } from "lucide-react";

export function Spinner({ label = "Loading..." }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

export function EmptyState({ title = "Nothing here yet", text = "Try adjusting your search or filters." }) {
  return <div className="empty-state"><div className="empty-icon">✳</div><strong>{title}</strong><span>{text}</span></div>;
}

export function SearchBox({ value, onChange, placeholder = "Search..." }) {
  return <label className="search-box"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>⌘ K</kbd></label>;
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card ${wide ? "modal-wide" : ""}`}>
        <header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
        {children}
      </section>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
