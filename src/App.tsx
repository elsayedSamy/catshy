import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AcceptInvite from "./pages/AcceptInvite";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import Sources from "./pages/Sources";
import Feed from "./pages/Feed";
import History from "./pages/History";
import SearchPage from "./pages/SearchPage";
import Graph from "./pages/Graph";
import Alerts from "./pages/Alerts";
import Investigations from "./pages/Investigations";
import Cases from "./pages/Cases";
import Reports from "./pages/Reports";
import Leaks from "./pages/Leaks";
import Playbooks from "./pages/Playbooks";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import AICenter from "./pages/AICenter";
import Integrations from "./pages/Integrations";
import Vulnerabilities from "./pages/Vulnerabilities";
import Outputs from "./pages/Outputs";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import NotFound from "./pages/NotFound";

// Lazy load heavy pages (Three.js bundle)
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
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="assets" element={<Assets />} />
                <Route path="sources" element={<Sources />} />
                <Route path="feed" element={<Feed />} />
                <Route path="history" element={<History />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="graph" element={<Graph />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="investigations" element={<Investigations />} />
                <Route path="cases" element={<Cases />} />
                <Route path="reports" element={<Reports />} />
                <Route path="leaks" element={<Leaks />} />
                <Route path="vulnerabilities" element={<Vulnerabilities />} />
                <Route path="correlations" element={<Navigate to="/graph" replace />} />
                <Route path="global-threat-monitoring" element={<Suspense fallback={<LazyFallback />}><GlobalThreats /></Suspense>} />
                <Route path="3d-global-threats" element={<Navigate to="/global-threat-monitoring" replace />} />
                <Route path="global-threats" element={<Navigate to="/global-threat-monitoring" replace />} />
                <Route path="playbooks" element={<Playbooks />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="connectors" element={<Navigate to="/integrations" replace />} />
                <Route path="outputs" element={<Outputs />} />
                <Route path="admin" element={<Admin />} />
                <Route path="settings" element={<Settings />} />
                <Route path="ai" element={<AICenter />} />
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
