import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LogIn } from 'lucide-react';

export default function AuthPage() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) navigate('/', { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (isSignUp) {
      setError('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
    }
    setLoading(false);
  };

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <LogIn className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Entrar'}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
      </Card>
    </div>
  );
}
