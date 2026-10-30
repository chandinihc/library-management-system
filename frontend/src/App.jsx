import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { LibraryBig } from "lucide-react";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Books from "./pages/Books";
import Students from "./pages/Students";
import Directory from "./pages/Directory";
import Circulation from "./pages/Circulation";
import Reservations from "./pages/Reservations";
import Fines from "./pages/Fines";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import { LoginPage, PasswordPage, RegisterPage } from "./pages/AuthPages";

function LoadingScreen() {
  return <div className="boot-screen"><div className="boot-brand"><span className="brand-mark"><LibraryBig size={21} /></span><b>Library<span>OS</span></b></div><div className="boot-spinner" /></div>;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

function RequireAuth({ children, roles }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children || <Outlet />;
}

function AuthRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const staffRoles = ["admin", "librarian"];
  return <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
    <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
    <Route path="/forgot-password" element={<PasswordPage />} />
    <Route path="/reset-password" element={<PasswordPage reset />} />
    <Route element={<RequireAuth><Layout /></RequireAuth>}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/books" element={<Books />} />
      <Route path="/circulation" element={<Circulation />} />
      <Route path="/reservations" element={<Reservations />} />
      <Route path="/fines" element={<Fines />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/profile" element={<Profile />} />
      <Route element={<RequireAuth roles={staffRoles} />}>
        <Route path="/students" element={<Students />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Route>
    <Route path="*" element={<HomeRedirect />} />
  </Routes>;
}
