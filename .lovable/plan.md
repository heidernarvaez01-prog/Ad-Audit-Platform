
# Envío de alertas con Resend

Sustituimos Lovable Emails por Resend para evitar la dependencia de registros NS. Tu proveedor de DNS solo necesitará TXT + CNAME + MX (todos los proveedores lo soportan) o, si lo prefieres, podemos arrancar con el dominio compartido `onboarding@resend.dev` para pruebas inmediatas.

## 1. Conectar Resend

- Vinculo el conector estándar de Resend en este workspace (te pedirá pegar tu API key una vez en el diálogo).
- Esto inyecta `RESEND_API_KEY` como secreto del backend, accesible desde edge functions vía el gateway de Lovable. No se guarda en código.

## 2. Nueva edge function `send-alert-email`

Creo `supabase/functions/send-alert-email/index.ts` que:

- Valida JWT del usuario (auth requerida).
- Recibe `{ to, subject, alerts }` con validación Zod.
- Renderiza un HTML simple inline (mismo estilo que la plantilla actual `active-alerts`: encabezado, contadores de críticas/advertencias, lista de campañas con gasto/presupuesto/%tiempo/%gasto).
- Llama al gateway de Resend:
  ```
  POST https://connector-gateway.lovable.dev/resend/emails
  Headers: Authorization: Bearer LOVABLE_API_KEY, X-Connection-Api-Key: RESEND_API_KEY
  Body: { from, to, subject, html }
  ```
- Devuelve `{ success, id }` o error con status del gateway.

`from` por defecto: `Apache Studio Ad Audit <alertas@apachestudio.mx>` una vez verifiques el dominio en Resend. Mientras tanto uso `onboarding@resend.dev` para que puedas probar hoy mismo.

CORS estándar incluido. Sin cambios a `supabase/config.toml` (deploy automático con verify_jwt=false por defecto + validación en código).

## 3. Frontend: disparar alertas desde la app

- En `AlertsPage` agrego un botón **"Enviar alertas por correo"** que:
  - Toma las alertas críticas y de advertencia ya calculadas en pantalla.
  - Lee el email del usuario logueado (`useAuth`) como destinatario por defecto, con input editable para enviar a otro correo.
  - Invoca `supabase.functions.invoke('send-alert-email', { body: {...} })`.
  - Muestra toast de éxito/error.
- No tocamos `audit_records` ni la lógica de cálculo de pacing.

## 4. Limpieza opcional (no destructiva)

- Dejo el sistema de Lovable Emails (`send-transactional-email`, plantillas, cron) intacto por si más adelante quieres reactivarlo. Solo dejará de usarse.
- No se elimina el dominio `audit.apachestudio.mx` en Lovable; puedes ignorarlo o borrarlo después manualmente en Cloud → Emails.

## 5. Verificar dominio en Resend (recomendado, opcional)

Cuando quieras que el remitente sea `@apachestudio.mx` en lugar de `@resend.dev`:

1. En el dashboard de Resend → Domains → Add `apachestudio.mx` (o el subdominio que prefieras).
2. Tu proveedor de DNS solo te pedirá: 1 TXT (verificación), 1 TXT (SPF), 1-3 CNAME (DKIM) y opcional 1 MX (return-path). **Sin NS.**
3. Una vez verificado, actualizo el `from` en la edge function.

Esto lo puedes hacer hoy o más tarde; el envío funciona desde el paso 2 con el dominio compartido.

## Entregables

- Conector Resend vinculado (secreto `RESEND_API_KEY` disponible).
- `supabase/functions/send-alert-email/index.ts` nueva.
- Botón + flujo de envío en `src/pages/AlertsPage.tsx`.
- Sin migraciones SQL, sin cambios de DNS para empezar.
