import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Menu, FileText, Network } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import AppSidebar from "@/components/AppSidebar";
import ClientPicker from "@/components/ClientPicker";
import ClientsPage from "@/pages/ClientsPage";
import AuditPage from "@/pages/AuditPage";
import AuditDetailPage from "@/pages/AuditDetailPage";
import AuthPage from "@/pages/AuthPage";
import BriefPage from "@/pages/BriefPage";
import ClusterPage from "@/pages/ClusterPage";
import MetricsAIPage from "@/pages/MetricsAIPage";
import AlertsPage from "@/pages/AlertsPage";
import AdminPage from "@/pages/AdminPage";
import HowItWorksPage from "@/pages/HowItWorksPage";
import HeroDemo from "@/pages/HeroDemo";
import FloatingIconsDemo from "@/pages/FloatingIconsDemo";
import NotFound from "@/pages/NotFound";
import UnsubscribePage from "@/pages/UnsubscribePage";
import logo from "@/assets/apache-studio-logo.png.asset.json";

const queryClient = new QueryClient();

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex">
        <AppSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-12 flex items-center justify-between px-3 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[240px] border-r-0">
              <div onClick={() => setMobileOpen(false)} className="h-full">
                <AppSidebar forceExpanded hideToggle />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo.url} alt="Apache Studio" className="h-6 w-6 object-contain" />
            <span className="text-sm font-semibold truncate">Apache Studio</span>
          </div>
          <div className="w-8" />
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto min-w-0">{children}</main>
      </div>
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
        <Route path="/hero-demo" element={<HeroDemo />} />
        <Route path="/floating-icons-demo" element={<FloatingIconsDemo />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/" element={<RequireAuth><AppShell><ClientsPage /></AppShell></RequireAuth>} />
        <Route path="/client/:clientId" element={<RequireAuth><AppShell><AuditPage /></AppShell></RequireAuth>} />
        <Route path="/audit/:id" element={<RequireAuth><AppShell><AuditDetailPage /></AppShell></RequireAuth>} />
        <Route path="/brief" element={<RequireAuth><AppShell>
          <ClientPicker
            title="Brand Brief"
            subtitle="Strategic context per client — primary input of the AI projection clusters"
            basePath="/brief"
            icon={FileText}
            mode="brief"
          />
        </AppShell></RequireAuth>} />
        <Route path="/brief/:clientId" element={<RequireAuth><AppShell><BriefPage /></AppShell></RequireAuth>} />
        <Route path="/clusters" element={<RequireAuth><AppShell>
          <ClientPicker
            title="Projection Clusters"
            subtitle="AI strategy engines per client — built from the brief, boosted with live campaign data"
            basePath="/clusters"
            icon={Network}
            mode="clusters"
          />
        </AppShell></RequireAuth>} />
        <Route path="/clusters/:clientId" element={<RequireAuth><AppShell><ClusterPage /></AppShell></RequireAuth>} />
        <Route path="/metrics-ai" element={<RequireAuth><AppShell><MetricsAIPage /></AppShell></RequireAuth>} />
        <Route path="/alerts" element={<RequireAuth><AppShell><AlertsPage /></AppShell></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><AppShell><AdminPage /></AppShell></RequireAuth>} />
        <Route path="/how-it-works" element={<RequireAuth><AppShell><HowItWorksPage /></AppShell></RequireAuth>} />
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
