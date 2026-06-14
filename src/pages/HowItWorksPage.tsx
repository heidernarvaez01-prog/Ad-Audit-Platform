import {
  ClipboardCheck, FileText, Network, CalendarClock, PieChart, Bell, Sparkles,
  Users, Shield, Gauge, BarChart3,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function HowItWorksPage() {
  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">How Apache Studio works</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your command center for paid media: monitor, analyze, strategize and report — one workspace per client.
        </p>
      </div>

      {/* Core idea */}
      <div className="border border-border rounded-lg bg-muted/30 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Everything is organized by client.</span> Each client (brand)
            has its own isolated space — its audit, brief, strategies and reports never mix with another client's.
            Create clients once in Monitoring Audit and they appear across every section.
          </div>
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Step icon={ClipboardCheck} title="Monitoring Audit"
          desc="Track every campaign in real time. The Budget Pacing view shows if a campaign is spending what it should by today; the Performance view shows live results (impressions, reach, conversions, CTR, CPC and more)." />
        <Step icon={CalendarClock} title="Weekly Performance Report"
          desc="A clean, client-ready summary of the week's results per campaign, with week-over-week changes and an AI summary. Sent automatically every Monday." />
        <Step icon={PieChart} title="Looker Reporting"
          desc="Embed each client's full Looker Studio report. Edit freely in Looker; only the version you mark as approved is shown to the client." />
        <Step icon={Network} title="Projection Clusters"
          desc="One click generates a complete brand strategy (La Fórmula): insights, objectives, audiences, creative concepts, media plan and more — built from the brief and boosted with live data." />
        <Step icon={Bell} title="Alerts"
          desc="Six high-signal rules watch your campaigns: overspend, no delivery, ending soon, cost spikes, early budget depletion and creative fatigue. No noise — only what matters." />
        <Step icon={FileText} title="Brand Brief"
          desc="The strategic foundation of each client: who they are, what they sell, their voice and differentiators. The richer the brief, the sharper the AI strategies." />
        <Step icon={Sparkles} title="AI Analysis (floating)"
          desc="The sparkle bubble at the bottom-right opens a chat. Pick a client and campaign, then ask anything about performance and get instant, data-grounded answers." />
        <Step icon={Shield} title="Admin"
          desc="Invite your team, give each member access only to their assigned accounts, manage admins and send password-reset links. The owner keeps full control." />
      </div>

      {/* FAQ */}
      <div className="border border-border rounded-lg bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="q1">
            <AccordionTrigger className="text-sm text-left">
              <span className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-primary" /> What do "% Expected" and "% Actual" mean?</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              <strong>% Expected</strong> is how much of the budget should be spent by today if pacing were perfect (based on
              how much of the schedule has elapsed). <strong>% Actual</strong> is how much has really been spent. When Actual
              is far above Expected the campaign is overspending (red); far below means underspending (amber); close means on track (green).
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger className="text-sm text-left">
              <span className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-primary" /> How is the "Ideal Daily" budget calculated?</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              It's the remaining balance divided by the days left in the schedule. Spend that amount per day and the campaign
              lands exactly on budget by its end date.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger className="text-sm text-left">Why does spend exclude today and yesterday?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Ad platforms take up to 48 hours to finalize spend. Excluding those two days keeps pacing accurate and avoids
              false alarms from incomplete data.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger className="text-sm text-left">Which platforms does it support?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Any platform synced through Windsor.ai. Meta and Google Ads are supported today; each campaign shows its platform
              and new platforms appear automatically once connected.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q5">
            <AccordionTrigger className="text-sm text-left">How do I give a teammate access to only one client?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              In Admin: invite them by email, then assign the specific ad account(s) to them. They'll only see those accounts.
              Admins and the owner see everything.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q6">
            <AccordionTrigger className="text-sm text-left">Are the AI strategies different for each client?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Yes. The design and structure of the deliverable are always the same premium format, but the content is generated
              uniquely from each client's brief and live campaign data.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="border border-border rounded-lg bg-muted/30 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> click any row in the audit to expand charts, the full
            metric set and a one-click AI insight for that campaign.
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="border border-border rounded-lg bg-card p-4 flex gap-3">
      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
