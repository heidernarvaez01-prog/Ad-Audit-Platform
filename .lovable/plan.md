# AuditApache — Alta prioridad (1-4)

Solo se extiende lo existente: no se toca el motor de 7 reglas (se agrega una octava por el mismo mecanismo), ni la vista de campaña con gráficos, ni el sistema de canales.

## 1. Metas de eficiencia por campaña

Nueva tabla `campaign_goals` (una fila por auditoría):

- `audit_record_id` (referencia a la auditoría), `user_id`
- `goal_type`: `cpa` | `roas` | `cpl`
- `target_value` (numérico), `tolerance_pct` (por defecto 20)
- `enabled`

En el formulario de auditoría se agrega un bloque opcional "Meta de eficiencia": tipo de meta, valor objetivo y tolerancia.

Nueva regla `EFFICIENCY_GOAL_MISS` añadida al motor existente (mismo archivo compartido, misma forma que las demás, con su entrada en `alert_rules` y en las etiquetas): calcula CPA = gasto / conversiones, ROAS = valor de compra / gasto, CPL = gasto / leads sobre la ventana consolidada, y dispara cuando se desvía de la meta más allá de la tolerancia. Se muestra en la tabla de auditoría, en Alertas y se entrega por los canales ya configurados.

**Punto crítico verificado:** hoy en la base de datos las columnas de conversión (`purchases`, `purchase_value`, `conversions`) están **vacías en las 4.102 filas** de métricas, aunque el sync sí pide esos campos a Windsor. Sin esos datos la regla no puede evaluar CPA/ROAS reales. Por eso el primer paso de este punto es diagnosticar el sync (respuesta real de Windsor para la cuenta) y, si la cuenta no tiene conversiones configuradas, dejar la regla activa pero silenciada con un aviso "sin datos de conversión" en vez de mostrar valores falsos.

## 2. Resumen ejecutivo consolidado

Nueva página `/resumen`: una sola pantalla con todos los clientes de la agencia.

- Calcula alertas de todas las campañas de todos los clientes (reutiliza la misma lógica que ya usa Alertas).
- Estima el impacto en dinero de cada hallazgo: sobregasto proyectado al cierre, presupuesto en riesgo de no ejecutarse, sobrecosto por pico de CPC/CPM, brecha contra la meta de eficiencia.
- Muestra los 3-5 problemas más urgentes y 2-3 oportunidades de optimización, ordenados por ese impacto, cada uno con cliente, campaña y acción sugerida.
- Botón "Enviar por correo" que manda el mismo resumen con la infraestructura de correo existente, más un cron semanal opcional.

Sin tablas nuevas: se calcula al vuelo. Solo se guarda el registro del envío en el log de correo que ya existe.

## 3. Taxonomía de severidad unificada

Hoy conviven dos vocabularios: el motor usa `danger` / `warning` / `info`, los insights de IA usan `critical` / `warning` / `info`, y la UI mezcla "Críticas / Advertencias / Atención / Saludables" con colores distintos según la pantalla.

Se define una única escala **Crítica / Advertencia / Atención / Saludable** en un módulo compartido (etiqueta, color, icono y orden), y se aplica en el dashboard de clientes, la tabla de auditoría, el detalle de campaña, la página de Alertas y las plantillas de correo. Los valores en base de datos se mantienen y se normalizan al mostrarlos: sin migración de datos.

## 4. Verificación de entrega punta a punta

- Envío de prueba real por correo y a un webhook de Slack, revisando la respuesta del proveedor y el log de envíos.
- Revisión de los logs de las funciones de alertas y de la cola de correo, incluyendo rebotes o direcciones suprimidas.
- Confirmación de que el cron diario de alertas se está ejecutando.
- Se reporta el resultado con evidencia; si algo falla, se corrige la configuración (no se reescribe el sistema de canales).

## Cambios de esquema (resumen)

| Cambio | Detalle |
|---|---|
| Nueva tabla `campaign_goals` | Meta por auditoría, con acceso restringido al dueño y a admin |
| Nueva fila de regla | `EFFICIENCY_GOAL_MISS` en `alert_rules`, con umbral configurable |
| Sin cambios | Severidades, resumen ejecutivo y verificación de envíos no requieren migración |

## Orden de trabajo

1. Diagnóstico de datos de conversión (bloquea la regla de eficiencia).
2. Migración `campaign_goals` + regla nueva + campos en el formulario.
3. Taxonomía de severidad unificada.
4. Página de resumen ejecutivo + envío por correo.
5. Verificación de entrega y reporte final.

Los puntos 5-9 (media y baja prioridad) quedan fuera de esta entrega y se planifican después.
