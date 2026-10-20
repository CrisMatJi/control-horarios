import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { CalendarioMes } from '../../components/CalendarioMes';
import { Icono } from '../../components/Icono';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { descargarIcs } from '../../lib/descargarIcs';
import { descargarPdf } from '../../lib/descargarPdf';
import { nombreCompleto, type Empleado, type Excepcion } from '../../lib/tipos';
import {
  capital, diasDelMes, duracion, esPartido, formatoHoras, hoyISO, isoDe, moverPeriodo, nombreMes, periodoDe, porFecha, rangoMes, type FilaHorario,
} from '../../../supabase/functions/_shared/horario.ts';

export function Horarios() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [periodo, setPeriodo] = useState(periodoDe(hoyISO()));
  const [filas, setFilas] = useState<FilaHorario[]>([]);
  const [exc, setExc] = useState<Excepcion[]>([]);
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { api.empleados().then(setEmpleados); }, []);
  useEffect(() => {
    if (!id && empleados.length) navigate(`/admin/horarios/${empleados.find((e) => e.activo)?.id ?? empleados[0].id}`, { replace: true });
  }, [id, empleados, navigate]);

  const emp = empleados.find((e) => e.id === id);
  const cargar = useCallback(async () => {
    if (!id) return;
    const { desde, hasta } = rangoMes(periodo);
    const [h, x] = await Promise.all([api.horario(desde, hasta, id), api.excepciones(id, desde, hasta)]);
    setFilas(h);
    setExc(x);
  }, [id, periodo]);
  useEffect(() => { cargar(); }, [cargar]);

  const dias = useMemo(() => porFecha(filas), [filas]);
  const excMap = useMemo(() => new Map(exc.map((e) => [e.fecha, e])), [exc]);
  const stats = useMemo(() => {
    let min = 0, p = 0, c = 0;
    for (const t of dias.values()) { min += duracion(t); if (esPartido(t)) p++; else c++; }
    return { dias: dias.size, min, p, c };
  }, [dias]);

  const deshacible = (texto: string, lote: string) => toast({ texto, accion: { label: 'Deshacer', fn: async () => { await api.deshacerLote(lote); cargar(); } } });

  const eliminarDia = async (fecha: string) => {
    if (!id) return;
    const lote = await api.anularDias(id, [fecha]);
    await cargar();
    deshacible(`Horario del ${Number(fecha.slice(8))} eliminado`, lote);
  };
  const restaurarDia = async (fecha: string) => {
    if (!id) return;
    await api.restaurarDia(id, fecha);
    await cargar();
    toast({ texto: `Día ${Number(fecha.slice(8))} restaurado desde la rotación` });
  };
  const vaciarMes = async () => {
    if (!id || !emp) return;
    const [y, m] = periodo.split('-').map(Number);
    const fechas = Array.from({ length: diasDelMes(periodo) }, (_, i) => isoDe(y, m, i + 1)).filter((f) => !excMap.has(f) || excMap.get(f)!.tipo === 'CAMBIO');
    const lote = await api.anularDias(id, fechas);
    await cargar();
    deshacible(`Horario de ${nombreMes(periodo)} de ${emp.nombre} eliminado`, lote);
  };
  const reenviar = async () => {
    if (!emp) return;
    setOcupado(true);
    try {
      const r = await api.enviarHorarios(periodo, emp.id);
      toast({ texto: r.enviados ? `Horario enviado a ${emp.email}` : r.sinEmail ? `${emp.nombre} no tiene email` : 'No se ha podido enviar. Mira la pantalla de envíos.' });
    } catch (e) {
      toast({ texto: `Error al enviar: ${(e as Error).message}` });
    } finally {
      setOcupado(false);
    }
  };

  const lista = empleados.filter((e) => !filtro || nombreCompleto(e).toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh' }}>
      <aside aria-label="Empleados" style={{ flex: '1 1 240px', maxWidth: 290, background: 'var(--fondo-2)', borderRight: '1px solid var(--linea)', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="etiqueta muted" style={{ padding: '0 10px' }}>Empleados · {empleados.length}</span>
        <label htmlFor="fe" className="sr">Filtrar empleados</label>
        <input id="fe" className="input" placeholder="Filtrar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ height: 40, marginBottom: 6 }} />
        {lista.map((e) => (
          <Link key={e.id} to={`/admin/horarios/${e.id}`} aria-current={e.id === id ? 'page' : undefined} style={{ minHeight: 52, padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--carbon)', background: e.id === id ? '#fff' : 'transparent', border: e.id === id ? '1px solid var(--linea)' : '1px solid transparent', opacity: e.activo ? 1 : 0.55 }}>
            <Avatar e={e} t={34} />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreCompleto(e)}</span>
              <span style={{ fontSize: 12, color: e.email ? 'var(--gris)' : 'var(--rojo-osc)' }}>{e.email ? e.codigo : 'Sin email'}</span>
            </span>
          </Link>
        ))}
      </aside>

      <main className="pagina" style={{ flex: '3 1 620px', minWidth: 0 }}>
        {!emp ? <div className="cargando">Cargando…</div> : (
          <>
            <div className="pagina-cab" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <Avatar e={emp} t={54} />
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: 26 }}>{nombreCompleto(emp)}</h1>
                  <span className="muted" style={{ fontSize: 14 }}>{emp.email ?? 'Sin email'}{emp.movil ? ` · ${emp.movil}` : ''}</span>
                </div>
              </div>
              <div className="acciones">
                <button className="btn" disabled={!stats.dias} onClick={() => descargarPdf(nombreCompleto(emp), periodo, dias)}><Icono n="descargar" />PDF</button>
                <button className="btn" disabled={!stats.dias} onClick={() => descargarIcs(emp.id, nombreCompleto(emp), periodo, dias)}><Icono n="calendario" />.ics</button>
                <button className="btn" disabled={!stats.dias || !emp.email || ocupado} onClick={reenviar}><Icono n="email" />{ocupado ? 'Enviando…' : 'Enviar por email'}</button>
              </div>
            </div>

            <section className="tarjeta" style={{ overflow: 'hidden' }}>
              <div className="tarjeta-cab">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn btn-icono" aria-label="Mes anterior" onClick={() => setPeriodo(moverPeriodo(periodo, -1))}><Icono n="izq" /></button>
                  <h2 style={{ fontSize: 21, minWidth: 170, textAlign: 'center' }}>{capital(nombreMes(periodo))}</h2>
                  <button className="btn btn-icono" aria-label="Mes siguiente" onClick={() => setPeriodo(moverPeriodo(periodo, 1))}><Icono n="der" /></button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 22 }}>
                  <Stat label="Días" valor={String(stats.dias)} />
                  <Stat label="Horas" valor={formatoHoras(stats.min)} />
                  <Stat label="Partidos" valor={String(stats.p)} rojo />
                  <Stat label="Continuos" valor={String(stats.c)} />
                  <button className="btn btn-peligro" disabled={!stats.dias} onClick={vaciarMes}><Icono n="papelera" />Vaciar mes</button>
                </div>
              </div>
              <CalendarioMes periodo={periodo} dias={dias} excepciones={excMap} onEliminar={eliminarDia} onRestaurar={restaurarDia} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, valor, rojo }: { label: string; valor: string; rojo?: boolean }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <span className="mono" style={{ fontSize: 18, fontWeight: 500, color: rojo ? 'var(--rojo-osc)' : undefined }}>{valor}</span>
    </span>
  );
}
