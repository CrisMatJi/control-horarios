# Control de horarios

Panel para gestionar los turnos de un equipo que trabaja con **rotación de semanas** (p. ej. 6 semanas que se repiten).
La administración carga la rotación una vez, ajusta días sueltos y envía a cada empleado su horario del mes en PDF.
Cada empleado entra desde el móvil con un enlace a su email (sin contraseña) y solo ve su propio horario.

Coste: **0 €** (GitHub Pages + plan gratuito de Supabase + Gmail).

## Stack

| Pieza | Tecnología |
|---|---|
| Web | React 18 + Vite + TypeScript, `HashRouter`, publicada en GitHub Pages |
| Base de datos | Supabase Postgres con Row Level Security |
| Acceso | Supabase Auth: enlace mágico (empleados) y email/contraseña o Google (administración) |
| PDF | `pdf-lib`, el mismo código en el navegador y en el servidor |
| Emails | Edge Function `enviar-horarios` + SMTP de Gmail |
| Envío mensual | `pg_cron` el día 25 a las 07:00 UTC con el mes siguiente |
| Mantener activo | GitHub Action cada 3 días (el plan gratuito pausa tras 7 días sin uso) |

## Cómo funciona el horario

- `rotaciones`: número de semanas y una **semana de referencia** ("el lunes 19/10/2026 es la semana 2").
- `turnos_plantilla`: tramos por semana, día y empleado. Un turno partido son dos tramos.
- `excepciones`: lo que se sale de la plantilla. `LIBRE` (día eliminado), `CAMBIO` (otros tramos ese día), `VACACIONES`, `BAJA`.
  "Eliminar día" y "Vaciar mes" crean excepciones agrupadas en un `lote`, por eso se pueden deshacer.
- `horario(desde, hasta, empleado?)`: función SQL que calcula el horario real. Es `SECURITY INVOKER`, así que RLS decide qué ve cada uno.

## Seguridad

- Admin = fila en `admins` (vinculada a un usuario de Supabase Auth y a una empresa).
- Empleado = ficha en `empleados` cuyo email coincide con el de la sesión. Solo puede **leer** lo suyo.
- Cualquiera puede pedir un enlace mágico, pero si su email no está en `empleados` no ve nada.
- Las funciones auxiliares de las políticas viven en el esquema `privado`, que no expone la API.

## Puesta en marcha

### 1. Base de datos
Aplica en orden `supabase/migrations/*.sql` y después `supabase/seed.sql` (carga la rotación de Cerámica).
`20261020000400_envio_mensual.sql` guarda en Vault la URL del proyecto: cambia `REEMPLAZAR` por tu referencia.

Para regenerar el seed desde otro JSON: `npm run seed -- data/mi-rotacion.json "Mi empresa"`.

### 2. Usuario administrador
1. Supabase → **Authentication → Users → Add user** (email + contraseña, marca *Auto confirm*).
2. En el SQL Editor:
   ```sql
   insert into public.admins (user_id, empresa_id)
   select u.id, e.id from auth.users u, public.empresas e
   where u.email = 'TU-EMAIL' and e.nombre = 'DeMÁT';
   ```

### 3. Autenticación (Supabase → Authentication)
- **URL Configuration**: *Site URL* y *Redirect URLs* = `https://<usuario>.github.io/control-horarios/` (y `http://localhost:5173/` para desarrollo).
- **Emails → SMTP Settings**: activa SMTP propio con Gmail (`smtp.gmail.com`, puerto `465`, tu Gmail y una
  [contraseña de aplicación](https://myaccount.google.com/apppasswords)). El SMTP por defecto de Supabase solo envía a miembros del equipo.
- Opcional: **Sign In / Providers → Google** para que administración entre con Google.

### 4. Secretos de la Edge Function (Edge Functions → Secrets)
| Nombre | Valor |
|---|---|
| `SMTP_USER` | Tu Gmail |
| `SMTP_PASS` | Contraseña de aplicación de Gmail (16 letras) |
| `APP_URL` | `https://<usuario>.github.io/control-horarios` |
| `EMPRESA` | Opcional, por defecto `DeMÁT` |

### 5. GitHub Pages
Settings → Pages → **Source: GitHub Actions**. Cada push a `main` pasa los tests, compila y publica.
La URL y la clave pública de Supabase están en `.env.production` (son públicas por diseño; la seguridad la pone RLS).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # migraciones + RLS en Postgres embebido (PGlite) y PDF
npm run build
```

## Datos iniciales

`data/rotacion-ceramica.json` sale de la hoja "Horarios Departamento Cerámica" (6 semanas).
Las casillas con raya diagonal se han leído como medias horas y todos los días cuadran con la fila de totales.
Puntos a revisar: lista `revisar` dentro del JSON (EJ martes/jueves, EJ jueves de semanas pares, CY e YJ).
