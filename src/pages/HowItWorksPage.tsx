import {
  ClipboardCheck, FileText, Network, CalendarClock, Bell, Sparkles,
  Users, Shield, Gauge, BarChart3, BookOpen,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import PageHero from '@/components/PageHero';

export default function HowItWorksPage() {
  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <PageHero
        icon={BookOpen}
        title="How Apache Studio works"
        subtitle="Your command center for paid media: monitor, analyze, strategize and report — one workspace per client."
        gradient="from-violet-600 via-indigo-600 to-sky-500"
      />

      {/* Core idea */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-50 to-violet-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Users className="h-4 w-4" />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Everything is organized by client.</span> Each client (brand)
            has its own isolated space — its audit, brief, strategies and reports never mix with another client's.
            Create clients once in Monitoring Audit and they appear across every section.
          </div>
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Step n="01" icon={ClipboardCheck} title="Monitoring Audit"
          gradient="from-indigo-500 to-violet-600"
          desc="Track every campaign in real time. Budget pacing shows if a campaign is spending what it should by today; performance shows live results (impressions, reach, conversions, CTR, CPC and more)." />
        <Step n="02" icon={CalendarClock} title="Weekly Performance Report"
          gradient="from-sky-500 to-blue-700"
          desc="A clean, client-ready summary of the week's results per campaign, with week-over-week changes and an AI summary. Sent automatically every Monday." />
        <Step n="03" icon={Network} title="Projection Clusters"
          gradient="from-fuchsia-500 to-purple-700"
          desc="One click generates a complete brand strategy (La Fórmula): insights, objectives, audiences, creative concepts, media plan and more — built from the brief and boosted with live data." />
        <Step n="04" icon={Bell} title="Alerts"
          gradient="from-rose-500 to-red-700"
          desc="Six high-signal rules watch your campaigns: overspend, no delivery, ending soon, cost spikes, early budget depletion and creative fatigue — each with an editable threshold. Delivered by email, Slack, webhook or the in-app bell." />
        <Step n="05" icon={FileText} title="Brand Brief"
          gradient="from-amber-500 to-orange-600"
          desc="The strategic foundation of each client: who they are, what they sell, their voice and differentiators. The richer the brief, the sharper the AI strategies." />
        <Step n="06" icon={Sparkles} title="Ask AI"
          gradient="from-cyan-500 to-sky-700"
          desc="A dedicated chat to ask anything about your campaigns. Scope it to a client and campaign for a sharp answer, or leave it open to compare across accounts." />
        <Step n="07" icon={Shield} title="Admin"
          gradient="from-slate-700 to-indigo-700"
          desc="Invite your team, give each member access only to their assigned accounts, manage admins and send password-reset links. The owner keeps full control." />
      </div>

      {/* FAQ */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
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

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> click any row in the audit to expand charts, the full
            metric set and a one-click AI insight for that campaign.
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  n, icon: Icon, title, desc, gradient,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Gradient accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-start gap-3">
        <div className={`relative h-11 w-11 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground/70">{n}</span>
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}
