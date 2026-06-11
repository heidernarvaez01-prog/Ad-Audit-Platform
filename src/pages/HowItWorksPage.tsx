import { ClipboardCheck, Sparkles, Bell, Shield, FileText, BarChart3, Calendar, AlertTriangle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function HowItWorksPage() {
  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">How does Apache Studio Ad Audit work?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quick guide to understand the audit flow, pacing, and alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Step icon={ClipboardCheck} title="1. Create your audit" desc="Register each campaign with its platform, approved budget, dates, and schedule type (every day, Mon-Fri, or Mon-Sat)." />
        <Step icon={BarChart3} title="2. Automatic sync" desc="Every day at 3 AM we pull spend data from Windsor/Dataslayer. Today's and yesterday's spend is excluded while it consolidates." />
        <Step icon={Calendar} title="3. Pacing calculation" desc="We compare % of time elapsed vs % of budget spent to detect overspending or underspending." />
        <Step icon={AlertTriangle} title="4. Alerts and statuses" desc="If the gap exceeds ±10% we flag the campaign as 'Overspending' or 'Underspending' and generate actionable alerts." />
        <Step icon={Sparkles} title="5. AI insights" desc="Request an on-demand diagnosis: the AI assesses risk (critical, moderate, no risk) and suggests concrete actions." />
        <Step icon={Shield} title="6. Controlled access" desc="You only see the accounts an administrator assigned to your email. Admins manage permissions in the Admin section." />
      </div>

      <div className="border border-border rounded-lg bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="q1">
            <AccordionTrigger className="text-sm text-left">How is the "Ideal Daily" calculated?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              It is the total budget divided by the business days in the chosen schedule. It shows how much you should spend per day to land exactly on the approved budget.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger className="text-sm text-left">Why does spend exclude today and yesterday?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Platforms take up to 48 hours to consolidate actual spend. Excluding those days avoids showing partial data that distorts pacing.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger className="text-sm text-left">What does the ±10% threshold mean?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              It is the tolerance between % of time elapsed and % of budget spent. Below -10% you are underspending; above +10% you are overspending. In between, you are "On Track".
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger className="text-sm text-left">How do I link an email to an account?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              From the Admin section, an administrator picks the email, the platform, and the account ID. From then on, that user only sees data for their assigned accounts.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q5">
            <AccordionTrigger className="text-sm text-left">How do I receive alerts?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              In the "Alerts" section you can see the details of every at-risk campaign. Critical notifications appear with 🚨 in the table and with the AI indicator.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="border border-border rounded-lg bg-muted/30 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> click on any row of the matrix to expand charts, metrics (CPC, CTR, CPM), and generate an AI insight in seconds.
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
