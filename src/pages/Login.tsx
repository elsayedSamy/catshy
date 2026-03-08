import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Cat, Eye, EyeOff, Loader2, ShieldCheck, Fingerprint, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

function CyberGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orbs */}
      <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/8 blur-[100px] animate-pulse" />
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-accent/6 blur-[100px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/3 blur-[120px]" />
      
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Floating particles */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-primary/30"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      <CyberGrid />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px] px-6"
      >
        {/* Glass card */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-2xl shadow-primary/5">
          {/* Logo section */}
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
              {/* Glow ring */}
              <div className="absolute -inset-1 rounded-2xl bg-primary/10 blur-md -z-10" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight">
              CAT<span className="text-primary">SHY</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Threat Intelligence Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email
              </label>
              <div className={`relative rounded-lg transition-all duration-200 ${focused === 'email' ? 'ring-2 ring-primary/30' : ''}`}>
                <Input
                  id="email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="analyst@company.com"
                  required autoFocus
                  className="bg-secondary/30 border-border/50 h-11"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Password
                </label>
                <Link to="/auth/forgot-password" className="text-xs text-primary/70 hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className={`relative rounded-lg transition-all duration-200 ${focused === 'password' ? 'ring-2 ring-primary/30' : ''}`}>
                <Input
                  id="password" type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  required
                  className="bg-secondary/30 border-border/50 pr-10 h-11"
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive flex items-start gap-2"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full h-11 text-sm font-semibold glow-cyan" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint className="mr-2 h-4 w-4" />
              )}
              Authenticate
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card/80 px-3 text-muted-foreground/60">New to CATSHY?</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-10 border-border/50 bg-secondary/20 hover:bg-secondary/40"
            onClick={() => navigate('/auth/signup')}
          >
            Create Account
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
          Protected by enterprise-grade encryption
        </p>
      </motion.div>
    </div>
  );
}
