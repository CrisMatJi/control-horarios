import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Icono } from '../../components/Icono';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { nombreCompleto, type Empleado, type Rotacion as TRotacion, type TurnoPlantilla } from '../../lib/tipos';
import {
  diaSemana, DIAS_CORTOS, duracion, formatoHoras, hhmm, hoyISO, minutos, sumarDias, tramoBonito, type Tramo,
} from '../../../supabase/functions/_shared/horario.ts';

const DIAS_JSON = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

type Importada = { semanas: number; anclaLunes: string; anclaSemana: number; turnos: { codigo: string; semana: number; dia_semana: number; inicio: string; fin: string }[] };

const PROMPT_IA = `Convierte la imagen del horario adjunta en JSON con EXACTAMENTE este formato y nada más:
{
  "semanas_rotacion": 6,
  "ancla": { "lunes": "AAAA-MM-DD", "semana": 1 },
  "semanas": {
    "1": {
      "lunes": { "VS": [{ "inicio": "10:00", "fin": "14:00" }, { "inicio": "15:00", "fin": "20:00" }] },
      "martes": { }
    }
  }
}
Reglas: usa las siglas de cada columna como clave; días en minúscula y sin tilde (lunes, martes, miercoles, jueves, viernes, sabado, domingo); una casilla con raya diagonal es media hora; comprueba que las horas de cada persona y día cuadran con la fila de totales; omite a quien no trabaja ese día.`;

/** Lunes de la semana de una fecha */
const lunesDe = (iso: string) => sumarDias(iso, -diaSemana(iso));

