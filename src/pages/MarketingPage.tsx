import { motion, useScroll, useTransform } from 'framer-motion';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import AnimatedCounter from '@/components/AnimatedCounter';
import CustomCursor from '@/components/CustomCursor';
import FloatingParticles from '@/components/FloatingParticles';
import { AnimatedFeaturesDemo } from '@/components/AnimatedFeaturesDemo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, TrendingUp, Zap, BarChart3, Shield, Clock, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const MarketingPage = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const heroGradientY = useTransform(scrollY, [0, 500], [0, 150]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const heroSection = useScrollAnimation();
  const statsSection = useScrollAnimation();
  const servicesSection = useScrollAnimation();
  const casesSection = useScrollAnimation();
  const ctaSection = useScrollAnimation();

  return (
    <div className="marketing-page min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950 text-white overflow-hidden">
      <CustomCursor />
      <FloatingParticles />

      {/* Navbar */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-slate-950/70 glass-effect border-b border-purple-500/20 shadow-2xl shadow-purple-500/10'
            : 'bg-transparent'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div
            className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
            whileHover={{ scale: 1.05 }}
          >
            Ad Insight Hub
          </motion.div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#servicios" className="hover:text-purple-400 transition-colors font-medium">Servicios</a>
            <a href="#casos" className="hover:text-purple-400 transition-colors font-medium">Casos de Éxito</a>
            <a href="#contacto" className="hover:text-purple-400 transition-colors font-medium">Contacto</a>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/30">
                Comenzar Gratis
              </Button>
            </motion.div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-purple-500/20"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              <a href="#servicios" className="hover:text-purple-400 transition-colors font-medium" onClick={() => setMobileMenuOpen(false)}>Servicios</a>
              <a href="#casos" className="hover:text-purple-400 transition-colors font-medium" onClick={() => setMobileMenuOpen(false)}>Casos de Éxito</a>
              <a href="#contacto" className="hover:text-purple-400 transition-colors font-medium" onClick={() => setMobileMenuOpen(false)}>Contacto</a>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 w-full">
                Comenzar Gratis
              </Button>
            </div>
          </motion.div>
        )}
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroSection.ref} style={heroSection.style} className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-12 overflow-hidden">
        {/* Animated Gradient Background - Layer 1 */}
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.4), rgba(59, 130, 246, 0.4), transparent)',
            y: heroGradientY,
          }}
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        {/* Animated Gradient Background - Layer 2 */}
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(circle at 30% 70%, rgba(236, 72, 153, 0.3), rgba(139, 92, 246, 0.3), transparent)',
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                Transforma tus
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"> campañas publicitarias</span>
              </h1>
            </motion.div>

            <motion.p
              className="text-xl text-slate-300 leading-relaxed"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Auditoría inteligente multi-plataforma que optimiza tus inversiones publicitarias en tiempo real
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-lg px-8 py-6 group shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all">
                  Comenzar Ahora
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" variant="outline" className="border-purple-400/50 text-white hover:bg-purple-500/10 hover:border-purple-400 text-lg px-8 py-6 transition-all">
                  Ver Demo
                </Button>
              </motion.div>
            </motion.div>
          </div>

          {/* Stats Cards */}
          <motion.div
            className="grid grid-cols-2 gap-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <StatCard
              icon={<TrendingUp className="w-8 h-8" />}
              value={<AnimatedCounter end={319} prefix="+" suffix="%" />}
              label="ROI Promedio"
            />
            <StatCard
              icon={<Target className="w-8 h-8" />}
              value={<AnimatedCounter end={85} prefix="+" suffix="%" />}
              label="Reducción de Costos"
            />
            <StatCard
              icon={<Zap className="w-8 h-8" />}
              value={<AnimatedCounter end={38} prefix="+" suffix="%" />}
              label="Más Conversiones"
            />
            <StatCard
              icon={<BarChart3 className="w-8 h-8" />}
              value={<AnimatedCounter end={24} suffix="/7" />}
              label="Monitoreo Continuo"
            />
          </motion.div>
        </div>
      </section>

      {/* Animated Features Section with Shine Effect */}
      <div ref={servicesSection.ref} style={servicesSection.style}>
        <AnimatedFeaturesDemo />
      </div>

      {/* Services Section */}
      <section id="servicios" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Servicios que
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> Potencian tu Negocio</span>
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Soluciones integrales para optimizar cada aspecto de tus campañas publicitarias
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <ServiceCard
              icon={<Shield className="w-12 h-12" />}
              title="Auditoría Completa"
              description="Análisis profundo de todas tus campañas en Meta, Google, TikTok y LinkedIn"
            />
            <ServiceCard
              icon={<TrendingUp className="w-12 h-12" />}
              title="Optimización Automática"
              description="IA que ajusta tus campañas en tiempo real para maximizar resultados"
            />
            <ServiceCard
              icon={<Clock className="w-12 h-12" />}
              title="Reportes Instantáneos"
              description="Dashboards en vivo con métricas clave y recomendaciones accionables"
            />
          </div>
        </div>
      </section>

      {/* Case Studies Section */}
      <section id="casos" ref={casesSection.ref} style={casesSection.style} className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Casos de
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> Éxito</span>
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Empresas que transformaron sus resultados con nuestra plataforma
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <CaseCard
              company="E-commerce Fashion"
              result="+285% en ROAS"
              description="Reducción del 60% en CPA mientras escalaban sus ventas 3x"
              metric="De $12K a $46K mensuales en 3 meses"
            />
            <CaseCard
              company="SaaS B2B"
              result="+420% Leads Calificados"
              description="Optimización de campañas LinkedIn que revolucionó su pipeline"
              metric="CPL reducido de $85 a $28"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaSection.ref} style={ctaSection.style} className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              ¿Listo para
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> 3x tus resultados?</span>
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Únete a cientos de empresas que ya optimizan sus campañas con IA
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-lg px-12 py-6 shadow-2xl shadow-purple-500/50 hover:shadow-purple-500/70 transition-all group">
                Comenzar Prueba Gratis de 14 Días
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-purple-500/20">
        <div className="max-w-7xl mx-auto text-center text-slate-400">
          <p>&copy; 2026 Ad Insight Hub. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) => (
  <motion.div
    whileHover={{ scale: 1.05, y: -5 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl border-purple-500/30 p-6 hover:border-purple-400/50 transition-all">
      <div className="text-purple-400 mb-3">{icon}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </Card>
  </motion.div>
);

// Service Card Component
const ServiceCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`relative bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-xl border p-8 h-full transition-all duration-300 ${
        isHovered
          ? 'border-transparent shadow-2xl shadow-purple-500/20'
          : 'border-purple-500/20'
      }`}>
        {isHovered && (
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 blur-xl" />
        )}
        <div className="relative z-10">
          <div className="text-purple-400 mb-4">{icon}</div>
          <h3 className="text-2xl font-bold mb-3">{title}</h3>
          <p className="text-slate-300">{description}</p>
        </div>
      </Card>
    </motion.div>
  );
};

// Case Card Component
const CaseCard = ({ company, result, description, metric }: { company: string; result: string; description: string; metric: string }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`relative bg-gradient-to-br from-slate-900/80 to-blue-900/20 backdrop-blur-xl border p-8 transition-all duration-300 ${
        isHovered
          ? 'border-transparent shadow-2xl shadow-blue-500/20'
          : 'border-blue-500/20'
      }`}>
        {isHovered && (
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl" />
        )}
        <div className="relative z-10">
          <div className="text-sm text-slate-400 mb-2">{company}</div>
          <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {result}
          </h3>
          <p className="text-slate-300 mb-4">{description}</p>
          <div className="text-sm text-blue-400 font-semibold">{metric}</div>
        </div>
      </Card>
    </motion.div>
  );
};

export default MarketingPage;
