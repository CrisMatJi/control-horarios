// Envía a cada empleado su horario del mes en PDF + enlace para verlo en el móvil.
// Lo llaman: la web (un admin, con su sesión) o pg_cron (cabecera x-cron-token).
// Body: { "periodo": "2026-11", "empleado_id"?: uuid }
import { createClient } from '@supabase/supabase-js';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { generarPdfHorario } from '../_shared/pdf.ts';
import { capital, duracion, formatoHoras, nombreMes, porFecha, rangoMes, type FilaHorario } from '../_shared/horario.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const env = (k: string, def?: string) => {
  const v = Deno.env.get(k) ?? def;
  if (v === undefined) throw new Error(`Falta el secreto ${k}`);
  return v;
};

Deno.serve((req) => manejar(req).catch((e) => json({ error: (e as Error).message }, 500)));

async function manejar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = env('SUPABASE_URL');
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  // ── Autorización ──
  const cron = req.headers.get('x-cron-token');
  if (cron) {
    const { data: ok } = await admin.rpc('validar_token_cron', { p_token: cron });
    if (!ok) return json({ error: 'Token de cron no válido' }, 401);
  } else {
    const auth = req.headers.get('Authorization') ?? '';
    const usuario = createClient(url, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: esAdmin, error } = await usuario.rpc('es_admin');
    if (error || !esAdmin) return json({ error: 'Solo administración puede enviar horarios' }, 403);
  }

  let body: { periodo?: string; empleado_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  const periodo = body.periodo ?? '';
  if (!/^\d{4}-\d{2}$/.test(periodo)) return json({ error: 'periodo debe ser AAAA-MM' }, 400);

  // ── Datos ──
  let q = admin.from('empleados').select('id, nombre, apellidos, email, token_calendario, departamento_id').eq('activo', true);
  if (body.empleado_id) q = q.eq('id', body.empleado_id);
  const { data: empleados, error: errEmp } = await q;
  if (errEmp) return json({ error: errEmp.message }, 500);

  const { data: rots } = await admin.from('rotaciones').select('departamento_id, semanas, ancla_lunes, ancla_semana').eq('activa', true);
  const rotacionDe = new Map((rots ?? []).map((r) => [r.departamento_id, r]));

  const { desde, hasta } = rangoMes(periodo);
  const { data: filas, error: errH } = await admin.rpc('horario', { p_desde: desde, p_hasta: hasta, p_empleado: body.empleado_id ?? null });
  if (errH) return json({ error: errH.message }, 500);
  const porEmpleado = new Map<string, FilaHorario[]>();
  for (const f of (filas ?? []) as FilaHorario[]) porEmpleado.set(f.empleado_id, [...(porEmpleado.get(f.empleado_id) ?? []), f]);

  const appUrl = env('APP_URL').replace(/\/$/, '');
  const empresa = env('EMPRESA', 'DeMÁT');
  let logo: Uint8Array | undefined;
  try { logo = new Uint8Array(await (await fetch(`${appUrl}/logo.png`)).arrayBuffer()); } catch { /* opcional */ }

  const smtp = new SMTPClient({
    connection: {
      hostname: env('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(env('SMTP_PORT', '465')),
      tls: true,
      auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') },
    },
  });
  const remitente = `${env('SMTP_FROM_NAME', `${empresa} · Horarios`)} <${env('SMTP_USER')}>`;

  const res = { enviados: 0, errores: 0, sinEmail: 0, sinTurnos: 0 };
  const registro: { empleado_id: string; periodo: string; estado: string; detalle: string | null }[] = [];

  for (const e of empleados ?? []) {
    const nombre = `${e.nombre} ${e.apellidos}`.trim();
    const filasEmp = porEmpleado.get(e.id) ?? [];
    if (!filasEmp.length) { res.sinTurnos++; continue; }
    if (!e.email) { res.sinEmail++; registro.push({ empleado_id: e.id, periodo, estado: 'SIN_EMAIL', detalle: null }); continue; }
    try {
      const dias = porFecha(filasEmp);
      const totalMin = [...dias.values()].reduce((s, t) => s + duracion(t), 0);
      const pdf = await generarPdfHorario({ empresa, empleado: nombre, periodo, dias, logoPng: logo, rotacion: rotacionDe.get(e.departamento_id) });
      const enlace = `${appUrl}/#/acceso?email=${encodeURIComponent(e.email)}`;
      const enlaceCal = `${appUrl}/#/calendario?t=${e.token_calendario}`;
      const mes = nombreMes(periodo);
      await smtp.send({
        from: remitente,
        to: e.email,
        subject: `Tu horario de ${mes}`,
        content: `Hola ${e.nombre}:\n\nTe adjuntamos tu horario de ${mes}: ${dias.size} días de trabajo y ${formatoHoras(totalMin)} en total.\n\nPara tener los turnos en el calendario del móvil (se actualizan solos): ${enlaceCal}\n\nTambién puedes verlo en el móvil cuando quieras: ${enlace}\n\n${empresa}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#23231F">
  <div style="height:4px;background:#BD1E10"></div>
  <div style="padding:24px">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#BD1E10;font-weight:bold;margin:0 0 6px">Horario mensual</p>
    <h1 style="font-size:22px;margin:0 0 16px">${esc(capital(mes))}</h1>
    <p style="font-size:15px;line-height:1.55">Hola ${esc(e.nombre)}, ya tienes tu horario de <strong>${esc(mes)}</strong>: ${dias.size} días de trabajo y ${esc(formatoHoras(totalMin))} en total. Va adjunto en PDF.</p>
    <div style="background:#F4F4F1;border-radius:8px;padding:16px;font-size:14px;line-height:1.55;margin:16px 0">
      <strong>Tus turnos en el calendario del móvil</strong><br>
      Suscríbete una vez y se actualizarán solos cada mes, con aviso una hora antes de cada turno.
      <p style="margin:12px 0 4px"><a href="${enlaceCal}" style="background:#23231F;color:#fff;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:6px;display:inline-block">Añadir a mi calendario</a></p>
    </div>
    <p style="margin:24px 0"><a href="${enlace}" style="background:#BD1E10;color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:6px;display:inline-block">Ver mi horario en el móvil</a></p>
    <p style="font-size:13px;color:#5E5F57;line-height:1.5">Entra siempre con este email: te mandaremos un enlace de acceso, sin contraseñas.</p>
    <p style="font-size:13px;color:#5E5F57">${esc(empresa)}</p>
  </div>
</div>`,
        attachments: [
          { filename: `Horario ${mes} - ${nombre}.pdf`, content: pdf, encoding: 'binary', contentType: 'application/pdf' },
        ],
      });
      res.enviados++;
      registro.push({ empleado_id: e.id, periodo, estado: 'ENVIADO', detalle: e.email });
    } catch (err) {
      res.errores++;
      registro.push({ empleado_id: e.id, periodo, estado: 'ERROR', detalle: String((err as Error).message ?? err).slice(0, 300) });
    }
  }
  try { await smtp.close(); } catch { /* ya cerrado */ }
  if (registro.length) await admin.from('envios').insert(registro);
  return json(res);
}
