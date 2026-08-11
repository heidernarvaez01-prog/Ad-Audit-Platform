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
        title="Cómo funciona Apache Studio"
        subtitle="Tu centro de comando para medios pagados: monitorea, analiza, planea y reporta — un espacio de trabajo por cliente."
        gradient="from-violet-600 via-indigo-600 to-sky-500"
      />

      {/* Core idea */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-50 to-violet-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Users className="h-4 w-4" />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Todo está organizado por cliente.</span> Cada cliente (marca)
            tiene su propio espacio aislado — su auditoría, brief, estrategias y reportes nunca se mezclan con los de otro cliente.
            Crea clientes una vez en Auditoría de monitoreo y aparecen en todas las secciones.
          </div>
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Step n="01" icon={ClipboardCheck} title="Auditoría de monitoreo"
          gradient="from-indigo-500 to-violet-600"
          desc="Da seguimiento a cada campaña en tiempo real. El ritmo de gasto muestra si una campaña está gastando lo que debería a la fecha; el rendimiento muestra resultados en vivo (impresiones, alcance, conversiones, CTR, CPC y más)." />
        <Step n="02" icon={CalendarClock} title="Reporte semanal de rendimiento"
          gradient="from-sky-500 to-blue-700"
          desc="Un resumen limpio y listo para el cliente de los resultados de la semana por campaña, con cambios semana a semana y un resumen de IA. Se envía automáticamente cada lunes." />
        <Step n="03" icon={Network} title="Clusters de proyección"
          gradient="from-fuchsia-500 to-purple-700"
          desc="Con un clic se genera una estrategia de marca completa (La Fórmula): insights, objetivos, audiencias, conceptos creativos, plan de medios y más — construida desde el brief y potenciada con datos en vivo." />
        <Step n="04" icon={Bell} title="Alertas"
          gradient="from-rose-500 to-red-700"
          desc="Seis reglas de alta señal vigilan tus campañas: sobregasto, sin entrega, cierre próximo, picos de costo, agotamiento anticipado del presupuesto y fatiga creativa — cada una con un umbral editable. Se entregan por correo, Slack, webhook o la campana en la app." />
        <Step n="05" icon={FileText} title="Brief de marca"
          gradient="from-amber-500 to-orange-600"
          desc="La base estratégica de cada cliente: quiénes son, qué venden, su voz y diferenciadores. Entre más completo el brief, más precisas las estrategias de IA." />
        <Step n="06" icon={Sparkles} title="Preguntar a la IA"
          gradient="from-cyan-500 to-sky-700"
          desc="Un chat dedicado para preguntar cualquier cosa sobre tus campañas. Acótalo a un cliente y campaña para una respuesta precisa, o déjalo abierto para comparar entre cuentas." />
        <Step n="07" icon={Shield} title="Administración"
          gradient="from-slate-700 to-indigo-700"
          desc="Invita a tu equipo, dale a cada miembro acceso solo a sus cuentas asignadas, gestiona administradores y envía enlaces de restablecimiento de contraseña. El dueño conserva el control total." />
      </div>

      {/* FAQ */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Preguntas frecuentes
        </h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="q1">
            <AccordionTrigger className="text-sm text-left">
              <span className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-primary" /> ¿Qué significan "% Esperado" y "% Actual"?</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              <strong>% Esperado</strong> es cuánto del presupuesto debería estar gastado hoy si el ritmo fuera perfecto (basado en
              cuánto del cronograma ha transcurrido). <strong>% Actual</strong> es cuánto se ha gastado realmente. Cuando el Actual
              está muy por encima del Esperado la campaña está sobregastando (rojo); muy por debajo significa subgastando (ámbar); cercano significa en ritmo (verde).
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger className="text-sm text-left">
              <span className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-primary" /> ¿Cómo se calcula el presupuesto "Ideal diario"?</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Es el saldo restante dividido entre los días que quedan en el cronograma. Gasta esa cantidad por día y la campaña
              termina exactamente en presupuesto en su fecha de fin.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger className="text-sm text-left">¿Por qué el gasto excluye hoy y ayer?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Las plataformas publicitarias tardan hasta 48 horas en finalizar el gasto. Excluir esos dos días mantiene el ritmo
              preciso y evita falsas alarmas por datos incompletos.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger className="text-sm text-left">¿Qué plataformas soporta?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Cualquier plataforma sincronizada a través de Windsor.ai. Meta y Google Ads están soportadas hoy; cada campaña muestra
              su plataforma y las nuevas plataformas aparecen automáticamente al conectarse.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q5">
            <AccordionTrigger className="text-sm text-left">¿Cómo le doy acceso a un compañero de equipo a un solo cliente?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              En Administración: invítalo por correo, luego asígnale la(s) cuenta(s) publicitaria(s) específica(s). Solo verá esas cuentas.
              Los administradores y el dueño ven todo.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q6">
            <AccordionTrigger className="text-sm text-left">¿Las estrategias de IA son diferentes para cada cliente?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Sí. El diseño y la estructura del entregable siempre son el mismo formato premium, pero el contenido se genera
              de forma única a partir del brief de cada cliente y los datos de campaña en vivo.
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
            <span className="font-semibold text-foreground">Tip:</span> haz clic en cualquier fila de la auditoría para expandir
            gráficos, el set completo de métricas y un insight de IA con un clic para esa campaña.
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
