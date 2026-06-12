import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, ChevronLeft, ChevronRight, FileText, Bell, LogOut, Moon, Sun, Shield, HelpCircle, Network, CalendarClock, PieChart } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/apache-studio-logo.png.asset.json';

const baseNav = [
  { to: '/', label: 'Monitoring Audit', icon: ClipboardCheck },
  { to: '/brief', label: 'Brand Brief', icon: FileText },
  { to: '/clusters', label: 'Projection Clusters', icon: Network },
  { to: '/weekly-report', label: 'Weekly Report', icon: CalendarClock },
  { to: '/reporting', label: 'Reporting', icon: PieChart },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/how-it-works', label: 'How it works', icon: HelpCircle },
];

interface AppSidebarProps {
  forceExpanded?: boolean;
  hideToggle?: boolean;
}

export default function AppSidebar({ forceExpanded = false, hideToggle = false }: AppSidebarProps = {}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(!forceExpanded);
  const [scrolled, setScrolled] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Detect scroll for glass effect enhancement
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = isAdmin ? [...baseNav, { to: '/admin', label: 'Admin', icon: Shield }] : baseNav;

  const sidebarVariants = {
    collapsed: { width: 56 },
    expanded: { width: 224 }
  };

  const containerVariants = {
    collapsed: { opacity: 1 },
    expanded: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    collapsed: { opacity: 0, x: -10 },
    expanded: { opacity: 1, x: 0 }
  };

  return (
    <motion.aside
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`
        min-h-screen flex flex-col relative
        ${scrolled ? 'glass-effect glass-border' : 'bg-sidebar/95 backdrop-blur-sm'}
        border-r border-sidebar-border/50
        transition-all duration-300 ease-out
      `}
      style={{
        background: scrolled
          ? 'rgba(var(--sidebar-background-rgb, 15, 17, 28), 0.7)'
          : 'hsl(var(--sidebar-background))'
      }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <motion.div
        className={`
          ${collapsed ? 'p-2 flex-col gap-2' : 'p-4 justify-between gap-2'}
          border-b border-sidebar-border/50 flex items-center relative z-10
          backdrop-blur-sm
        `}
      >
        {collapsed ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-2 w-full"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className="relative"
            >
              <img src={logo.url} alt="Apache Studio" className="h-8 w-8 object-contain" />
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            </motion.div>

            {!hideToggle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    onClick={() => setCollapsed(false)}
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full flex items-center justify-center p-1.5 rounded-lg
                      text-sidebar-foreground/70 hover:text-sidebar-foreground
                      transition-colors duration-200"
                    aria-label="Expand menu"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Expand menu</TooltipContent>
              </Tooltip>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2 min-w-0">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="relative"
              >
                <img src={logo.url} alt="Apache Studio" className="h-10 w-10 object-contain shrink-0" />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-primary/30 blur-xl rounded-full"
                />
              </motion.div>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="min-w-0"
              >
                <h1 className="text-base font-bold tracking-tight truncate bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text text-transparent">
                  Apache Studio
                </h1>
                <p className="text-xs text-sidebar-foreground/60 mt-0.5 truncate">Ad Audit</p>
              </motion.div>
            </div>
            {!hideToggle && (
              <motion.button
                onClick={() => setCollapsed(true)}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground
                  transition-colors duration-200 shrink-0"
                aria-label="Collapse menu"
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Navigation */}
      <motion.nav
        variants={containerVariants}
        className={`flex-1 ${collapsed ? 'p-1.5' : 'p-2'} space-y-0.5 relative z-10`}
      >
        <AnimatePresence mode="wait">
          {navItems.map(({ to, label, icon: Icon }, index) => {
            const active = to === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/client/') || location.pathname.startsWith('/audit/')
              : location.pathname === to || location.pathname.startsWith(`${to}/`);

            const linkContent = (
              <motion.div
                initial={false}
                whileHover={{ x: collapsed ? 0 : 4, scale: collapsed ? 1.05 : 1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative"
              >
                <NavLink
                  key={to}
                  to={to}
                  className={`
                    flex items-center gap-2.5 relative z-10
                    ${collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}
                    rounded-lg text-sm font-medium transition-all duration-200
                    ${active
                      ? 'text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
                    }
                  `}
                >
                  {/* Active background with glow */}
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-sidebar-accent/80 rounded-lg"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  {/* Hover background */}
                  {!active && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                      className="absolute inset-0 bg-sidebar-accent/30 rounded-lg"
                      transition={{ duration: 0.2 }}
                    />
                  )}

                  {/* Icon with glow effect on active */}
                  <motion.div
                    animate={active ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <Icon className="h-4 w-4 shrink-0 relative z-10" />
                    {active && (
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 bg-primary blur-md"
                      />
                    )}
                  </motion.div>

                  {!collapsed && (
                    <motion.span
                      variants={itemVariants}
                      className="truncate relative z-10"
                    >
                      {label}
                    </motion.span>
                  )}
                </NavLink>
              </motion.div>
            );

            return collapsed ? (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
              </Tooltip>
            ) : (
              <motion.div
                key={to}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {linkContent}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.nav>

      {/* Theme Toggle */}
      <div className={`border-t border-sidebar-border/50 ${collapsed ? 'p-1.5' : 'p-2'} space-y-1 relative z-10`}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                onClick={toggle}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.95, rotate: 15 }}
                className="w-full flex items-center justify-center p-2 rounded-lg
                  text-sidebar-foreground/70 hover:text-sidebar-foreground
                  transition-colors duration-200"
                aria-label="Toggle theme"
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: theme === 'dark' ? 0 : 180 }}
                  transition={{ duration: 0.3 }}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.div>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <motion.button
            onClick={toggle}
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
              text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground
              transition-all duration-200"
          >
            <motion.div
              animate={{ rotate: theme === 'dark' ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            </motion.div>
            <motion.span
              variants={itemVariants}
              className="truncate"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </motion.span>
          </motion.button>
        )}
      </div>

      {/* User Section */}
      {user && (
        <motion.div
          className={`border-t border-sidebar-border/50 ${collapsed ? 'p-1.5' : 'p-2'} space-y-1 relative z-10`}
        >
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-2 mb-1"
            >
              <p className="text-xs text-sidebar-foreground/60 truncate" title={user.email ?? ''}>
                {user.email}
              </p>
            </motion.div>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => signOut()}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full flex items-center justify-center p-2 rounded-lg
                    text-sidebar-foreground/70 hover:text-destructive
                    transition-colors duration-200"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <motion.button
              onClick={() => signOut()}
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                text-sm font-medium text-sidebar-foreground/70 hover:text-destructive
                transition-all duration-200"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <motion.span
                variants={itemVariants}
                className="truncate"
              >
                Sign out
              </motion.span>
            </motion.button>
          )}
        </motion.div>
      )}
    </motion.aside>
  );
}
