import { supabase } from './supabase';
import type { Empleado, Envio, Excepcion, Rotacion, TurnoPlantilla } from './tipos';
import type { FilaHorario } from '../../supabase/functions/_shared/horario.ts';

function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const api = {
  async empleados(): Promise<Empleado[]> {
    return ok(await supabase.from('empleados').select('*').order('activo', { ascending: false }).order('nombre'));
  },
  async miEmpleado(): Promise<Empleado | null> {
    const r = await supabase.from('empleados').select('*').limit(1).maybeSingle();
    return ok(r);
  },
  async guardarEmpleado(e: Partial<Empleado> & { departamento_id: string }): Promise<Empleado> {
    if (e.id) {
      const { id, ...resto } = e;
      return ok(await supabase.from('empleados').update(resto).eq('id', id).select().single()) as Empleado;
    }
    return ok(await supabase.from('empleados').insert(e).select().single()) as Empleado;
  },
  async borrarEmpleado(id: string) {
    ok(await supabase.from('empleados').delete().eq('id', id));
  },
  async departamento(): Promise<{ id: string; nombre: string } | null> {
    return ok(await supabase.from('departamentos').select('id, nombre').order('created_at').limit(1).maybeSingle());
  },
  async horario(desde: string, hasta: string, empleadoId?: string): Promise<FilaHorario[]> {
    return ok(await supabase.rpc('horario', { p_desde: desde, p_hasta: hasta, p_empleado: empleadoId ?? null }));
  },
  async excepciones(empleadoId: string, desde: string, hasta: string): Promise<Excepcion[]> {
    return ok(await supabase.from('excepciones').select('*').eq('empleado_id', empleadoId).gte('fecha', desde).lte('fecha', hasta));
  },
  async anularDias(empleadoId: string, fechas: string[]): Promise<string> {
    const lote = crypto.randomUUID();
    if (fechas.length) ok(await supabase.from('excepciones').insert(fechas.map((fecha) => ({ empleado_id: empleadoId, fecha, tipo: 'LIBRE', lote }))));
    return lote;
  },
  async deshacerLote(lote: string) {
    ok(await supabase.from('excepciones').delete().eq('lote', lote));
  },
  async restaurarDia(empleadoId: string, fecha: string) {
    ok(await supabase.from('excepciones').delete().eq('empleado_id', empleadoId).eq('fecha', fecha));
  },
  async rotacionActiva(): Promise<Rotacion | null> {
    return ok(await supabase.from('rotaciones').select('*').eq('activa', true).limit(1).maybeSingle());
  },
  async turnosPlantilla(rotacionId: string): Promise<TurnoPlantilla[]> {
    return ok(await supabase.from('turnos_plantilla').select('*').eq('rotacion_id', rotacionId));
  },
  async guardarRotacion(args: { departamento: string; nombre: string; semanas: number; anclaLunes: string; anclaSemana: number; turnos: unknown[] }) {
    return ok(await supabase.rpc('guardar_rotacion', {
      p_departamento: args.departamento, p_nombre: args.nombre, p_semanas: args.semanas,
      p_ancla_lunes: args.anclaLunes, p_ancla_semana: args.anclaSemana, p_turnos: args.turnos,
    }));
  },
  async envios(): Promise<Envio[]> {
    return ok(await supabase.from('envios').select('*').order('created_at', { ascending: false }).limit(200));
  },
  async enviarHorarios(periodo: string, empleadoId?: string): Promise<{ enviados: number; errores: number; sinEmail: number }> {
    const { data, error } = await supabase.functions.invoke('enviar-horarios', { body: { periodo, empleado_id: empleadoId } });
    if (error) throw new Error(error.message);
    return data;
  },
};
