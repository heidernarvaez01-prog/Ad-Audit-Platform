import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LogIn, Sparkles } from 'lucide-react';
import { FloatingIconsHero } from '@/components/ui/floating-icons-hero-section';
import {
  IconMeta,
  IconGoogleAds,
  IconTikTok,
  IconLinkedIn,
  IconAnalytics,
  IconTargeting,
  IconCampaign,
  IconROI,
  IconConversion,
  IconAudience,
  IconCreative,
  IconOptimization,
  IconBudget,
  IconReporting,
  IconAI,
  IconAutomation,
} from '@/components/icons/AdIcons';

// Define the icons with their unique positions for Apache Studio theme
const adIcons = [
  { id: 1, icon: IconMeta, className: 'top-[10%] left-[10%]' },
  { id: 2, icon: IconGoogleAds, className: 'top-[15%] right-[8%]' },
  { id: 3, icon: IconTikTok, className: 'top-[75%] left-[8%]' },
  { id: 4, icon: IconLinkedIn, className: 'bottom-[8%] right-[12%]' },
  { id: 5, icon: IconAnalytics, className: 'top-[8%] left-[35%]' },
  { id: 6, icon: IconTargeting, className: 'top-[5%] right-[28%]' },
  { id: 7, icon: IconCampaign, className: 'bottom-[12%] left-[28%]' },
  { id: 8, icon: IconROI, className: 'top-[42%] left-[12%]' },
  { id: 9, icon: IconConversion, className: 'top-[70%] right-[20%]' },
  { id: 10, icon: IconAudience, className: 'top-[85%] left-[65%]' },
  { id: 11, icon: IconCreative, className: 'top-[48%] right-[8%]' },
  { id: 12, icon: IconOptimization, className: 'top-[52%] left-[5%]' },
  { id: 13, icon: IconBudget, className: 'top-[6%] left-[58%]' },
  { id: 14, icon: IconReporting, className: 'bottom-[6%] right-[42%]' },
  { id: 15, icon: IconAI, className: 'top-[28%] right-[18%]' },
  { id: 16, icon: IconAutomation, className: 'top-[62%] left-[35%]' },
];

// An invite / password-recovery link drops the user back here with a hash like
// #access_token=...&type=invite (or type=recovery). When that's present we show
// a "set your password" form instead of the normal sign-in.
function readActionType(): 'invite' | 'recovery' | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const t = params.get('type');
  if (t === 'invite' || t === 'recovery') return t;
  return null;
}

export default function AuthPage() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set-password mode (invite / recovery)
  const [actionType, setActionType] = useState<'invite' | 'recovery' | null>(() => readActionType());
  const [confirmPassword, setConfirmPassword] = useState('');
  const settingPassword = actionType !== null;

  useEffect(() => {
    // Re-check once Supabase has processed the URL hash into a session.
    const t = readActionType();
    if (t) setActionType(t);
  }, []);

  useEffect(() => {
    // Don't bounce invited/recovery users to the dashboard before they set a password.
    if (!authLoading && user && !settingPassword) navigate('/', { replace: true });
  }, [user, authLoading, navigate, settingPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (isSignUp) {
      setError('Check your email to confirm your account before signing in.');
    }
    setLoading(false);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Clear the hash and head into the app.
    window.history.replaceState(null, '', window.location.pathname);
    setActionType(null);
    navigate('/', { replace: true });
  };

  if (settingPassword) {
    return (
      <FloatingIconsHero icons={adIcons} showContent={false} className="min-h-screen">
        <div className="w-full max-w-sm px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Apache Studio
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {actionType === 'invite' ? 'Welcome — set your password to join' : 'Set a new password'}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
            <Card className="relative overflow-hidden backdrop-blur-xl bg-card/50 border-border/50 shadow-2xl">
              <div className="relative z-10 p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <LogIn className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Choose your password</h2>
                </div>
                <form onSubmit={handleSetPassword} className="space-y-3">
                  <Input
                    type="password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-all duration-200"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-all duration-200"
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Saving...' : 'Set password & continue'}
                  </Button>
                </form>
              </div>
            </Card>
          </motion.div>
        </div>
      </FloatingIconsHero>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <FloatingIconsHero
      icons={adIcons}
      showContent={false}
      className="min-h-screen"
    >
      {/* Main content centered over floating icons */}
      <div className="w-full max-w-sm px-4">
        {/* Logo/Brand header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 relative"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Sparkles className="h-8 w-8 text-primary" />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 bg-primary/30 blur-xl rounded-2xl"
            />
          </motion.div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Apache Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Ad Audit Platform</p>
        </motion.div>

        {/* Glass card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="relative overflow-hidden backdrop-blur-xl bg-card/50 border-border/50 shadow-2xl">
            {/* Card glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

            {/* Card border glow */}
            <motion.div
              className="absolute inset-0 rounded-lg opacity-0"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)',
              }}
              animate={{
                opacity: [0, 0.5, 0],
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            <div className="relative z-10 p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <LogIn className="h-5 w-5 text-primary" />
                </motion.div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </h2>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-all duration-200"
                  />
                </motion.div>

                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-all duration-200"
                  />
                </motion.div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    type="submit"
                    className="w-full relative overflow-hidden group"
                    disabled={loading}
                  >
                    {/* Button shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{
                        x: ['-100%', '200%'],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                    <span className="relative z-10">
                      {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
                    </span>
                  </Button>
                </motion.div>
              </form>

              {/* Toggle sign up/in */}
              <motion.button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center transition-colors duration-200"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </motion.button>
            </div>
          </Card>
        </motion.div>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-muted-foreground mt-6"
        >
          Intelligent ad audit platform
        </motion.p>
      </div>
    </FloatingIconsHero>
  );
}
