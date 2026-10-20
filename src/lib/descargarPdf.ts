import { nombreMes, type RefRotacion, type Tramo } from '../../supabase/functions/_shared/horario.ts';
import { EMPRESA } from './supabase';

let logo: Uint8Array | undefined;

export async function descargarPdf(empleado: string, periodo: string, dias: Map<string, Tramo[]>, rotacion?: RefRotacion | null) {
  if (!logo) {
    try {
      logo = new Uint8Array(await (await fetch(`${import.meta.env.BASE_URL}logo.png`)).arrayBuffer());
    } catch {
      logo = undefined;
    }
  }
  // pdf-lib solo se descarga cuando alguien pide el PDF
  const { generarPdfHorario } = await import('../../supabase/functions/_shared/pdf.ts');
  const bytes = await generarPdfHorario({ empresa: EMPRESA, empleado, periodo, dias, logoPng: logo, rotacion });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Horario ${nombreMes(periodo)} - ${empleado}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
