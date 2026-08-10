# Documento técnico para Claude: CLAUDE.md

Generar un archivo markdown en la raíz del proyecto (`CLAUDE.md`) que sirva como contexto completo de la plataforma para trabajar con Claude: qué es, cómo se estructura, cómo funciona técnicamente, cómo se usa y qué mejorar — con foco especial en autenticación y en la integración automática de datos de las plataformas publicitarias de los clientes.

## Contenido del documento

1. **Contexto y propósito** — herramienta operativa de auditoría de presupuesto y pacing publicitario (no dashboard), clientes de Apache Studio, usuarios internos.
2. **Stack y arquitectura** — React 18 + Vite + TS + Tailwind + shadcn, backend Lovable Cloud (Postgres, Auth, Edge Functions, cron), Resend para correo, OpenAI para IA.
3. **Mapa de la aplicación** — cada ruta/página con su función: Auditoría Meta, Detalle de auditoría, Clientes, Brief, Alertas, Análisis IA, Reporting/Weekly, Cluster, Mis tareas, Cómo funciona, Admin, Auth, Unsubscribe.
4. **Modelo de datos** — todas las tablas (audit_records, audit_clients, brand_briefs, campaign_tracking, meta_datos, alert_settings/alert_events, account_assignments, user_roles, weekly_reports, cluster_runs, tablas de email), relaciones, enums y política RLS por `auth.uid()`.
5. **Lógica de negocio clave** — días hábiles, presupuesto ideal diario, umbral de pacing ±10%, corte dinámico de métricas por rango de fechas, motor de alertas dual (tiempo vs gasto).
6. **Edge Functions** — inventario de las 14 funciones, qué hace cada una, verify_jwt, secretos que consumen y crons (Windsor 3 AM, cola de correo cada 5s).
7. **Ingesta de datos** — flujo actual Windsor.ai → `sync-meta-datos` → `meta_datos` → `src/lib/api.ts`, con el mapeo de campos y sus limitaciones (una sola cuenta fija, `last_30d`, solo Meta).
8. **Autenticación y roles** — flujo actual de `useAuth`, `AuthPage` (invite/recovery: token_hash, PKCE, hash legacy), `RequireAuth`, `admin-users` y RBAC vía `user_roles` + `has_role`, asignación de cuentas.
9. **Cómo se usa** — recorrido paso a paso: invitar usuario → asignar cuenta y rol → crear cliente → registrar auditoría → revisar pacing → configurar alertas → reporte semanal.
10. **Puntos a mejorar (priorizados)** — con impacto y esfuerzo estimados. Incluye:
    - **Auth**: Google sign-in, página `/reset-password` dedicada, verificación de sesión con `getUser()` en rutas sensibles, expiración/reenvío de invitaciones, protección contra contraseñas filtradas, MFA para admins, auditoría de accesos.
    - **Datos**: parametrizar Windsor por cliente/cuenta en vez de la cuenta fija, soportar Google Ads / TikTok / LinkedIn, ventana histórica configurable en lugar de `last_30d`, upsert idempotente con clave natural, tabla de estado de sincronización y reintentos, alerta cuando una fuente falla.
11. **Convenciones y advertencias** — archivos auto-generados que no se tocan, patrón de tokens semánticos de color, dónde va cada tipo de lógica.
12. **Glosario** de términos del dominio (pacing, lab days, share of spend, brief).

## Detalles técnicos

- Se escribe un único archivo `CLAUDE.md` en la raíz. No se modifica código de la aplicación.
- El contenido se deriva de una lectura real del código: rutas en `src/App.tsx`, páginas, `src/lib/*`, `supabase/functions/*`, `supabase/config.toml` y el esquema actual de la base de datos.
- Extensión estimada: 400-600 líneas, en español, con tablas markdown para el inventario de rutas, tablas y funciones.
