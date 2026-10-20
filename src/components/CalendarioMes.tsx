import {
  diaSemana, DIAS_CORTOS, diasDelMes, duracion, esPartido, formatoHoras, hoyISO, isoDe, tramoBonito, type Tramo,
} from '../../supabase/functions/_shared/horario.ts';
import type { Excepcion } from '../lib/tipos';
import { Icono } from './Icono';

type Props = {
  periodo: string;
  dias: Map<string, Tramo[]>;
  excepciones?: Map<string, Excepcion>;
  onEliminar?: (fecha: string) => void;
  onRestaurar?: (fecha: string) => void;
};

const ETIQUETA_EXC: Record<string, string> = { LIBRE: 'Eliminado', VACACIONES: 'Vacaciones', BAJA: 'Baja' };

export function CalendarioMes({ periodo, dias, excepciones, onEliminar, onRestaurar }: Props) {
  const [y, m] = periodo.split('-').map(Number);
  const n = diasDelMes(periodo);
  const offset = diaSemana(isoDe(y, m, 1));
  const total = Math.ceil((offset + n) / 7) * 7;
  const hoy = hoyISO();
  const celdas = Array.from({ length: total }, (_, i) => i - offset + 1);

  return (
    <div className="scroll-x">
      <div className="cal">
        <div className="cal-dias">{DIAS_CORTOS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="cal-grid">
          {celdas.map((d, i) => {
            if (d < 1 || d > n) return <div key={i} className="cal-celda fuera" aria-hidden="true" />;
            const iso = isoDe(y, m, d);
            const tramos = dias.get(iso) ?? [];
            const exc = excepciones?.get(iso);
            const anulado = exc && exc.tipo !== 'CAMBIO';
            const clase = ['cal-celda', tramos.length ? (esPartido(tramos) ? 'partido' : 'continuo') : '', anulado ? 'anulado' : '', iso === hoy ? 'hoy' : ''].join(' ');
            return (
              <div key={i} className={clase}>
                <div className="cal-num">
                  <span>{d}</span>
                  {tramos.length > 0 && onEliminar && (
                    <button className="btn btn-icono" style={{ width: 32, height: 32, margin: '-4px -6px 0 0' }} aria-label={`Eliminar horario del día ${d}`} title="Eliminar horario de este día" onClick={() => onEliminar(iso)}>
                      <Icono n="papelera" t={16} />
                    </button>
                  )}
                  {anulado && onRestaurar && (
                    <button className="btn btn-icono" style={{ width: 32, height: 32, margin: '-4px -6px 0 0' }} aria-label={`Restaurar el día ${d}`} title="Restaurar el horario de la rotación" onClick={() => onRestaurar(iso)}>
                      <Icono n="restaurar" t={16} />
                    </button>
                  )}
                </div>
                {tramos.length > 0 ? (
                  <>
                    <span className={`cal-tipo ${esPartido(tramos) ? 'partido' : ''}`}>{esPartido(tramos) ? 'Partido' : 'Continuo'}</span>
                    {tramos.map((t, k) => <span key={k} className="cal-tramo">{tramoBonito(t)}</span>)}
                    <span className="cal-nota">{formatoHoras(duracion(tramos))}{exc?.tipo === 'CAMBIO' ? ' · cambio' : ''}</span>
                  </>
                ) : anulado ? (
                  <span className="cal-nota">{ETIQUETA_EXC[exc!.tipo]}</span>
                ) : (
                  <span className="cal-nota">Libre</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="leyenda" style={{ marginTop: 14 }}>
          <span><i style={{ background: 'var(--rojo-claro)', border: '1px solid var(--rojo-borde)' }} />Partido</span>
          <span><i style={{ background: 'var(--continuo)', border: '1px solid var(--continuo-borde)' }} />Continuo</span>
          <span><i style={{ background: '#fff', border: '1px solid var(--linea)' }} />Libre</span>
        </div>
      </div>
    </div>
  );
}
