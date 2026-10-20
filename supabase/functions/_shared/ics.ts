// Calendario .ics (RFC 5545) con un evento por tramo de trabajo.
// Lo usan la web (botón "Añadir a mi calendario") y el email mensual (adjunto).
// UID estable por empleado/fecha/hora: al importar de nuevo, los calendarios que lo
// soportan (Google, Outlook) actualizan el evento en vez de duplicarlo.
import { semanaRotacion, type RefRotacion, type Tramo } from './horario.ts';

const TZ = 'Europe/Madrid';

// Definición de la zona horaria para que el móvil no dependa de su configuración
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZ}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Pliega líneas a 75 octetos como pide el estándar */
function plegar(linea: string): string {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;
  const partes: string[] = [];
  let actual = '';
  let tam = 0;
  for (const ch of linea) {
    const n = new TextEncoder().encode(ch).length;
    if (tam + n > (partes.length ? 74 : 75)) {
      partes.push(actual);
      actual = '';
      tam = 0;
    }
    actual += ch;
    tam += n;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}

const fechaHora = (iso: string, hhmm: string) => `${iso.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;

export type DatosIcs = {
  empresa: string;
  empleadoId: string;
  empleado: string;
  dias: Map<string, Tramo[]>;
  /** Texto para el título de cada evento (por defecto "Trabajo · <empresa>") */
  titulo?: string;
  /** Aviso antes de cada turno, en minutos (0 = sin aviso) */
  avisoMin?: number;
  /** Para suscripciones: cada cuánto debe refrescar el calendario (p. ej. 'PT6H') */
  refresco?: string;
  /** Si se pasa, la descripción indica la semana de la rotación */
  rotacion?: RefRotacion | null;
};

export function generarIcs(d: DatosIcs): string {
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const titulo = d.titulo ?? `Trabajo · ${d.empresa}`;
  const aviso = d.avisoMin ?? 60;
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Control de horarios//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(`Horario ${d.empresa}`)}`,
    `X-WR-TIMEZONE:${TZ}`,
    ...(d.refresco ? [`REFRESH-INTERVAL;VALUE=DURATION:${d.refresco}`, `X-PUBLISHED-TTL:${d.refresco}`] : []),
    ...VTIMEZONE,
  ];
  const fechas = [...d.dias.keys()].sort();
  for (const fecha of fechas) {
    const tramos = d.dias.get(fecha)!;
    tramos.forEach((t, i) => {
      const parte = tramos.length > 1 ? (i === 0 ? ' (mañana)' : ' (tarde)') : '';
      lineas.push(
        'BEGIN:VEVENT',
        `UID:${d.empleadoId}-${fecha}-${t.inicio.replace(':', '')}@control-horarios`,
        `DTSTAMP:${ahora}`,
        `DTSTART;TZID=${TZ}:${fechaHora(fecha, t.inicio)}`,
        `DTEND;TZID=${TZ}:${fechaHora(fecha, t.fin)}`,
        `SUMMARY:${escapar(titulo + (d.rotacion ? ` · Semana ${semanaRotacion(d.rotacion, fecha)}` : '') + parte)}`,
        `DESCRIPTION:${escapar(`Turno de ${d.empleado}: ${t.inicio}–${t.fin}${d.rotacion ? ` · Semana ${semanaRotacion(d.rotacion, fecha)} de la rotación` : ''}`)}`,
        'TRANSP:OPAQUE',
        'STATUS:CONFIRMED',
      );
      if (aviso > 0) {
        lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(titulo)}`, `TRIGGER:-PT${aviso}M`, 'END:VALARM');
      }
      lineas.push('END:VEVENT');
    });
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}
