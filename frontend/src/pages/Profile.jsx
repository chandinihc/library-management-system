import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { LoadError, PageHeader, Spinner } from "../components/Ui";
import { errorMessage } from "../utils";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({ full_name: "", phone: "", department: "", course: "", year_of_study: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  async function loadProfile() {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get("/auth/me");
      setForm({
        full_name: data.full_name || "", phone: data.phone || "", department: data.department || "",
        course: data.course || "", year_of_study: data.year_of_study || "", address: data.address || ""
      });
    } catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  }
  useEffect(() => { loadProfile(); }, []);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch("/auth/profile", form);
      await refreshUser();
      notify(data.message);
    } catch (error) { notify(errorMessage(error), "error"); } finally { setSaving(false); }
  }
  const initials = (user?.full_name || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  if (loading) return <Spinner label="Loading your profile..." />;
  if (loadError) return <><PageHeader eyebrow="ACCOUNT SETTINGS" title="My profile" description="Keep your library account details up to date." /><LoadError message={loadError} onRetry={loadProfile} /></>;
  return <>
    <PageHeader eyebrow="ACCOUNT SETTINGS" title="My profile" description="Keep your library account details up to date." />
    <div className="profile-layout">
      <section className="panel profile-card"><div className="profile-cover"><div className="profile-cover-orbit" /></div><div className="profile-main"><div className="avatar profile-avatar">{initials}</div><h2>{user?.full_name}</h2><span className="profile-role">{user?.role}</span><div className="profile-email"><Mail size={15} />{user?.email}</div>{user?.student_code && <div className="student-code-card"><small>STUDENT ID</small><b>{user.student_code}</b></div>}<div className="profile-security"><ShieldCheck size={16} /><span><b>Protected account</b><small>Your profile is secured with role-based access.</small></span></div></div></section>
      <section className="panel profile-form-panel"><div className="panel-head"><div><h2>Personal information</h2><p>Profile details are used for your library account.</p></div><UserRound size={18} className="muted-icon" /></div><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="span-two">Full name<input className="text-input" required minLength="2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label><label className="span-two">Email address<input className="text-input input-disabled" disabled value={user?.email || ""} /><small className="field-hint">Contact an administrator if you need to change your email.</small></label><label className="span-two">Phone number<input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Add a contact number" /></label>
      {user?.role === "student" && <><label>Department<input className="text-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label><label>Course<input className="text-input" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /></label><label>Year of study<input className="text-input" type="number" min="1" max="10" value={form.year_of_study} onChange={(e) => setForm({ ...form, year_of_study: e.target.value })} /></label><label className="span-two">Address<input className="text-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label></>}
      </div><div className="modal-actions"><Link to="/forgot-password" className="subtle-link password-reset-link"><KeyRound size={15} /> Reset password</Link><button className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Save profile"} <ArrowRight size={15} /></button></div></form></section>
    </div>
  </>;
}
