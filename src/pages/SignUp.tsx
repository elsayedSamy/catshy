import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Cat, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, UserPlus, Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;

    if (s <= 1) return { score: s, label: 'Weak', color: 'bg-destructive' };
    if (s <= 2) return { score: s, label: 'Fair', color: 'bg-warning' };
    if (s <= 3) return { score: s, label: 'Good', color: 'bg-info' };
    return { score: s, label: 'Strong', color: 'bg-accent' };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < score ? color : 'bg-secondary'}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05 }}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${
        score <= 1 ? 'text-destructive' : score <= 2 ? 'text-warning' : score <= 3 ? 'text-info' : 'text-accent'
      }`}>
        {label}
      </p>
    </div>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Registration failed');
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-accent/6 blur-[100px]" />
        <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-primary/8 blur-[100px]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="signup-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#signup-grid)" />
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
            <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Join CAT<span className="text-primary">SHY</span> Threat Intelligence
            </p>
          </div>

          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-6">
              <div className="relative">
                <CheckCircle2 className="h-14 w-14 text-accent" />
                <div className="absolute -inset-2 rounded-full bg-accent/10 blur-lg -z-10" />
              </div>
              <p className="text-center font-semibold text-foreground text-lg">Check your email!</p>
              <p className="text-center text-sm text-muted-foreground max-w-[280px]">
                We've sent a verification link to <strong className="text-foreground">{email}</strong>
              </p>
              <p className="text-center text-xs text-muted-foreground/60">
                Didn't receive it? Check your spam folder.
              </p>
              <Link to="/login" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="name" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name
                </label>
                <div className={`rounded-lg transition-all duration-200 ${focused === 'name' ? 'ring-2 ring-primary/30' : ''}`}>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)}
                    onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                    placeholder="Your name" required autoFocus className="bg-secondary/30 border-border/50 h-11" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
                </label>
                <div className={`rounded-lg transition-all duration-200 ${focused === 'email' ? 'ring-2 ring-primary/30' : ''}`}>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                    placeholder="you@company.com" required className="bg-secondary/30 border-border/50 h-11" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
                </label>
                <div className={`relative rounded-lg transition-all duration-200 ${focused === 'password' ? 'ring-2 ring-primary/30' : ''}`}>
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                    placeholder="Min 8 characters" required minLength={8}
                    className="bg-secondary/30 border-border/50 pr-10 h-11" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Confirm Password
                </label>
                <div className={`rounded-lg transition-all duration-200 ${focused === 'confirm' ? 'ring-2 ring-primary/30' : ''}`}>
                  <Input id="confirmPassword" type="password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
                    placeholder="••••••••" required className="bg-secondary/30 border-border/50 h-11" />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[10px] text-destructive mt-1">Passwords don't match</p>
                )}
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </motion.div>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold glow-cyan" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Create Account
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
              </p>
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
