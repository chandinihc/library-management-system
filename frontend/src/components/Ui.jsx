import { useEffect, useId, useRef } from "react";
import { AlertCircle, LoaderCircle, RefreshCw, Search, X } from "lucide-react";

export function Spinner({ label = "Loading..." }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

export function EmptyState({ title = "Nothing here yet", text = "Try adjusting your search or filters." }) {
  return <div className="empty-state"><div className="empty-icon">✳</div><strong>{title}</strong><span>{text}</span></div>;
}

export function LoadError({ message = "We couldn't load this information.", onRetry }) {
  return <div className="load-error-state" role="alert">
    <span className="load-error-icon"><AlertCircle size={19} /></span>
    <div><strong>Unable to load data</strong><span>{message}</span></div>
    {onRetry && <button className="button button-secondary button-sm" onClick={onRetry}><RefreshCw size={14} /> Try again</button>}
  </div>;
}

export function SearchBox({ value, onChange, placeholder = "Search..." }) {
  return <label className="search-box"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>Ctrl/⌘ K</kbd></label>;
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )];
    const first = focusable()[0];
    (first || dialog).focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className={`modal-card ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="modal-header"><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
        {children}
      </section>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
