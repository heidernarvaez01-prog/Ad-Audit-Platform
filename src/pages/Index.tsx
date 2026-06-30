import { motion } from 'framer-motion';
import { SocialCards } from '@/components/SocialCards';
import { MetricCards } from '@/components/MetricCard';
import { TrafficChart } from '@/components/TrafficChart';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Index() {
  return (
    <div className="min-h-screen bg-background p-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <motion.div variants={item} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your analytics overview</p>
        </motion.div>

        {/* Metric Cards */}
        <motion.div variants={item}>
          <MetricCards />
        </motion.div>

        {/* Social Cards */}
        <motion.div variants={item}>
          <SocialCards />
        </motion.div>

        {/* Traffic Chart & Additional Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={item} className="lg:col-span-2">
            <TrafficChart />
          </motion.div>

          <motion.div variants={item} className="space-y-4">
            {/* Quick Stats Card 1 */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Average Session</p>
                  <p className="text-2xl font-bold">4m 32s</p>
                  <div className="flex items-center gap-1 text-sm text-success mt-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>+18.2%</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>

            {/* Quick Stats Card 2 */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Bounce Rate</p>
                  <p className="text-2xl font-bold">42.3%</p>
                  <div className="flex items-center gap-1 text-sm text-success mt-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>-5.1%</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-warning" />
                </div>
              </div>
            </Card>

            {/* Quick Stats Card 3 */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">ARPU</p>
                  <p className="text-2xl font-bold">$24.60</p>
                  <div className="flex items-center gap-1 text-sm text-success mt-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>+12.8%</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Activity Timeline */}
        <motion.div variants={item}>
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {[
                { time: '2 hours ago', action: 'New user registered', details: 'john.doe@example.com' },
                { time: '4 hours ago', action: 'Payment received', details: '$2,450.00' },
                { time: '6 hours ago', action: 'Campaign launched', details: 'Summer Sale 2026' },
                { time: '8 hours ago', action: 'Report generated', details: 'Monthly Analytics' },
              ].map((activity, idx) => (
                <div key={idx} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.details}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
