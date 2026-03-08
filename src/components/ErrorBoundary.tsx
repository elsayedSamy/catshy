import React from 'react';
import { Cat, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-destructive/5 blur-3xl" />
          </div>

          <div className="relative z-10 w-full max-w-lg px-6">
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-10 shadow-2xl text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
                <Cat className="h-10 w-10 text-destructive" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">Something Went Wrong</h1>
              <p className="text-sm text-muted-foreground mb-4">
                An unexpected error occurred in the application.
              </p>

              {this.state.error && (
                <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-3 text-left">
                  <p className="text-xs font-mono text-destructive break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Application
              </Button>

              <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/40">
                <Cat className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold tracking-widest uppercase">
                  CAT<span className="text-primary/40">SHY</span> TIP
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}