import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import AppSidebar from "@/components/AppSidebar";
import AuditPage from "@/pages/AuditPage";
import AuthPage from "@/pages/AuthPage";
import BriefPage from "@/pages/BriefPage";
import MetricsAIPage from "@/pages/MetricsAIPage";
import AlertsPage from "@/pages/AlertsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppLayout() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<RequireAuth><AppShell><AuditPage /></AppShell></RequireAuth>} />
        <Route path="/brief" element={<RequireAuth><AppShell><BriefPage /></AppShell></RequireAuth>} />
        <Route path="/metrics-ai" element={<RequireAuth><AppShell><MetricsAIPage /></AppShell></RequireAuth>} />
        <Route path="/alerts" element={<RequireAuth><AppShell><AlertsPage /></AppShell></RequireAuth>} />
        <Route path="*" element={<AppShell><NotFound /></AppShell>} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppLayout />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