export function Rotacion() {
  const toast = useToast();
  const [rot, setRot] = useState<TRotacion | null>(null);
  const [turnos, setTurnos] = useState<TurnoPlantilla[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [semana, setSemana] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [ancla, setAncla] = useState({ lunes: lunesDe(hoyISO()), semana: 1 });
  const [texto, setTexto] = useState('');
  const [importada, setImportada] = useState<Importada | null>(null);
  const [errorImp, setErrorImp] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const [r, e] = await Promise.all([api.rotacionActiva(), api.empleados()]);
    setRot(r);
    setEmpleados(e);
    if (r) {
      setTurnos(await api.turnosPlantilla(r.id));
      const lunesHoy = lunesDe(hoyISO());
      const semanasDesde = Math.floor((Date.parse(lunesHoy) - Date.parse(r.ancla_lunes)) / (7 * 864e5));
      const actual = ((((semanasDesde + r.ancla_semana - 1) % r.semanas) + r.semanas) % r.semanas) + 1;
      setAncla({ lunes: lunesHoy, semana: actual });
      setSemana(actual);
    }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const semanaActual = ancla.semana;
  const porCodigo = useMemo(() => new Map(empleados.map((e) => [e.codigo, e])), [empleados]);

  // Vista: semana × empleado × día
  const vista = useMemo(() => {
    const m = new Map<string, Tramo[]>();
    for (const t of turnos.filter((x) => x.semana === semana)) {
      const k = `${t.empleado_id}|${t.dia_semana}`;
      m.set(k, [...(m.get(k) ?? []), { inicio: hhmm(t.inicio), fin: hhmm(t.fin) }].sort((a, b) => minutos(a.inicio) - minutos(b.inicio)));
    }
    return m;
  }, [turnos, semana]);
  const conDomingo = turnos.some((t) => t.dia_semana === 7);
  const nDias = conDomingo ? 7 : 6;
  const enRotacion = empleados.filter((e) => turnos.some((t) => t.empleado_id === e.id));

  const guardarAncla = async () => {
    if (!rot) return;
    setGuardando(true);
    try {
      await api.guardarRotacion({
        departamento: rot.departamento_id, nombre: rot.nombre, semanas: rot.semanas, anclaLunes: ancla.lunes, anclaSemana: ancla.semana,
        turnos: turnos.map(({ empleado_id, semana, dia_semana, inicio, fin }) => ({ empleado_id, semana, dia_semana, inicio, fin })),
      });
      toast({ texto: 'Semana de referencia actualizada' });
      await cargar();
    } catch (e) {
      toast({ texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const leer = (contenido: string) => {
    setTexto(contenido);
    setErrorImp('');
    setImportada(null);
    if (!contenido.trim()) return;
    try {
      const j = JSON.parse(contenido);
      const semanas = Number(j.semanas_rotacion ?? Object.keys(j.semanas ?? {}).length);
      if (!semanas || !j.semanas) throw new Error('Falta "semanas" o "semanas_rotacion".');
      const out: Importada['turnos'] = [];
      for (const [s, dias] of Object.entries<Record<string, Record<string, { inicio: string; fin: string }[]>>>(j.semanas)) {
        for (const [dia, porEmp] of Object.entries(dias)) {
          const ds = DIAS_JSON.indexOf(dia.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()) + 1;
          if (ds < 1) throw new Error(`Día no reconocido: "${dia}"`);
          for (const [codigo, tramos] of Object.entries(porEmp ?? {})) {
            for (const t of tramos) {
              if (!/^\d{1,2}:\d{2}$/.test(t.inicio) || !/^\d{1,2}:\d{2}$/.test(t.fin) || minutos(t.fin) <= minutos(t.inicio)) throw new Error(`Tramo no válido para ${codigo} (${dia}, semana ${s}).`);
              out.push({ codigo: codigo.toUpperCase(), semana: Number(s), dia_semana: ds, inicio: t.inicio.padStart(5, '0'), fin: t.fin.padStart(5, '0') });
            }
          }
        }
      }
      const a = j.ancla ?? {};
      setImportada({ semanas, anclaLunes: a.lunes ?? ancla.lunes, anclaSemana: Number(a.semana ?? 1), turnos: out });
    } catch (e) {
      setErrorImp(e instanceof SyntaxError ? 'El texto no es un JSON válido.' : (e as Error).message);
    }
  };

  const faltan = importada ? [...new Set(importada.turnos.map((t) => t.codigo))].filter((c) => !porCodigo.has(c)) : [];
  const resumenImp = useMemo(() => {
    if (!importada) return [];
    const codigos = [...new Set(importada.turnos.map((t) => t.codigo))].sort();
    return codigos.map((c) => ({
      codigo: c,
      horas: Array.from({ length: importada.semanas }, (_, i) => duracion(importada.turnos.filter((t) => t.codigo === c && t.semana === i + 1))),
    }));
  }, [importada]);

  const guardarImportada = async () => {
    if (!importada) return;
    setGuardando(true);
    try {
      const dep = empleados[0]?.departamento_id ?? (await api.departamento())?.id;
      if (!dep) throw new Error('No hay departamento.');
      const mapa = new Map(porCodigo);
      for (const c of faltan) {
        const nuevo = await api.guardarEmpleado({ departamento_id: dep, codigo: c, nombre: c, apellidos: '' });
        mapa.set(c, nuevo);
      }
      await api.guardarRotacion({
        departamento: dep, nombre: rot?.nombre ?? 'Rotación', semanas: importada.semanas, anclaLunes: importada.anclaLunes, anclaSemana: importada.anclaSemana,
        turnos: importada.turnos.map((t) => ({ empleado_id: mapa.get(t.codigo)!.id, semana: t.semana, dia_semana: t.dia_semana, inicio: t.inicio, fin: t.fin })),
      });
      toast({ texto: `Rotación de ${importada.semanas} semanas guardada${faltan.length ? ` · ${faltan.length} empleados creados` : ''}` });
      setTexto('');
      setImportada(null);
      await cargar();
    } catch (e) {
      setErrorImp((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="pagina"><div className="cargando">Cargando…</div></div>;

  return (
    <div className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Rotación</h1>
          <span className="muted">{rot ? `${rot.nombre} · ${rot.semanas} semanas que se repiten` : 'Todavía no hay ninguna rotación cargada'}</span>
        </div>
      </div>

      {rot && (
        <>
          <section className="tarjeta" style={{ padding: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 260px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Semana de referencia</h2>
              <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Con esto el sistema sabe qué semana de la rotación toca en cada fecha. Esta semana es la <strong>{semanaActual}</strong>.</span>
            </div>
            <div className="campo">
              <label htmlFor="al">La semana del lunes</label>
              <input id="al" type="date" className="input mono" value={ancla.lunes} onChange={(e) => setAncla({ ...ancla, lunes: e.target.value ? lunesDe(e.target.value) : ancla.lunes })} />
            </div>
            <div className="campo">
              <label htmlFor="as">es la semana</label>
              <select id="as" className="input" value={ancla.semana} onChange={(e) => setAncla({ ...ancla, semana: Number(e.target.value) })}>
                {Array.from({ length: rot.semanas }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            <button className="btn btn-oscuro" disabled={guardando} onClick={guardarAncla}>Guardar</button>
          </section>

          <section className="tarjeta" style={{ overflow: 'hidden' }}>
            <div className="tarjeta-cab">
              <div role="tablist" aria-label="Semana de la rotación" className="tabs">
                {Array.from({ length: rot.semanas }, (_, i) => (
                  <button key={i} role="tab" aria-selected={semana === i + 1} onClick={() => setSemana(i + 1)}>
                    Semana {i + 1}{i + 1 === semanaActual ? ' · actual' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="scroll-x">
              <div className="rot-grid" style={{ gridTemplateColumns: `150px repeat(${nDias}, minmax(110px, 1fr)) 80px` }}>
                <div className="cab">Empleado</div>
                {DIAS_CORTOS.slice(0, nDias).map((d) => <div key={d} className="cab">{d}</div>)}
                <div className="cab" style={{ textAlign: 'right' }}>Total</div>
                {enRotacion.map((e) => {
                  let total = 0;
                  return [
                    <div key={`${e.id}n`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar e={e} t={28} /><span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.apellidos ? nombreCompleto(e) : e.codigo}</span></div>,
                    ...Array.from({ length: nDias }, (_, d) => {
                      const t = vista.get(`${e.id}|${d + 1}`) ?? [];
                      total += duracion(t);
                      return (
                        <div key={`${e.id}${d}`} className="mono" style={{ background: t.length > 1 ? 'var(--rojo-claro)' : t.length ? 'var(--continuo)' : undefined, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {t.length ? t.map((x, k) => <span key={k}>{tramoBonito(x)}</span>) : <span className="muted">—</span>}
                        </div>
                      );
                    }),
                    <div key={`${e.id}t`} className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{formatoHoras(total)}</div>,
                  ];
                })}
              </div>
            </div>
          </section>
        </>
      )}

      <section className="tarjeta" style={{ overflow: 'hidden' }}>
        <div className="tarjeta-cab">
          <div>
            <h2>{rot ? 'Sustituir la rotación' : 'Cargar la rotación'}</h2>
            <span className="muted" style={{ fontSize: 14 }}>Pega o sube el JSON. Si te pasan una imagen, conviértela primero con una IA usando el prompt.</span>
          </div>
          <div className="acciones">
            <button className="btn" onClick={() => { navigator.clipboard.writeText(PROMPT_IA); toast({ texto: 'Prompt copiado' }); }}>Copiar prompt para la IA</button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              <Icono n="subir" />Subir .json
              <input type="file" accept="application/json,.json" className="sr" onChange={async (e) => { const f = e.target.files?.[0]; if (f) leer(await f.text()); }} />
            </label>
          </div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label htmlFor="json" className="sr">JSON de la rotación</label>
          <textarea id="json" className="input mono" rows={8} placeholder='{ "semanas_rotacion": 6, "ancla": { … }, "semanas": { … } }' value={texto} onChange={(e) => leer(e.target.value)} style={{ fontSize: 13 }} />
          {errorImp && <div className="aviso aviso-rojo" role="alert"><Icono n="alerta" />{errorImp}</div>}
          {importada && (
            <>
              <div className="aviso aviso-gris">
                <Icono n="check" />
                <span>{importada.semanas} semanas · {importada.turnos.length} tramos · la semana del {importada.anclaLunes} es la {importada.anclaSemana}.{faltan.length ? ` Se crearán ${faltan.length} empleados nuevos (${faltan.join(', ')}); luego completa su nombre y email.` : ''}</span>
              </div>
              <div className="scroll-x">
                <div className="rot-grid" style={{ gridTemplateColumns: `100px repeat(${importada.semanas}, minmax(80px, 1fr))`, minWidth: 0 }}>
                  <div className="cab">Siglas</div>
                  {Array.from({ length: importada.semanas }, (_, i) => <div key={i} className="cab">Sem. {i + 1}</div>)}
                  {resumenImp.map((r) => [
                    <div key={r.codigo} className="mono" style={{ fontWeight: 600 }}>{r.codigo}{faltan.includes(r.codigo) ? ' *' : ''}</div>,
                    ...r.horas.map((h, i) => <div key={r.codigo + i} className="mono">{formatoHoras(h)}</div>),
                  ])}
                </div>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>Compara estas horas con la fila de totales de la hoja antes de guardar.</span>
              <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => leer('')}>Descartar</button>
                <button className="btn btn-primario" disabled={guardando} onClick={guardarImportada}>{guardando ? 'Guardando…' : 'Guardar rotación'}</button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
