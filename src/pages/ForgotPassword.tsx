import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cat, Loader2, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_BASE}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/8 blur-[100px]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="fp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#fp-grid)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px] px-6"
      >
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-2xl shadow-primary/5">
          <div className="mb-8 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="relative mb-5"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-lg shadow-primary/10">
                <Cat className="h-8 w-8 text-primary" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-primary/10 blur-md -z-10" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Enter your email to receive a reset link</p>
          </div>

          {sent ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-6">
              <div className="relative">
                <CheckCircle2 className="h-14 w-14 text-accent" />
                <div className="absolute -inset-2 rounded-full bg-accent/10 blur-lg -z-10" />
              </div>
              <p className="text-center font-semibold text-foreground text-lg">Check your inbox</p>
              <p className="text-center text-sm text-muted-foreground max-w-[280px]">
                If that email is registered, we've sent a password reset link.
              </p>
              <Link to="/login" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
                </label>
                <div className={`rounded-lg transition-all duration-200 ${focused ? 'ring-2 ring-primary/30' : ''}`}>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    placeholder="you@company.com" required autoFocus className="bg-secondary/30 border-border/50 h-11" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 text-sm font-semibold glow-cyan" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send Reset Link
              </Button>
              <div className="text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
          Protected by enterprise-grade encryption
        </p>
      </motion.div>
    </div>
  );
}
