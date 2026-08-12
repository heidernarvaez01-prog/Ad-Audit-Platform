# AuditApache — Alta prioridad (1-4)

Solo se extiende lo existente: no se toca el motor de 7 reglas (se agrega una octava por el mismo mecanismo), ni la vista de campaña con gráficos, ni el sistema de canales.

## Diagnóstico previo (ya verificado, sin cambios aplicados)

Revisé el código del sync y los datos reales en la base:

- **No hay bug de mapeo.** Cada campo de Windsor está asignado a su columna correcta: `actions_omni_purchase` → `purchases`, `action_values_omni_purchase` → `purchase_value`, `conversions` → `conversions`, `action_values_lead` → `lead_value`, y los dos ROAS a sus columnas.
- **La última ejecución del sync corrió bien** (12 ago, 03:00 UTC, 2.051 filas del 12 jul al 10 ago) y trajo los campos nuevos con datos reales: identificadores de campaña/anuncio, rankings de calidad, presupuesto diario, clics únicos.
- **Prueba de que los campos de conversión sí llegan:** `website_purchase_roas` viene con valor en 1.857 filas — pero siempre en 0. Y `landing_page_views` (que es un evento de acción igual que las compras) trae datos reales, 3.678 vistas. Es decir, el canal de acciones funciona; lo que no existe son eventos de compra.
- **La causa real:** las campañas de esta cuenta son solo de reconocimiento, interacción y tráfico (`OUTCOME_AWARENESS`, `OUTCOME_ENGAGEMENT`, `OUTCOME_TRAFFIC`). No hay ninguna campaña de ventas o de leads, así que Meta no reporta compras, valor de compra ni leads. Windsor devuelve esos campos vacíos porque en Meta están vacíos.

**Consecuencia para el plan:** una meta de ROAS o CPA no se puede evaluar hoy con estos datos. Por eso las metas de eficiencia se amplían para cubrir también los objetivos que sí tienen datos.

## 1. Metas de eficiencia por campaña

Nueva tabla `campaign_goals` (una fila por auditoría):

- `audit_record_id` (referencia a la auditoría), `user_id`
- `goal_type`: `cpa` | `roas` | `cpl` (requieren eventos de conversión) y además `cpc`, `cpm`, `ctr`, `costo_por_visita_a_pagina`, `costo_por_thruplay` (evaluables ya mismo con los datos actuales)
- `target_value` (numérico), `tolerance_pct` (por defecto 20)
- `enabled`

En el formulario de auditoría se agrega un bloque opcional "Meta de eficiencia": tipo de meta, valor objetivo y tolerancia. Los tipos que dependen de conversiones se muestran con la advertencia "esta cuenta aún no reporta eventos de conversión".

Nueva regla `EFFICIENCY_GOAL_MISS` añadida al motor existente (mismo archivo compartido, misma forma que las demás, con su entrada en `alert_rules` y en las etiquetas): calcula la métrica de la meta sobre la ventana consolidada y dispara cuando se desvía más allá de la tolerancia. Si el tipo de meta depende de conversiones y no hay datos, la regla no dispara nada y la UI muestra "sin datos de conversión" en lugar de un número falso. Se muestra en la tabla de auditoría, en Alertas y se entrega por los canales ya configurados.


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

1. Migración `campaign_goals` + regla nueva + campos en el formulario (el diagnóstico de conversiones ya está hecho: ver arriba).
2. Taxonomía de severidad unificada.
3. Página de resumen ejecutivo + envío por correo.
4. Verificación de entrega y reporte final.

Los puntos 5-9 (media y baja prioridad) quedan fuera de esta entrega y se planifican después.
