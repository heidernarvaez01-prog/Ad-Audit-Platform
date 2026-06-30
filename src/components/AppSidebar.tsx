import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ClipboardCheck, ChevronsLeft, ChevronsRight, FileText, Bell, LogOut, Moon, Sun,
  Shield, HelpCircle, Network, CalendarClock, PieChart, ListChecks, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/apache-studio-logo.png.asset.json';

interface NavLeaf { to: string; label: string; icon: LucideIcon }

// Main action menu — order requested by the team
const mainNav: NavLeaf[] = [
  { to: '/', label: 'Monitoring Audit', icon: ClipboardCheck },
  { to: '/weekly-report', label: 'Weekly Performance Report', icon: CalendarClock },
  { to: '/reporting', label: 'Looker Reporting', icon: PieChart },
  { to: '/clusters', label: 'Projection Clusters', icon: Network },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/my-tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/brief', label: 'Brand Brief', icon: FileText },
];

interface AppSidebarProps {
  forceExpanded?: boolean;
  hideToggle?: boolean;
}

export default function AppSidebar({ forceExpanded = false, hideToggle = false }: AppSidebarProps = {}) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinned, setPinned] = useState(false); // arrow keeps it open

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // "Open" = always wide (mobile sheet or pinned). Otherwise it's a rail that
  // expands on hover via pure CSS (group-hover) — reliable, no layout shift.
  const open = forceExpanded || pinned;
  const RAIL = 60;
  const FULL = 240;
  // label/header visibility: shown when open, OR on hover when it's a rail
  const labelCls = open
    ? 'opacity-100'
    : 'opacity-0 group-hover/side:opacity-100';

  const isActive = (to: string) =>
    to === '/'
      ? location.pathname === '/' || location.pathname.startsWith('/client/') || location.pathname.startsWith('/audit/')
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  const NavRow = ({ to, label, icon: Icon }: NavLeaf) => {
    const active = isActive(to);
    return (
      <NavLink
        to={to}
        className={`group relative flex items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium
          transition-all duration-200 overflow-hidden hover:scale-[1.02] active:scale-[0.98]
          ${active
            ? 'bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-sm'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30'}`}
        title={!open ? label : undefined}
      >
        <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110" />
        <span className={`whitespace-nowrap transition-opacity duration-200 ${labelCls}`}>
          {label}
        </span>
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary animate-pulse" />}
      </NavLink>
    );
  };

  const ActionRow = ({
    icon: Icon, label, onClick, danger,
  }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      title={!open ? label : undefined}
      className={`w-full flex items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium
        transition-all duration-200 overflow-hidden hover:scale-[1.02] active:scale-[0.98]
        ${danger
          ? 'text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10'
          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30'}`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 hover:rotate-12" />
      <span className={`whitespace-nowrap transition-opacity duration-200 ${labelCls}`}>
        {label}
      </span>
    </button>
  );

  return (
    // Outer reserves only the rail width; the panel overlays on hover so the
    // page content never shifts (that was the "feels like a bug" part).
    <div className="group/side relative shrink-0" style={{ width: open ? FULL : RAIL }}>
      <aside
        className={`absolute inset-y-0 left-0 z-40 min-h-screen flex flex-col
          bg-sidebar border-r border-sidebar-border shadow-lg
          transition-[width] duration-200 ease-out
          ${open ? 'w-[240px]' : 'w-[60px] hover:w-[240px]'}`}
        style={{ background: 'hsl(var(--sidebar-background))' }}
      >
        {/* Header */}
        <div className="h-16 flex items-center gap-3 px-3 border-b border-sidebar-border shrink-0">
          <img src={logo.url} alt="Apache Studio" className="h-9 w-9 object-contain shrink-0 rounded-lg" />
          <div className={`min-w-0 transition-opacity duration-200 ${labelCls}`}>
            <h1 className="text-sm font-semibold tracking-tight truncate text-sidebar-foreground">Apache Studio</h1>
            <p className="text-[11px] text-sidebar-foreground/70 truncate">Ad Audit</p>
          </div>
          {!hideToggle && (
            <button
              onClick={() => setPinned(p => !p)}
              className={`ml-auto p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground
                hover:bg-sidebar-accent/40 transition-opacity shrink-0 ${labelCls}`}
              title={pinned ? 'Unpin menu' : 'Keep menu open'}
            >
              {pinned ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Main navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {mainNav.map(item => <NavRow key={item.to} {...item} />)}
        </nav>

        {/* Settings group (bottom): Dark mode · How it works · Admin · account · Sign out */}
        <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
          <ActionRow
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggle}
          />
          <NavRow to="/how-it-works" label="How it works" icon={HelpCircle} />
          {isAdmin && <NavRow to="/admin" label="Admin" icon={Shield} />}

          {user && (
            <>
              <div className={`px-3 pt-1.5 pb-0.5 transition-opacity duration-200 ${labelCls}`}>
                <p className="text-[11px] text-sidebar-foreground/50 truncate" title={user.email ?? ''}>
                  {user.email}
                </p>
              </div>
              <ActionRow icon={LogOut} label="Sign out" onClick={() => signOut()} danger />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
