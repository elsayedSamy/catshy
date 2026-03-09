import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";

// Auth pages (small, load immediately)
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AcceptInvite from "./pages/AcceptInvite";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import NotFound from "./pages/NotFound";

// Lazy load all main app pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Assets = lazy(() => import("./pages/Assets"));
const Sources = lazy(() => import("./pages/Sources"));
const Feed = lazy(() => import("./pages/Feed"));
const History = lazy(() => import("./pages/History"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const Graph = lazy(() => import("./pages/Graph"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Investigations = lazy(() => import("./pages/Investigations"));
const Reports = lazy(() => import("./pages/Reports"));
const Leaks = lazy(() => import("./pages/Leaks"));
const Playbooks = lazy(() => import("./pages/Playbooks"));
const Admin = lazy(() => import("./pages/Admin"));
const Settings = lazy(() => import("./pages/Settings"));
const AICenter = lazy(() => import("./pages/AICenter"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Vulnerabilities = lazy(() => import("./pages/Vulnerabilities"));
const GlobalThreats = lazy(() => import("./pages/GlobalThreats"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30000 } },
});

function LazyFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <KeyboardShortcutsModal />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/signup" element={<SignUp />} />
              <Route path="/auth/accept-invite" element={<AcceptInvite />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/auth/verify-email" element={<VerifyEmail />} />
              <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Suspense fallback={<LazyFallback />}><Dashboard /></Suspense>} />
                <Route path="assets" element={<Suspense fallback={<LazyFallback />}><Assets /></Suspense>} />
                <Route path="sources" element={<Suspense fallback={<LazyFallback />}><Sources /></Suspense>} />
                <Route path="feed" element={<Suspense fallback={<LazyFallback />}><Feed /></Suspense>} />
                <Route path="history" element={<Suspense fallback={<LazyFallback />}><History /></Suspense>} />
                <Route path="search" element={<Suspense fallback={<LazyFallback />}><SearchPage /></Suspense>} />
                <Route path="graph" element={<Suspense fallback={<LazyFallback />}><Graph /></Suspense>} />
                <Route path="alerts" element={<Suspense fallback={<LazyFallback />}><Alerts /></Suspense>} />
                <Route path="investigations" element={<Suspense fallback={<LazyFallback />}><Investigations /></Suspense>} />
                <Route path="cases" element={<Navigate to="/investigations" replace />} />
                <Route path="reports" element={<Suspense fallback={<LazyFallback />}><Reports /></Suspense>} />
                <Route path="leaks" element={<Suspense fallback={<LazyFallback />}><Leaks /></Suspense>} />
                <Route path="vulnerabilities" element={<Suspense fallback={<LazyFallback />}><Vulnerabilities /></Suspense>} />
                <Route path="correlations" element={<Navigate to="/graph" replace />} />
                <Route path="global-threat-monitoring" element={<Suspense fallback={<LazyFallback />}><GlobalThreats /></Suspense>} />
                <Route path="3d-global-threats" element={<Navigate to="/global-threat-monitoring" replace />} />
                <Route path="global-threats" element={<Navigate to="/global-threat-monitoring" replace />} />
                <Route path="playbooks" element={<Suspense fallback={<LazyFallback />}><Playbooks /></Suspense>} />
                <Route path="integrations" element={<Suspense fallback={<LazyFallback />}><Integrations /></Suspense>} />
                <Route path="connectors" element={<Navigate to="/integrations" replace />} />
                <Route path="outputs" element={<Navigate to="/settings" replace />} />
                <Route path="admin" element={<Suspense fallback={<LazyFallback />}><Admin /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<LazyFallback />}><Settings /></Suspense>} />
                <Route path="ai" element={<Suspense fallback={<LazyFallback />}><AICenter /></Suspense>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;