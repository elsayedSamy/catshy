import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Cat, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!token) { setError('Invalid or missing invite token.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to accept invite');
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Invalid Invite Link</h2>
          <p className="mt-2 text-muted-foreground">This invite link is invalid or missing a token.</p>
          <Button className="mt-4" onClick={() => navigate('/login')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md px-6">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Cat className="h-9 w-9 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Accept Invite</h1>
            <p className="mt-1 text-sm text-muted-foreground">Set your password to join CATSHY</p>
          </div>

          {success ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center font-medium text-foreground">Account created!</p>
              <p className="text-sm text-muted-foreground">Redirecting to login…</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Name (optional)</label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="bg-secondary/50" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8}
                    className="bg-secondary/50 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-foreground">Confirm Password</label>
                <Input id="confirmPassword" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required className="bg-secondary/50" />
              </div>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</motion.p>
              )}
              <Button type="submit" className="w-full glow-cyan" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Account
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
