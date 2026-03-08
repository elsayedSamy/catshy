import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Cat, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

function CyberGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="nf-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#nf-grid)" />
      </svg>
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-primary/30"
          style={{ left: `${10 + i * 16}%`, top: `${15 + i * 13}%` }}
          animate={{ y: [0, -25, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <CyberGrid />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-lg px-6"
      >
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-10 shadow-2xl text-center">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"
          >
            <Shield className="h-10 w-10 text-primary" />
          </motion.div>

          {/* 404 number */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-7xl font-black tracking-tighter text-primary/20 mb-2"
          >
            404
          </motion.h1>

          <h2 className="text-xl font-bold text-foreground mb-2">
            Sector Not Found
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            The route <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-primary">{location.pathname}</code> does not exist in this deployment.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-8">
            This could be a misconfigured link or a restricted area.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild>
              <Link to="/dashboard">
                <Cat className="mr-2 h-4 w-4" />
                Return to Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Link>
            </Button>
          </div>

          {/* Branding */}
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/40">
            <Cat className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold tracking-widest uppercase">
              CAT<span className="text-primary/40">SHY</span> TIP
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;