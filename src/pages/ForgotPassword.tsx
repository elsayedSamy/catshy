import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cat, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_BASE}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Always show success to not reveal if email exists
    }
    setSent(true);
    setLoading(false);
  };

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
            <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email to receive a reset link</p>
          </div>

          {sent ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center font-medium text-foreground">Check your inbox</p>
              <p className="text-center text-sm text-muted-foreground">
                If that email is registered, we've sent a password reset link.
              </p>
              <Link to="/login" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required autoFocus className="bg-secondary/50" />
              </div>
              <Button type="submit" className="w-full glow-cyan" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Reset Link
              </Button>
              <div className="text-center">
                <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
