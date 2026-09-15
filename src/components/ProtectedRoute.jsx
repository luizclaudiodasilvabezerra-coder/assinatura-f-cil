import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { podeAcessarApp } from '@/lib/allowlist';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AccessDenied = () => {
  const { logout } = useAuth();
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-heading mb-2">Acesso não autorizado</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Seu e-mail não está autorizado a acessar este aplicativo. Contate o administrador.
        </p>
        <Button onClick={() => logout(true)} className="w-full">Sair</Button>
      </div>
    </div>
  );
};

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, user, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (!podeAcessarApp(user)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}