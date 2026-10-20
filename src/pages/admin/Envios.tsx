import { useEffect, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Icono } from '../../components/Icono';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { nombreCompleto, type Empleado, type Envio } from '../../lib/tipos';
import { capital, hoyISO, moverPeriodo, nombreMes, periodoDe } from '../../../supabase/functions/_shared/horario.ts';

const ESTADO: Record<Envio['estado'], { texto: string; clase: string }> = {
  ENVIADO: { texto: 'Enviado', clase: 'chip-ok' },
  ERROR: { texto: 'Error', clase: 'chip-rojo' },
  SIN_EMAIL: { texto: 'Sin email', clase: 'chip-borde' },
};

export function Envios() {
  const toast = useToast();
  const actual = periodoDe(hoyISO());
  const [periodo, setPeriodo] = useState(moverPeriodo(actual, 1));
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [enviando, setEnviando] = useState(false);

  const cargar = () => Promise.all([api.envios(), api.empleados()]).then(([e, emp]) => { setEnvios(e); setEmpleados(emp); });
  useEffect(() => { cargar(); }, []);

  const porId = new Map(empleados.map((e) => [e.id, e]));
  const activos = empleados.filter((e) => e.activo);
  const opciones = [-1, 0, 1, 2].map((d) => moverPeriodo(actual, d));

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await api.enviarHorarios(periodo);
      toast({ texto: `${r.enviados} enviados${r.errores ? ` · ${r.errores} con error` : ''}${r.sinEmail ? ` · ${r.sinEmail} sin email` : ''}` });
      await cargar();
    } catch (e) {
      toast({ texto: `No se ha podido enviar: ${(e as Error).message}` });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Envíos de horario</h1>
          <span className="muted">Cada empleado recibe un email con su horario en PDF y un enlace para verlo en el móvil.</span>
        </div>
      </div>

      <section className="tarjeta" style={{ padding: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div className="campo">
          <label htmlFor="per">Mes a enviar</label>
          <select id="per" className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ minWidth: 200 }}>
            {opciones.map((p) => <option key={p} value={p}>{capital(nombreMes(p))}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 260px', fontSize: 14, lineHeight: 1.5 }} className="muted">
          Se enviará a {activos.filter((e) => e.email).length} de {activos.length} empleados activos. El envío automático sale el día 25 con el mes siguiente.
        </div>
        <button className="btn btn-primario" disabled={enviando} onClick={enviar}><Icono n="email" />{enviando ? 'Enviando…' : `Enviar ${nombreMes(periodo).split(' ')[0]} a todos`}</button>
      </section>

      <section className="tarjeta" style={{ overflow: 'hidden' }}>
        <div className="tarjeta-cab"><h2>Historial</h2></div>
        <div className="scroll-x">
          <div className="tabla" style={{ minWidth: 620 }}>
            <div className="tabla-fila tabla-cab" style={{ gridTemplateColumns: 'minmax(200px,2fr) 110px 110px minmax(160px,2fr) 140px' }}>
              <span>Empleado</span><span>Mes</span><span>Estado</span><span>Detalle</span><span>Fecha</span>
            </div>
            {envios.map((e) => {
              const emp = porId.get(e.empleado_id);
              return (
                <div key={e.id} className="tabla-fila" style={{ gridTemplateColumns: 'minmax(200px,2fr) 110px 110px minmax(160px,2fr) 140px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{emp && <Avatar e={emp} t={28} />}{emp ? nombreCompleto(emp) : '—'}</span>
                  <span className="mono">{e.periodo}</span>
                  <span><span className={`chip ${ESTADO[e.estado].clase}`}>{ESTADO[e.estado].texto}</span></span>
                  <span className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detalle ?? ''}</span>
                  <span className="mono" style={{ fontSize: 13 }}>{new Date(e.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              );
            })}
            {!envios.length && <div className="vacio">Todavía no se ha enviado ningún horario.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
