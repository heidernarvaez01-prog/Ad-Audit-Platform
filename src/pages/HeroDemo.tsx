import { useNavigate } from 'react-router-dom';
import FloatingIconsHero from '@/components/hero/FloatingIconsHero';

export default function HeroDemo() {
  const navigate = useNavigate();

  return (
    <FloatingIconsHero
      title="Auditoría Publicitaria"
      subtitle="Inteligente y Automatizada"
      description="Monitorea, analiza y optimiza tus campañas publicitarias en tiempo real con insights impulsados por IA. Toma decisiones más rápidas y efectivas."
      primaryCta={{
        text: 'Comenzar Ahora',
        onClick: () => navigate('/auth'),
      }}
      secondaryCta={{
        text: 'Ver Demo',
        onClick: () => navigate('/how-it-works'),
      }}
    />
  );
}
