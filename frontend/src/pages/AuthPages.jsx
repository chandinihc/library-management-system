import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, LibraryBig, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../utils";

function AuthFrame({ children, tag = "NORTHSTAR CAMPUS LIBRARY" }) {
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <div className="auth-brand"><span className="brand-mark"><LibraryBig size={21} /></span><b>Library<span>OS</span></b></div>
        <div className="auth-art">
          <div className="art-glow" />
          <div className="book-stack stack-one"><span /><span /><span /></div>
          <div className="book-stack stack-two"><span /><span /><span /></div>
          <div className="floating-card"><div className="floating-icon"><BookOpen size={17} /></div><div><b>Knowledge, organized.</b><small>Your campus library in one place.</small></div><i /></div>
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        </div>
        <div className="auth-aside-footer"><span>{tag}</span><span>Read. Discover. Grow.</span></div>
      </div>
      <main className="auth-main"><div className="auth-main-inner">{children}<div className="auth-footnote"><ShieldCheck size={15} /> Secure access to your campus library</div></div></main>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await login(form);
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally { setBusy(false); }
  }
  return <AuthFrame>
    <div className="auth-heading"><div className="auth-kicker"><span className="kicker-line" /> YOUR CAMPUS, CONNECTED</div><h1>Welcome back<span>.</span></h1><p>Sign in to pick up right where you left off.</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label>Email address<div className="input-icon"><Mail size={17} /><input autoComplete="email" type="email" required placeholder="you@university.edu" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div></label>
      <label>Password<div className="input-icon"><LockKeyhole size={17} /><input autoComplete="current-password" type="password" required placeholder="Enter your password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div></label>
      <div className="auth-subrow"><span>Secure library access</span><Link to="/forgot-password">Forgot password?</Link></div>
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"} <ArrowRight size={17} /></button>
    </form>
    <div className="auth-divider"><span>NEW TO THE LIBRARY?</span></div>
    <Link className="button button-secondary auth-register" to="/register">Create a student account <ArrowRight size={16} /></Link>
    <div className="auth-demo-note"><b>Staff access</b><span>Administrator and librarian accounts are provisioned by your library team.</span></div>
  </AuthFrame>;
}

export function RegisterPage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "", department: "", course: "" });
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/register", form);
      notify("Account created. You can now sign in.");
      navigate("/login");
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  return <AuthFrame tag="STUDENT MEMBERSHIP">
    <Link to="/login" className="back-link"><ArrowLeft size={15} /> Back to sign in</Link>
    <div className="auth-heading"><div className="auth-kicker"><span className="kicker-line" /> YOUR NEXT CHAPTER</div><h1>Join the library<span>.</span></h1><p>Create your student account to discover and reserve books.</p></div>
    <form className="auth-form auth-form-grid" onSubmit={submit}>
      <label className="span-two">Full name<input className="text-input" required minLength="2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Your name" /></label>
      <label className="span-two">University email<input className="text-input" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@university.edu" /></label>
      <label className="span-two">Password<input className="text-input" required type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></label>
      <label>Department<input className="text-input" required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Computer Science" /></label>
      <label>Course<input className="text-input" required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="e.g. B.Sc." /></label>
      <label className="span-two">Phone number <span className="optional">(optional)</span><input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></label>
      <button className="button button-primary auth-submit span-two" disabled={busy}>{busy ? "Creating account..." : "Create account"} <ArrowRight size={17} /></button>
    </form>
  </AuthFrame>;
}

export function PasswordPage({ reset = false }) {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(params.get("token") || "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (reset) {
        const { data } = await api.post("/auth/reset-password", { token, password });
        notify(data.message);
        navigate("/login");
      } else {
        const { data } = await api.post("/auth/forgot-password", { email });
        if (data.developmentResetToken) setToken(data.developmentResetToken);
        setSent(true);
        notify(data.message);
      }
    } catch (error) { notify(errorMessage(error), "error"); } finally { setBusy(false); }
  }
  return <AuthFrame tag="ACCOUNT RECOVERY">
    <Link to="/login" className="back-link"><ArrowLeft size={15} /> Back to sign in</Link>
    <div className="auth-heading"><div className="auth-kicker"><span className="kicker-line" /> ACCOUNT SECURITY</div><h1>{reset ? "Set a new password" : "Reset your password"}<span>.</span></h1><p>{reset ? "Choose a new password for your library account." : "We'll send you a secure link to get back into your account."}</p></div>
    <form className="auth-form" onSubmit={submit}>
      {reset ? <>
        <label>Reset token<input className="text-input" required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your reset token" /></label>
        <label>New password<input className="text-input" type="password" required minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
      </> : <>
        <label>Email address<div className="input-icon"><Mail size={17} /><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" /></div></label>
        {sent && <div className="inline-success">If the account exists, check the configured email inbox. In local development, the reset token is filled in below.</div>}
        {sent && token && <><label>Development reset token<input className="text-input" value={token} onChange={(e) => setToken(e.target.value)} /></label><Link className="subtle-link" to={`/reset-password?token=${encodeURIComponent(token)}`}>Continue to choose a new password <ArrowRight size={14} /></Link></>}
      </>}
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Please wait..." : reset ? "Update password" : "Send reset link"} <ArrowRight size={17} /></button>
    </form>
  </AuthFrame>;
}
