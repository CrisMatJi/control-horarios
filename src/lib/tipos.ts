export type Empleado = {
  id: string;
  departamento_id: string;
  codigo: string;
  nombre: string;
  apellidos: string;
  email: string | null;
  movil: string | null;
  activo: boolean;
};

export type Excepcion = {
  id: string;
  empleado_id: string;
  fecha: string;
  tipo: 'LIBRE' | 'CAMBIO' | 'VACACIONES' | 'BAJA';
  inicio: string | null;
  fin: string | null;
  lote: string | null;
};

export type Rotacion = {
  id: string;
  departamento_id: string;
  nombre: string;
  semanas: number;
  ancla_lunes: string;
  ancla_semana: number;
};

export type TurnoPlantilla = {
  id: string;
  empleado_id: string;
  semana: number;
  dia_semana: number;
  inicio: string;
  fin: string;
};

export type Envio = {
  id: string;
  empleado_id: string;
  periodo: string;
  estado: 'ENVIADO' | 'ERROR' | 'SIN_EMAIL';
  detalle: string | null;
  created_at: string;
};

export const nombreCompleto = (e: Pick<Empleado, 'nombre' | 'apellidos'>) => `${e.nombre} ${e.apellidos}`.trim();
export const iniciales = (e: Pick<Empleado, 'nombre' | 'apellidos' | 'codigo'>) =>
  e.apellidos ? `${e.nombre[0] ?? ''}${e.apellidos[0] ?? ''}`.toUpperCase() : e.codigo.slice(0, 2).toUpperCase();
