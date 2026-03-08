import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Sparkles, LayoutDashboard, Search, Shield, Bell, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'catshy_onboarding_done';

const steps = [
  {
    icon: Sparkles,
    title: 'Welcome to CATSHY',
    description: 'Your Cyber-threat Analysis & Threat Hunting platform. Let\'s take a quick tour of the key features.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Your command center — KPIs, threat pulse, severity distribution, MITRE heatmap, and operational health at a glance.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    icon: Search,
    title: 'Intel Feed & Search',
    description: 'Browse real-time threat intelligence, search IOCs, and explore the full graph of relationships between threats.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: Shield,
    title: 'Vulnerabilities & Leaks',
    description: 'Track CVEs affecting your assets and monitor dark-web leak exposure in one unified view.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Bell,
    title: 'Alerts & Cases',
    description: 'Triage alerts, escalate to investigations, and manage cases through their full lifecycle.',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'Leverage AI to summarize threats, correlate IOCs, and get actionable recommendations. Use ⌘K for quick commands anytime.',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const next = useCallback(() => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
      navigate('/dashboard');
    }
  }, [step, dismiss, navigate]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  const current = steps[step];

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm"
            onClick={dismiss}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed left-1/2 top-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-secondary">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="p-6">
                {/* Close */}
                <button
                  onClick={dismiss}
                  className="absolute top-4 right-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Icon */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${current.bg} mb-4`}>
                      <current.icon className={`h-7 w-7 ${current.color}`} />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">{current.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8">
                  <div className="flex gap-1.5">
                    {steps.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setStep(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {step > 0 && (
                      <button
                        onClick={prev}
                        className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        Back
                      </button>
                    )}
                    <button
                      onClick={next}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      {step === steps.length - 1 ? 'Get Started' : 'Next'}
                      {step < steps.length - 1 && <ArrowRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Skip link */}
                <div className="mt-4 text-center">
                  <button
                    onClick={dismiss}
                    className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    Skip tour
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
