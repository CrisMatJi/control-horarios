import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Icono } from '../../components/Icono';
import { api } from '../../lib/api';
import { nombreCompleto, type Empleado, type Envio, type Rotacion } from '../../lib/tipos';
import {
  capital, diaSemana, DIAS_LARGOS, duracion, formatoHoras, hoyISO, minutos, moverPeriodo, nombreMes, partes,
  periodoDe, rangoMes, semanaRotacion, tramoBonito, type FilaHorario, type Tramo,
} from '../../../supabase/functions/_shared/horario.ts';

const H_INI = 7;
const H_FIN = 21;

export function Escritorio() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [filas, setFilas] = useState<FilaHorario[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [hayRotacion, setHayRotacion] = useState(true);
  const [rotacion, setRotacion] = useState<Rotacion | null>(null);
  const [error, setError] = useState('');
  const hoy = hoyISO();
  const periodo = periodoDe(hoy);
  const siguiente = moverPeriodo(periodo, 1);

  useEffect(() => {
    const { desde, hasta } = rangoMes(periodo);
    Promise.all([api.empleados(), api.horario(desde, hasta), api.envios(), api.rotacionActiva()])
      .then(([e, h, en, r]) => { setEmpleados(e); setFilas(h); setEnvios(en); setHayRotacion(Boolean(r)); setRotacion(r); })
      .catch((err) => setError(err.message));
  }, [periodo]);

  const activos = empleados.filter((e) => e.activo);
  const datos = useMemo(() => {
    const porEmp = new Map<string, { min: number; dias: Set<string>; hoy: Tramo[] }>();
    for (const f of filas) {
      const d = porEmp.get(f.empleado_id) ?? { min: 0, dias: new Set<string>(), hoy: [] };
      const t = { inicio: f.inicio.slice(0, 5), fin: f.fin.slice(0, 5) };
      d.min += duracion([t]);
      d.dias.add(f.fecha);
      if (f.fecha === hoy) d.hoy.push(t);
      porEmp.set(f.empleado_id, d);
    }
    const cobertura = Array.from({ length: H_FIN - H_INI }, (_, i) => {
      const h = (H_INI + i) * 60;
      return filas.filter((f) => f.fecha === hoy && minutos(f.inicio) < h + 60 && minutos(f.fin) > h).length;
    });
    const totalMin = [...porEmp.values()].reduce((s, d) => s + d.min, 0);
    return { porEmp, cobertura, totalMin };
  }, [filas, hoy]);

  const ultimoEnvio = new Map<string, Envio>();
  for (const e of envios) if (!ultimoEnvio.has(e.empleado_id)) ultimoEnvio.set(e.empleado_id, e);
  const enviadosSig = envios.filter((e) => e.periodo === siguiente && e.estado === 'ENVIADO').length;
  const erroresRecientes = activos.filter((e) => ultimoEnvio.get(e.id)?.estado === 'ERROR');
  const sinEmail = activos.filter((e) => !e.email);
  const trabajanHoy = activos.filter((e) => (datos.porEmp.get(e.id)?.hoy.length ?? 0) > 0);
  const maxCob = Math.max(1, ...datos.cobertura);
  const { d, m } = partes(hoy);

  return (
    <div className="pagina">
      <div className="pagina-cab">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="etiqueta" style={{ color: 'var(--rojo)' }}>{capital(DIAS_LARGOS[diaSemana(hoy)])}, {d} de {nombreMes(periodo).split(' ')[0]}</span>
          <h1>Escritorio</h1>
          {rotacion && <span className="chip chip-rojo" style={{ alignSelf: 'flex-start', fontSize: 13 }}>Semana {semanaRotacion(rotacion, hoy)} de {rotacion.semanas} de la rotación</span>}
        </div>
        <div className="acciones">
          <Link to="/admin/empleados" className="btn"><Icono n="mas" />Nuevo empleado</Link>
          <Link to="/admin/envios" className="btn btn-primario"><Icono n="email" />Enviar horarios de {nombreMes(siguiente).split(' ')[0]}</Link>
        </div>
      </div>

      {error && <div className="aviso aviso-rojo" role="alert">{error}</div>}

      <div className="kpis">
        <div className="tarjeta kpi">
          <span className="muted">Empleados activos</span>
          <span className="valor">{activos.length}</span>
          <span className="muted" style={{ fontSize: 13 }}>{activos.length - sinEmail.length} con email</span>
        </div>
        <div className="tarjeta kpi">
          <span className="muted">Trabajan hoy</span>
          <span className="valor">{trabajanHoy.length}</span>
          <span className="muted" style={{ fontSize: 13 }}>de {activos.length} personas</span>
        </div>
        <div className="tarjeta kpi">
          <span className="muted">Horas planificadas en {nombreMes(periodo).split(' ')[0]}</span>
          <span className="valor">{Math.round(datos.totalMin / 60)} h</span>
          <span className="muted" style={{ fontSize: 13 }}>Media {activos.length ? Math.round(datos.totalMin / 60 / activos.length) : 0} h por persona</span>
        </div>
        <div className="tarjeta kpi">
          <span className="muted">Horarios de {nombreMes(siguiente).split(' ')[0]} enviados</span>
          <span className="valor">{enviadosSig}<span style={{ fontSize: 20 }} className="muted">/{activos.length}</span></span>
          <div role="progressbar" aria-label="Envíos del mes siguiente" aria-valuenow={enviadosSig} aria-valuemin={0} aria-valuemax={activos.length} style={{ height: 6, borderRadius: 3, background: 'var(--linea-suave)' }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--rojo)', width: `${activos.length ? (enviadosSig / activos.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="fila-flex">
        <section className="tarjeta" style={{ flex: '2 1 520px', overflow: 'hidden' }}>
          <div className="tarjeta-cab">
            <h2>Turnos de hoy</h2>
            <span className="muted" style={{ fontSize: 14 }}>{trabajanHoy.length} personas trabajan hoy</span>
          </div>
          <div className="scroll-x">
            <div style={{ minWidth: 560, padding: '12px 20px 16px' }}>
              <div style={{ display: 'flex', height: 22 }}>
                <span style={{ width: 170, flex: 'none' }} />
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${(H_FIN - H_INI) / 2}, 1fr)`, fontFamily: 'var(--mono)', fontSize: 12 }} className="muted">
                  {Array.from({ length: (H_FIN - H_INI) / 2 }, (_, i) => <span key={i}>{H_INI + i * 2}:00</span>)}
                </div>
              </div>
              {activos.map((e) => {
                const tramos = datos.porEmp.get(e.id)?.hoy ?? [];
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', height: 44, borderTop: '1px solid var(--fondo)' }}>
                    <Link to={`/admin/horarios/${e.id}`} style={{ width: 170, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, color: 'var(--carbon)', textDecoration: 'none' }}>
                      <Avatar e={e} t={28} />
                      <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreCompleto(e)}</span>
                    </Link>
                    <div style={{ flex: 1, height: 28, position: 'relative', background: 'var(--fondo-2)', borderRadius: 4 }}>
                      {tramos.length === 0 && <span className="muted" style={{ position: 'absolute', left: 10, top: 5, fontSize: 13 }}>Libre</span>}
                      {tramos.map((t, k) => {
                        const left = ((minutos(t.inicio) - H_INI * 60) / ((H_FIN - H_INI) * 60)) * 100;
                        const w = ((minutos(t.fin) - minutos(t.inicio)) / ((H_FIN - H_INI) * 60)) * 100;
                        return (
                          <span key={k} title={tramoBonito(t)} style={{ position: 'absolute', top: 2, bottom: 2, left: `${left}%`, width: `${w}%`, borderRadius: 4, background: tramos.length > 1 ? 'var(--rojo)' : 'var(--carbon-2)', color: '#fff', fontFamily: 'var(--mono)', fontSize: 12, display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {tramoBonito(t)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="leyenda" style={{ marginTop: 12 }}>
                <span><i style={{ background: 'var(--rojo)' }} />Turno partido</span>
                <span><i style={{ background: 'var(--carbon-2)' }} />Turno continuo</span>
              </div>
            </div>
          </div>
        </section>

        <section className="tarjeta" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
          <div className="tarjeta-cab">
            <h2>Requiere atención</h2>
            <span className="chip chip-rojo">{sinEmail.length + erroresRecientes.length + (hayRotacion ? 0 : 1)}</span>
          </div>
          {!hayRotacion && <Aviso titulo="No hay rotación cargada" texto="Sin rotación no se puede calcular ningún horario." enlace="/admin/rotacion" accion="Cargar rotación" />}
          {erroresRecientes.map((e) => (
            <Aviso key={e.id} rojo titulo={`Email no entregado · ${nombreCompleto(e)}`} texto={ultimoEnvio.get(e.id)?.detalle ?? 'El último envío falló.'} enlace={`/admin/empleados?editar=${e.id}`} accion="Revisar email" />
          ))}
          {sinEmail.map((e) => (
            <Aviso key={e.id} titulo={`Sin email · ${nombreCompleto(e)}`} texto="No podrá entrar ni recibir su horario hasta que tenga email." enlace={`/admin/empleados?editar=${e.id}`} accion="Completar ficha" />
          ))}
          {hayRotacion && !sinEmail.length && !erroresRecientes.length && <div className="vacio">Todo en orden.</div>}
        </section>
      </div>

      <section className="tarjeta" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Cobertura de hoy</h2>
          <span className="muted" style={{ fontSize: 13 }}>Personas en tienda por franja horaria · {d}/{m}</span>
        </div>
        <div role="img" aria-label={`Personas por franja: ${datos.cobertura.map((n, i) => `${H_INI + i}h ${n}`).join(', ')}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${datos.cobertura.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: 150 }}>
          {datos.cobertura.map((n, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
              <span className="mono" style={{ fontSize: 12 }}>{n}</span>
              <span style={{ width: '100%', borderRadius: '3px 3px 0 0', background: n === maxCob ? 'var(--rojo)' : 'var(--gris-borde)', height: Math.max(3, (n / maxCob) * 110) }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${datos.cobertura.length}, minmax(0, 1fr))`, gap: 6, fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'center' }} className="muted">
          {datos.cobertura.map((_, i) => <span key={i}>{H_INI + i}</span>)}
        </div>
      </section>

      <section className="tarjeta" style={{ overflow: 'hidden' }}>
        <div className="tarjeta-cab">
          <h2>{capital(nombreMes(periodo))} por empleado</h2>
          <Link to="/admin/horarios" style={{ fontSize: 14, fontWeight: 600 }}>Ver horarios</Link>
        </div>
        <div className="scroll-x">
          <div className="tabla" style={{ minWidth: 560 }}>
            <div className="tabla-fila tabla-cab" style={{ gridTemplateColumns: 'minmax(200px,2fr) 80px 90px minmax(120px,1fr)' }}>
              <span>Empleado</span><span style={{ textAlign: 'right' }}>Días</span><span style={{ textAlign: 'right' }}>Horas</span><span>Último envío</span>
            </div>
            {activos.map((e) => {
              const dd = datos.porEmp.get(e.id);
              const env = ultimoEnvio.get(e.id);
              return (
                <div key={e.id} className="tabla-fila" style={{ gridTemplateColumns: 'minmax(200px,2fr) 80px 90px minmax(120px,1fr)' }}>
                  <Link to={`/admin/horarios/${e.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--carbon)', textDecoration: 'none' }}>
                    <Avatar e={e} t={32} /><span style={{ fontWeight: 500 }}>{nombreCompleto(e)}</span>
                  </Link>
                  <span className="mono" style={{ textAlign: 'right' }}>{dd?.dias.size ?? 0}</span>
                  <span className="mono" style={{ textAlign: 'right' }}>{formatoHoras(dd?.min ?? 0)}</span>
                  <span>{env ? <span className={`chip ${env.estado === 'ENVIADO' ? 'chip-gris' : 'chip-rojo'}`}>{env.estado === 'ENVIADO' ? `Enviado ${env.periodo}` : env.estado === 'ERROR' ? 'Error' : 'Sin email'}</span> : <span className="muted" style={{ fontSize: 13 }}>Nunca</span>}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Aviso({ titulo, texto, enlace, accion, rojo }: { titulo: string; texto: string; enlace: string; accion: string; rojo?: boolean }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--fondo)', display: 'flex', gap: 12 }}>
      <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: rojo ? 'var(--rojo-claro)' : 'var(--continuo)', color: rojo ? 'var(--rojo-osc)' : 'var(--carbon-2)' }}>
        <Icono n={rojo ? 'alerta' : 'empleados'} t={16} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <strong style={{ fontSize: 15 }}>{titulo}</strong>
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>{texto}</span>
        <Link to={enlace} style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{accion}</Link>
      </div>
    </div>
  );
}
