import { AnimatedFeaturesSection } from './AnimatedFeaturesSection';
import { Target, TrendingUp, Zap, BarChart3, Shield, Clock } from 'lucide-react';

/**
 * Demostración de uso del componente AnimatedFeaturesSection
 * Este componente muestra las características principales de Ad Insight Hub
 * con el efecto de destello (shine) animado.
 */
export function AnimatedFeaturesDemo() {
  const features = [
    {
      title: "Análisis Avanzado",
      value: "Tiempo Real",
      subtitle: "Obtén insights profundos sobre el rendimiento de tus campañas con análisis y reportes completos",
      icon: <BarChart3 className="w-8 h-8" />,
      span: "md:col-span-2"
    },
    {
      title: "Colaboración en Equipo",
      value: "Sin Límites",
      subtitle: "Trabaja eficientemente con tu equipo",
      icon: <Target className="w-8 h-8" />
    },
    {
      title: "Rendimiento Relámpago",
      value: "99.9%",
      subtitle: "Tiempo de actividad garantizado",
      icon: <Zap className="w-8 h-8" />
    },
    {
      title: "Seguridad Empresarial",
      value: "Nivel Bancario",
      subtitle: "Encriptación de extremo a extremo con certificaciones de cumplimiento para máxima seguridad",
      icon: <Shield className="w-8 h-8" />,
      span: "md:col-span-2"
    },
    {
      title: "Escala Global y Móvil",
      value: "Mundial",
      subtitle: "Despliega globalmente con nuestra infraestructura y accede a tu dashboard desde cualquier lugar con diseño responsivo",
      icon: <Clock className="w-8 h-8" />,
      span: "md:col-span-3"
    }
  ];

  return (
    <AnimatedFeaturesSection
      features={features}
      sectionTitle="Características Poderosas de Ad Insight Hub"
      sectionSubtitle="Todo lo que necesitas para llevar tu negocio al siguiente nivel"
    />
  );
}
