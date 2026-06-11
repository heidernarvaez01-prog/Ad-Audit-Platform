import { useNavigate } from 'react-router-dom';
import FloatingIconsHero from '@/components/hero/FloatingIconsHero';

export default function HeroDemo() {
  const navigate = useNavigate();

  return (
    <FloatingIconsHero
      title="Ad Audit"
      subtitle="Intelligent and Automated"
      description="Monitor, analyze, and optimize your ad campaigns in real time with AI-powered insights. Make faster, more effective decisions."
      primaryCta={{
        text: 'Get Started',
        onClick: () => navigate('/auth'),
      }}
      secondaryCta={{
        text: 'View Demo',
        onClick: () => navigate('/how-it-works'),
      }}
    />
  );
}
