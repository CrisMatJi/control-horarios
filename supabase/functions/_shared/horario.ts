// Utilidades de fechas y turnos compartidas por la web (Vite) y las Edge Functions (Deno).
// Sin dependencias: solo cadenas 'YYYY-MM-DD' y 'HH:MM' para evitar problemas de zona horaria.

export type Tramo = { inicio: string; fin: string };
export type FilaHorario = { fecha: string; empleado_id: string; inicio: string; fin: string; origen: string };

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const pad = (n: number) => String(n).padStart(2, '0');

export const isoDe = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function hoyISO(): string {
  const d = new Date();
  return isoDe(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function partes(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** 0 = lunes … 6 = domingo */
export function diaSemana(iso: string): number {
  const { y, m, d } = partes(iso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function sumarDias(iso: string, n: number): string {
  const { y, m, d } = partes(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoDe(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function diasDelMes(periodo: string): number {
  const [y, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function rangoMes(periodo: string): { desde: string; hasta: string } {
  return { desde: `${periodo}-01`, hasta: `${periodo}-${pad(diasDelMes(periodo))}` };
}

export function periodoDe(iso: string): string {
  return iso.slice(0, 7);
}

export function moverPeriodo(periodo: string, delta: number): string {
  const [y, m] = periodo.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

export function nombreMes(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** '09:30:00' → '09:30' */
export const hhmm = (t: string) => t.slice(0, 5);

export const minutos = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** '09:30' → '9:30' */
export const horaBonita = (t: string) => hhmm(t).replace(/^0/, '');

export const tramoBonito = (t: Tramo) => `${horaBonita(t.inicio)}–${horaBonita(t.fin)}`;

export const duracion = (tramos: Tramo[]) => tramos.reduce((s, t) => s + minutos(t.fin) - minutos(t.inicio), 0);

export function formatoHoras(min: number): string {
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Partido = dos o más tramos separados */
export const esPartido = (tramos: Tramo[]) => tramos.length > 1;

/** Agrupa las filas de `horario()` por fecha */
export function porFecha(filas: FilaHorario[]): Map<string, Tramo[]> {
  const m = new Map<string, Tramo[]>();
  for (const f of filas) {
    const arr = m.get(f.fecha) ?? [];
    arr.push({ inicio: hhmm(f.inicio), fin: hhmm(f.fin) });
    m.set(f.fecha, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
  return m;
}
