import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  trend: 'up' | 'down';
  trendValue: string;
  icon: LucideIcon;
  accentColor: string;
  index: number;
  sparklineData?: number[];
}

export function MetricCard({
  title,
  value,
  unit = '',
  trend,
  trendValue,
  icon: Icon,
  accentColor,
  index,
  sparklineData = [],
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // CountUp animation
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend === 'up' ? 'text-success' : 'text-danger';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className={`relative overflow-hidden border-t-accent hover:shadow-md transition-shadow`}
        style={{ borderTopColor: accentColor }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
              <div className="flex items-baseline gap-2">
                <motion.span
                  className="text-3xl font-bold"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: index * 0.1 }}
                >
                  {displayValue.toLocaleString()}
                </motion.span>
                {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
              </div>
            </div>
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Icon className="h-6 w-6" style={{ color: accentColor }} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              <span>{trendValue}</span>
            </div>
            {sparklineData.length > 0 && (
              <div className="flex items-end gap-0.5 h-8">
                {sparklineData.map((height, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: index * 0.1 + i * 0.05, duration: 0.3 }}
                    className="w-1 rounded-full"
                    style={{ backgroundColor: accentColor, opacity: 0.7 }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

interface MetricCardsProps {
  className?: string;
}

export function MetricCards({ className = '' }: MetricCardsProps) {
  const metrics = [
    {
      title: 'Total Users',
      value: 26500,
      trend: 'up' as const,
      trendValue: '+12.5%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      accentColor: '#5856d6',
      sparklineData: [40, 60, 45, 70, 55, 80, 75, 90],
    },
    {
      title: 'Revenue',
      value: 52340,
      unit: '$',
      trend: 'up' as const,
      trendValue: '+8.2%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      accentColor: '#2eb85c',
      sparklineData: [30, 45, 55, 50, 65, 70, 85, 95],
    },
    {
      title: 'Conversion Rate',
      value: 3.65,
      unit: '%',
      trend: 'up' as const,
      trendValue: '+2.1%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      accentColor: '#f9b115',
      sparklineData: [50, 45, 60, 55, 70, 65, 75, 80],
    },
    {
      title: 'Sessions',
      value: 157820,
      trend: 'down' as const,
      trendValue: '-2.5%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      ),
      accentColor: '#39f',
      sparklineData: [80, 75, 70, 65, 60, 55, 50, 45],
    },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {metrics.map((metric, index) => (
        <MetricCard key={metric.title} {...metric} index={index} />
      ))}
    </div>
  );
}
