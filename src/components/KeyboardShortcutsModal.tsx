import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

const shortcutGroups = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open Command Palette' },
      { keys: ['?'], description: 'Show Keyboard Shortcuts' },
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'F'], description: 'Go to Intel Feed' },
      { keys: ['G', 'S'], description: 'Go to Search' },
      { keys: ['G', 'A'], description: 'Go to Assets' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['N'], description: 'New Investigation' },
      { keys: ['R'], description: 'Refresh Data' },
      { keys: ['Esc'], description: 'Close Modal / Panel' },
    ],
  },
  {
    title: 'Views',
    shortcuts: [
      { keys: ['['], description: 'Collapse Sidebar' },
      { keys: [']'], description: 'Expand Sidebar' },
      { keys: ['T'], description: 'Toggle Theme' },
    ],
  },
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if inside an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setOpen(prev => !prev);
    }
    if (e.key === 'Escape' && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                    <Keyboard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Keyboard Shortcuts</h2>
                    <p className="text-xs text-muted-foreground">Navigate faster with keyboard</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Shortcut groups */}
              <div className="space-y-5">
                {shortcutGroups.map(group => (
                  <div key={group.title}>
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2">
                      {group.title}
                    </h3>
                    <div className="space-y-1">
                      {group.shortcuts.map(shortcut => (
                        <div
                          key={shortcut.description}
                          className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary/30 transition-colors"
                        >
                          <span className="text-sm text-foreground">{shortcut.description}</span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, i) => (
                              <span key={i} className="flex items-center">
                                {i > 0 && <span className="mx-0.5 text-[10px] text-muted-foreground/40">+</span>}
                                <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-secondary/50 px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
                                  {key}
                                </kbd>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-center gap-2 pt-4 border-t border-border">
                <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px]">?</kbd>
                <span className="text-[11px] text-muted-foreground">to toggle this dialog</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}