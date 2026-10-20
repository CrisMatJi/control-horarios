import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { diaSemana, diasDelMes, duracion, formatoHoras, moverPeriodo, porFecha, sumarDias } from '../supabase/functions/_shared/horario.ts';
import { generarPdfHorario } from '../supabase/functions/_shared/pdf.ts';

describe('utilidades de fechas', () => {
  it('día de la semana con lunes = 0', () => {
    expect(diaSemana('2026-10-19')).toBe(0);
    expect(diaSemana('2026-10-25')).toBe(6);
  });
  it('meses y cambios de año', () => {
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2028-02')).toBe(29);
    expect(moverPeriodo('2026-12', 1)).toBe('2027-01');
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('duración con medias horas', () => {
    expect(formatoHoras(duracion([{ inicio: '10:30', fin: '14:00' }, { inicio: '16:30', fin: '20:00' }]))).toBe('7 h');
    expect(formatoHoras(duracion([{ inicio: '09:30', fin: '14:00' }]))).toBe('4 h 30 min');
  });
});

describe('PDF', () => {
  it('genera un PDF con logo y el mes completo', async () => {
    const dias = porFecha([
      { fecha: '2026-11-02', empleado_id: 'x', inicio: '10:00:00', fin: '14:00:00', origen: 'PLANTILLA' },
      { fecha: '2026-11-02', empleado_id: 'x', inicio: '15:00:00', fin: '20:00:00', origen: 'PLANTILLA' },
      { fecha: '2026-11-03', empleado_id: 'x', inicio: '08:00:00', fin: '15:00:00', origen: 'PLANTILLA' },
    ]);
    const bytes = await generarPdfHorario({ empresa: 'DeMÁT', empleado: 'Prueba Ñúñez', periodo: '2026-11', dias, logoPng: new Uint8Array(readFileSync('public/logo.png')) });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
