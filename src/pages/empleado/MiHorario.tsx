import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Icono } from '../../components/Icono';
import { api } from '../../lib/api';
import { descargarPdf } from '../../lib/descargarPdf';
import { useSesion } from '../../lib/sesion';
import { nombreCompleto } from '../../lib/tipos';
import {
  capital, diaSemana, DIAS_CORTOS, DIAS_LARGOS, diasDelMes, duracion, esPartido, formatoHoras, hoyISO, isoDe, moverPeriodo,
  nombreMes, partes, periodoDe, porFecha, rangoMes, sumarDias, tramoBonito, type FilaHorario,
} from '../../../supabase/functions/_shared/horario.ts';

export function MiHorario() {
  const { empleado, salir } = useSesion();
  const hoy = hoyISO();
  const [periodo, setPeriodo] = useState(periodoDe(hoy));
  const [filas, setFilas] = useState<FilaHorario[]>([]);
  const [proximos, setProximos] = useState<FilaHorario[]>([]);
  const [vista, setVista] = useState<'lista' | 'mes'>('lista');
  const [elegido, setElegido] = useState(hoy);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!empleado) return;
    const { desde, hasta } = rangoMes(periodo);
    setCargando(true);
    api.horario(desde, hasta, empleado.id).then(setFilas).finally(() => setCargando(false));
  }, [periodo, empleado]);
  useEffect(() => {
    if (empleado) api.horario(hoy, sumarDias(hoy, 14), empleado.id).then(setProximos);
  }, [empleado, hoy]);

  const dias = useMemo(() => porFecha(filas), [filas]);
  const prox = useMemo(() => porFecha(proximos), [proximos]);
  const hoyT = prox.get(hoy) ?? [];
  const siguiente = [...prox.keys()].filter((f) => f > hoy).sort()[0];
  const totalMin = [...dias.values()].reduce((s, t) => s + duracion(t), 0);
  if (!empleado) return null;

  const [y, m] = periodo.split('-').map(Number);
  const n = diasDelMes(periodo);
  const offset = diaSemana(isoDe(y, m, 1));
  const { d: dHoy } = partes(hoy);
  const elegidoT = dias.get(elegido) ?? [];

  return (
    <div className="emp">
      <header className="emp-cab">
        <div>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DeMÁT" style={{ width: 104 }} />
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreCompleto(empleado)}</span>
            <Avatar e={empleado} t={34} />
            <button className="btn btn-icono" aria-label="Cerrar sesión" onClick={salir}><Icono n="salir" t={20} /></button>
          </span>
        </div>
      </header>

      <main className="emp-main">
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span className="etiqueta" style={{ color: 'var(--rojo)' }}>{capital(DIAS_LARGOS[diaSemana(hoy)])}, {dHoy} de {nombreMes(periodoDe(hoy)).split(' ')[0]}</span>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>Hola, {empleado.nombre}</h1>
          </div>

          <section className="hoy-card" aria-labelledby="hoy">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="hoy" className="etiqueta" style={{ color: '#D6D7CE', fontSize: 13 }}>{hoyT.length ? 'Hoy trabajas' : 'Hoy libras'}</h2>
              {hoyT.length > 0 && <span className="chip" style={{ background: esPartido(hoyT) ? 'var(--rojo)' : '#3A3A35', color: '#fff' }}>{esPartido(hoyT) ? 'Partido' : 'Continuo'}</span>}
            </div>
            {hoyT.length ? hoyT.map((t, k) => <span key={k} className="horas">{tramoBonito(t)}</span>) : <span className="horas">—</span>}
            <span style={{ fontSize: 14, color: '#D6D7CE' }}>
              {hoyT.length ? `${formatoHoras(duracion(hoyT))} en total` : ''}
              {siguiente ? `${hoyT.length ? ' · ' : ''}Próximo: ${DIAS_CORTOS[diaSemana(siguiente)]} ${Number(siguiente.slice(8))}, ${prox.get(siguiente)!.map(tramoBonito).join(' y ')}` : ''}
            </span>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            <Mini label="Días" valor={String(dias.size)} />
            <Mini label="Horas" valor={`${Math.round(totalMin / 60)} h`} />
            <Mini label="Libres" valor={String(n - dias.size)} />
          </div>

          <button className="btn btn-primario btn-grande" disabled={!dias.size} onClick={() => descargarPdf(nombreCompleto(empleado), periodo, dias)}>
            <Icono n="descargar" t={20} />Descargar PDF de {nombreMes(periodo).split(' ')[0]}
          </button>
        </div>

        <section className="tarjeta" style={{ flex: '2 1 480px', minWidth: 0, overflow: 'hidden' }} aria-labelledby="mes">
          <div className="tarjeta-cab" style={{ padding: '10px 12px 10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button className="btn btn-icono" aria-label="Mes anterior" onClick={() => setPeriodo(moverPeriodo(periodo, -1))}><Icono n="izq" /></button>
              <h2 id="mes" style={{ minWidth: 140, textAlign: 'center', fontSize: 18 }}>{capital(nombreMes(periodo))}</h2>
              <button className="btn btn-icono" aria-label="Mes siguiente" onClick={() => setPeriodo(moverPeriodo(periodo, 1))}><Icono n="der" /></button>
            </div>
            <div role="tablist" aria-label="Vista" className="tabs">
              <button role="tab" aria-selected={vista === 'lista'} onClick={() => setVista('lista')}>Lista</button>
              <button role="tab" aria-selected={vista === 'mes'} onClick={() => setVista('mes')}>Mes</button>
            </div>
          </div>

          {cargando ? <div className="cargando">Cargando…</div> : !dias.size ? (
            <div className="vacio">No hay horario para {nombreMes(periodo)}.</div>
          ) : vista === 'lista' ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {Array.from({ length: n }, (_, i) => {
                const iso = isoDe(y, m, i + 1);
                const ds = diaSemana(iso);
                const t = dias.get(iso) ?? [];
                const items = [];
                if (ds === 0 || i === 0) items.push(<li key={`s${i}`} className="lista-semana">Semana del {i + 1 - ds > 0 ? i + 1 - ds : 1}</li>);
                items.push(
                  <li key={iso} className={`lista-dia ${iso < hoy ? 'pasado' : ''} ${iso === hoy ? 'hoy' : ''}`}>
                    <span style={{ width: 42, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: iso === hoy ? 'var(--rojo-osc)' : undefined }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{DIAS_CORTOS[ds]}</span>
                      <span className="mono" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{i + 1}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="mono tramos" style={{ fontSize: 15, color: t.length ? undefined : 'var(--gris)' }}>{t.length ? t.map((x, k) => <span key={k}>{tramoBonito(x)}</span>) : 'Libre'}</span>
                      {t.length > 0 && <span className="muted" style={{ fontSize: 13 }}>{formatoHoras(duracion(t))}</span>}
                    </span>
                    {(t.length > 0 || iso === hoy) && <span className={`chip ${iso === hoy ? '' : esPartido(t) ? 'chip-rojo' : 'chip-gris'}`} style={iso === hoy ? { background: 'var(--rojo)', color: '#fff' } : undefined}>{iso === hoy ? 'Hoy' : esPartido(t) ? 'Partido' : 'Continuo'}</span>}
                  </li>,
                );
                return items;
              })}
            </ul>
          ) : (
            <div className="mini-cal">
              <div className="cal-dias">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} style={{ textAlign: 'center' }}>{d}</span>)}</div>
              <div className="cal-grid">
                {Array.from({ length: Math.ceil((offset + n) / 7) * 7 }, (_, i) => {
                  const d = i - offset + 1;
                  if (d < 1 || d > n) return <span key={i} />;
                  const iso = isoDe(y, m, d);
                  const t = dias.get(iso) ?? [];
                  return (
                    <button key={i} className="mini-celda" aria-pressed={iso === elegido} aria-label={`${d}: ${t.length ? t.map(tramoBonito).join(' y ') : 'libre'}`} onClick={() => setElegido(iso)} style={iso === hoy && iso !== elegido ? { borderColor: 'var(--carbon)', borderWidth: 2 } : undefined}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>
                      <span className="punto" style={t.length ? { background: esPartido(t) ? 'var(--rojo)' : 'var(--carbon-2)' } : { border: '1.5px solid #A8A99E' }} />
                      <small>{t.map((x) => tramoBonito(x).replace(/:00/g, '')).join('\n')}</small>
                    </button>
                  );
                })}
              </div>
              <div role="status" className="aviso aviso-gris" style={{ marginTop: 12, flexDirection: 'column', gap: 4 }}>
                <strong>{capital(DIAS_LARGOS[diaSemana(elegido)])} {Number(elegido.slice(8))}</strong>
                <span className="mono tramos" style={{ fontSize: 16 }}>{elegidoT.length ? elegidoT.map((x, k) => <span key={k}>{tramoBonito(x)}</span>) : 'Libre'}</span>
                {elegidoT.length > 0 && <span className="muted" style={{ fontSize: 13 }}>{esPartido(elegidoT) ? 'Turno partido' : 'Turno continuo'} · {formatoHoras(duracion(elegidoT))}</span>}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <span className="tarjeta" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{valor}</span>
    </span>
  );
}
