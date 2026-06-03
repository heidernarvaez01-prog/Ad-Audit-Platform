import { ClipboardCheck, Sparkles, Bell, Shield, FileText, BarChart3, Calendar, AlertTriangle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function HowItWorksPage() {
  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">¿Cómo funciona Apache Studio Ad Audit?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Guía rápida para entender el flujo de auditoría, el pacing y las alertas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Step icon={ClipboardCheck} title="1. Crea tu auditoría" desc="Registra cada campaña con plataforma, presupuesto aprobado, fechas y tipo de calendario (corridos, lun-vie o lun-sáb)." />
        <Step icon={BarChart3} title="2. Sincronización automática" desc="Cada día a las 3 AM traemos los datos de gasto desde Windsor/Dataslayer. El gasto de hoy y ayer se excluye por estar en consolidación." />
        <Step icon={Calendar} title="3. Cálculo de pacing" desc="Comparamos % de tiempo transcurrido vs % de presupuesto gastado para detectar sobregasto o subgasto." />
        <Step icon={AlertTriangle} title="4. Alertas y estados" desc="Si la diferencia supera ±10% marcamos la campaña como 'Sobregastando' o 'Subgastando' y generamos alertas accionables." />
        <Step icon={Sparkles} title="5. Insights con IA" desc="Pide un diagnóstico bajo demanda: la IA evalúa el riesgo (crítico, moderado, sin riesgo) y propone acciones concretas." />
        <Step icon={Shield} title="6. Acceso controlado" desc="Solo verás las cuentas que el administrador asignó a tu correo. Los administradores gestionan los permisos en Administración." />
      </div>

      <div className="border border-border rounded-lg bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Preguntas frecuentes
        </h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="q1">
            <AccordionTrigger className="text-sm text-left">¿Cómo se calcula el "Diario Ideal"?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Es el presupuesto total dividido entre los días hábiles según el calendario elegido. Indica cuánto deberías gastar por día para terminar exactamente en el presupuesto aprobado.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger className="text-sm text-left">¿Por qué el gasto excluye hoy y ayer?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Las plataformas tardan hasta 48 horas en consolidar el gasto real. Excluir estos días evita mostrar datos parciales que distorsionan el pacing.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger className="text-sm text-left">¿Qué significa el umbral de ±10%?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Es la tolerancia entre el % de tiempo transcurrido y el % de presupuesto gastado. Por debajo de -10% subgastas; por encima de +10% sobregastas. Entre medias estás "En Ruta".
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger className="text-sm text-left">¿Cómo enlazo un correo a una cuenta?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Desde Administración, un administrador escoge el correo, la plataforma y el ID de cuenta. A partir de ese momento el usuario solo verá los datos de las cuentas asignadas.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q5">
            <AccordionTrigger className="text-sm text-left">¿Cómo recibo alertas?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              En la sección "Alertas" puedes ver el detalle de cada campaña con riesgo. Las notificaciones críticas se muestran con 🚨 en la tabla y con el indicador IA.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="border border-border rounded-lg bg-muted/30 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> haz clic sobre cualquier fila de la matriz para expandir gráficos, métricas (CPC, CTR, CPM) y generar un insight IA en segundos.
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
