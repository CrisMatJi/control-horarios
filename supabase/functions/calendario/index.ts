// Calendario de suscripción (webcal) de un empleado: GET /functions/v1/calendario?t=<token>
// Devuelve sus turnos desde el mes anterior hasta dos meses vista. El móvil lo vuelve a pedir
// cada pocas horas, así que los cambios de horario llegan solos.
import { createClient } from '@supabase/supabase-js';
import { generarIcs } from '../_shared/ics.ts';
import { moverPeriodo, periodoDe, porFecha, rangoMes, hoyISO, type FilaHorario } from '../_shared/horario.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método no permitido', { status: 405 });
  const token = new URL(req.url).searchParams.get('t') ?? '';
  if (!UUID.test(token)) return new Response('Enlace no válido', { status: 404 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: emp } = await admin.from('empleados').select('id, nombre, apellidos, departamento_id').eq('token_calendario', token).eq('activo', true).maybeSingle();
  if (!emp) return new Response('Enlace no válido', { status: 404 });

  const actual = periodoDe(hoyISO());
  const desde = rangoMes(moverPeriodo(actual, -1)).desde;
  const hasta = rangoMes(moverPeriodo(actual, 2)).hasta;
  const { data: filas, error } = await admin.rpc('horario', { p_desde: desde, p_hasta: hasta, p_empleado: emp.id });
  if (error) return new Response('Error al calcular el horario', { status: 500 });

  const { data: rotacion } = await admin.from('rotaciones').select('semanas, ancla_lunes, ancla_semana').eq('departamento_id', emp.departamento_id).eq('activa', true).maybeSingle();
  const empresa = Deno.env.get('EMPRESA') ?? 'DeMÁT';
  const ics = generarIcs({
    empresa,
    empleadoId: emp.id,
    empleado: `${emp.nombre} ${emp.apellidos}`.trim(),
    dias: porFecha((filas ?? []) as FilaHorario[]),
    refresco: 'PT6H',
    rotacion,
  });
  return new Response(req.method === 'HEAD' ? null : ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="turnos.ics"',
      'Cache-Control': 'private, max-age=900',
    },
  });
});
