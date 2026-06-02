import { motion } from "framer-motion";

interface FeatureCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delay: number;
  icon?: React.ReactNode;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, value, subtitle, delay, icon }) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: delay + 0.3,
      },
    },
  };

  const item = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      className="relative overflow-hidden h-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg border border-purple-500/20 group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-blue-600/10 to-purple-600/10 opacity-50" />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: "256px 256px",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      {/* Shine effect */}
      <div className="absolute inset-0 opacity-80 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full animate-[shine_4s_ease-in-out_infinite] w-[200%]" />
      </div>

      <motion.div
        className="relative z-10 p-6 md:p-8 text-white backdrop-blur-sm h-full flex flex-col justify-center"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {icon && (
          <motion.div className="mb-4 text-purple-400" variants={item}>
            {icon}
          </motion.div>
        )}
        <motion.h3 className="text-base md:text-lg text-purple-200 mb-2" variants={item}>
          {title}
        </motion.h3>
        <motion.p className="text-3xl md:text-5xl font-bold mb-4 text-white bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent" variants={item}>
          {value}
        </motion.p>
        {subtitle && (
          <motion.p className="text-sm text-slate-300" variants={item}>
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
};

interface AnimatedFeaturesSectionProps {
  features: Array<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    span?: string; // Tailwind grid span class like "md:col-span-2"
  }>;
  sectionTitle?: string;
  sectionSubtitle?: string;
}

export function AnimatedFeaturesSection({
  features,
  sectionTitle = "Características Principales",
  sectionSubtitle = "Todo lo que necesitas para llevar tus campañas al siguiente nivel"
}: AnimatedFeaturesSectionProps) {
  return (
    <section id="features" className="py-20 px-4 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {sectionTitle}
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            {sectionSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[600px]">
          {features.map((feature, index) => (
            <div key={index} className={feature.span || ""}>
              <FeatureCard
                title={feature.title}
                value={feature.value}
                subtitle={feature.subtitle}
                icon={feature.icon}
                delay={0.2 * (index + 1)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
