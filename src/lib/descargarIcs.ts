import { generarIcs } from '../../supabase/functions/_shared/ics.ts';
import { nombreMes, type RefRotacion, type Tramo } from '../../supabase/functions/_shared/horario.ts';
import { EMPRESA } from './supabase';

const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Genera el .ics del mes y lo abre: en iPhone sale "Añadir todo" al calendario; en el resto se descarga */
export function descargarIcs(empleadoId: string, empleado: string, periodo: string, dias: Map<string, Tramo[]>, rotacion?: RefRotacion | null) {
  const ics = generarIcs({ empresa: EMPRESA, empleadoId, empleado, dias, rotacion });
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  if (esIOS()) {
    window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Turnos ${nombreMes(periodo)}.ics`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
