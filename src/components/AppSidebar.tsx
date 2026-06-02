import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ClipboardCheck, ChevronLeft, ChevronRight, FileText, Sparkles, Bell, LogOut, Moon, Sun } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import logo from '@/assets/apache-studio-logo.png.asset.json';

const navItems = [
  { to: '/', label: 'Auditoría Meta', icon: ClipboardCheck },
  { to: '/brief', label: 'Brief de Marca', icon: FileText },
  { to: '/metrics-ai', label: 'Análisis IA', icon: Sparkles },
  { to: '/alerts', label: 'Alertas', icon: Bell },
];

export default function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const { user, signOut } = useAuth();

  return (
    <aside
      className={`${collapsed ? 'w-14' : 'w-56'} min-h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-[width] duration-200 ease-out border-r border-sidebar-border`}
    >
      <div className={`${collapsed ? 'p-2' : 'p-4'} border-b border-sidebar-border flex items-center justify-between gap-2`}>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight truncate">Ad Audit</h1>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5 truncate">Auditoría Publicitaria</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors shrink-0"
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className={`flex-1 ${collapsed ? 'p-1.5' : 'p-2'} space-y-0.5`}>
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          const link = (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-2.5 ${collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'} rounded text-sm font-medium transition-colors ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip key={to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
            </Tooltip>
          ) : link;
        })}
      </nav>

      {user && (
        <div className={`border-t border-sidebar-border ${collapsed ? 'p-1.5' : 'p-2'} space-y-1`}>
          {!collapsed && (
            <p className="text-xs text-sidebar-foreground/60 truncate px-2" title={user.email ?? ''}>
              {user.email}
            </p>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center justify-center p-2 rounded text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Cerrar sesión</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="truncate">Cerrar sesión</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
