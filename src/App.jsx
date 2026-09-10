import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import NovoDocumento from '@/pages/NovoDocumento';
import AssinarDocumento from '@/pages/AssinarDocumento';
import LogAssinaturas from '@/pages/LogAssinaturas';
import Cadastros from '@/pages/Cadastros';
import AssinarDiretoria from '@/pages/AssinarDiretoria';
import Capa from '@/pages/Capa';
import EnvelopesAssinados from '@/pages/EnvelopesAssinados';

function CapaGate() {
  const ok = typeof window !== "undefined" && window.sessionStorage.getItem("capa_ok") === "1";
  if (!ok) return <Navigate to="/capa" replace />;
  return <Outlet />;
}

function CapaOrLogin() {
  const ok = typeof window !== "undefined" && window.sessionStorage.getItem("capa_ok") === "1";
  return ok ? <Navigate to="/login" replace /> : <Navigate to="/capa" replace />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/capa" element={<Capa />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<CapaGate />}>
        <Route element={<ProtectedRoute unauthenticatedElement={<CapaOrLogin />} />}>
          <Route path="/" element={<Home />} />
          <Route path="/novo" element={<NovoDocumento />} />
          <Route path="/assinar/:id" element={<AssinarDocumento />} />
          <Route path="/assinar-diretoria/:id" element={<AssinarDiretoria />} />
          <Route path="/log" element={<LogAssinaturas />} />
          <Route path="/cadastros" element={<Cadastros />} />
          <Route path="/concluidos/:tipo" element={<EnvelopesAssinados />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App