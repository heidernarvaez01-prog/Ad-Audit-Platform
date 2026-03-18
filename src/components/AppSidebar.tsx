import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Settings, Link2, LogOut, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/', label: 'Auditoría', icon: ClipboardCheck },
];

export default function AppSidebar() {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-56 min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-base font-bold tracking-tight">Ad Audit</h1>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">Auditoría Publicitaria</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={() =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                location.pathname === to
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
