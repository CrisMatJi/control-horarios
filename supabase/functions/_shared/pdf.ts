// PDF mensual del horario de un empleado. Lo usan la web (botón "Descargar PDF")
// y la Edge Function de envío (adjunto del email).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  capital, diaSemana, diasDelMes, DIAS_LARGOS, duracion, esPartido, formatoHoras,
  isoDe, nombreMes, tramoBonito, type Tramo,
} from './horario.ts';

const ROJO = rgb(0.741, 0.118, 0.063);
const CARBON = rgb(0.137, 0.137, 0.122);
const GRIS = rgb(0.369, 0.373, 0.341);
const LINEA = rgb(0.894, 0.894, 0.871);
const FONDO_PARTIDO = rgb(0.984, 0.918, 0.91);
const FONDO_FINDE = rgb(0.957, 0.957, 0.945);

export type DatosPdf = {
  empresa: string;
  empleado: string;
  periodo: string; // 'YYYY-MM'
  dias: Map<string, Tramo[]>;
  logoPng?: Uint8Array;
};

export async function generarPdfHorario(datos: DatosPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Horario ${nombreMes(datos.periodo)} · ${datos.empleado}`);
  pdf.setAuthor(datos.empresa);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const M = 40;

  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: ROJO });

  let y = height - 50;
  if (datos.logoPng) {
    try {
      const logo = await pdf.embedPng(datos.logoPng);
      const w = 130;
      const h = (logo.height / logo.width) * w;
      page.drawImage(logo, { x: M, y: y - h + 12, width: w, height: h });
      y -= h + 4;
    } catch {
      /* logo opcional */
    }
  } else {
    page.drawText(datos.empresa, { x: M, y, size: 16, font: negrita, color: CARBON });
    y -= 22;
  }

  page.drawText('HORARIO MENSUAL', { x: M, y: y - 8, size: 9, font: negrita, color: ROJO });
  page.drawText(`${datos.empleado} · ${capital(nombreMes(datos.periodo))}`, { x: M, y: y - 28, size: 18, font: negrita, color: CARBON });
  y -= 52;

  const [yy, mm] = datos.periodo.split('-').map(Number);
  const n = diasDelMes(datos.periodo);
  let totalMin = 0;
  let diasTrabajo = 0;
  for (const t of datos.dias.values()) {
    totalMin += duracion(t);
    diasTrabajo++;
  }
  const resumen = `${diasTrabajo} días de trabajo · ${formatoHoras(totalMin)} en total`;
  page.drawText(resumen, { x: M, y, size: 10, font: regular, color: GRIS });
  y -= 18;

  const cols = [M, M + 95, M + 330, width - M - 70];
  const filaAlto = Math.min(20, (y - 60) / (n + 1));
  cabecera(page, negrita, cols, y, width - 2 * M, filaAlto);
  y -= filaAlto;

  for (let d = 1; d <= n; d++) {
    const iso = isoDe(yy, mm, d);
    const ds = diaSemana(iso);
    const tramos = datos.dias.get(iso) ?? [];
    const fondo = tramos.length && esPartido(tramos) ? FONDO_PARTIDO : ds >= 5 && !tramos.length ? FONDO_FINDE : undefined;
    if (fondo) page.drawRectangle({ x: M, y: y - filaAlto + 4, width: width - 2 * M, height: filaAlto, color: fondo });
    const base = y - filaAlto / 2 - 1;
    page.drawText(`${String(d).padStart(2, '0')} ${capital(DIAS_LARGOS[ds]).slice(0, 3)}`, { x: cols[0] + 6, y: base, size: 10, font: negrita, color: CARBON });
    page.drawText(tramos.length ? tramos.map(tramoBonito).join('   ·   ') : 'Libre', { x: cols[1], y: base, size: 10, font: regular, color: tramos.length ? CARBON : GRIS });
    if (tramos.length) {
      page.drawText(esPartido(tramos) ? 'Partido' : 'Continuo', { x: cols[2], y: base, size: 9, font: regular, color: esPartido(tramos) ? ROJO : GRIS });
      page.drawText(formatoHoras(duracion(tramos)), { x: cols[3], y: base, size: 10, font: regular, color: CARBON });
    }
    page.drawLine({ start: { x: M, y: y - filaAlto + 4 }, end: { x: width - M, y: y - filaAlto + 4 }, thickness: 0.5, color: LINEA });
    y -= filaAlto;
  }

  page.drawText(`Generado el ${new Date().toLocaleDateString('es-ES')} · ${datos.empresa}`, { x: M, y: 28, size: 8, font: regular, color: GRIS });
  return await pdf.save();
}

function cabecera(page: PDFPage, font: PDFFont, cols: number[], y: number, ancho: number, alto: number) {
  page.drawRectangle({ x: cols[0], y: y - alto + 4, width: ancho, height: alto, color: CARBON });
  const base = y - alto / 2 - 1;
  const t = (s: string, x: number) => page.drawText(s, { x, y: base, size: 9, font, color: rgb(1, 1, 1) });
  t('DÍA', cols[0] + 6);
  t('HORARIO', cols[1]);
  t('TIPO', cols[2]);
  t('HORAS', cols[3]);
}
