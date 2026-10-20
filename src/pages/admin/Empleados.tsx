import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Icono } from '../../components/Icono';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { nombreCompleto, type Empleado } from '../../lib/tipos';

type Borrador = { id?: string; codigo: string; nombre: string; apellidos: string; email: string; movil: string; activo: boolean };
const VACIO: Borrador = { codigo: '', nombre: '', apellidos: '', email: '', movil: '', activo: true };
const COLS = 'minmax(240px,2fr) minmax(110px,1fr) 90px 140px';

export function Empleados() {
  const [lista, setLista] = useState<Empleado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [ficha, setFicha] = useState<Borrador | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const cargar = () => api.empleados().then(setLista).finally(() => setCargando(false));
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    const id = params.get('editar');
    const e = id && lista.find((x) => x.id === id);
    if (e) abrir(e);
  }, [params, lista]);

  const abrir = (e?: Empleado) => {
    setErrores({});
    setConfirmar(null);
    setFicha(e ? { id: e.id, codigo: e.codigo, nombre: e.nombre, apellidos: e.apellidos, email: e.email ?? '', movil: e.movil ?? '', activo: e.activo } : { ...VACIO });
  };
  const cerrar = () => { setFicha(null); if (params.get('editar')) setParams({}); };

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!ficha) return;
    const err: Record<string, string> = {};
    if (!ficha.nombre.trim()) err.nombre = 'Indica el nombre.';
    if (!ficha.apellidos.trim()) err.apellidos = 'Indica los apellidos.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ficha.email.trim())) err.email = 'Escribe un email válido: ahí recibirá el horario y con él entrará.';
    if (!ficha.codigo.trim()) err.codigo = 'Indica las siglas que aparecen en la hoja de horarios.';
    setErrores(err);
    if (Object.keys(err).length) return;
    setGuardando(true);
    try {
      const dep = lista[0]?.departamento_id ?? (await api.departamento())?.id;
      if (!dep) throw new Error('No hay ningún departamento creado.');
      await api.guardarEmpleado({
        id: ficha.id, departamento_id: dep, codigo: ficha.codigo.trim().toUpperCase(), nombre: ficha.nombre.trim(),
        apellidos: ficha.apellidos.trim(), email: ficha.email.trim().toLowerCase(), movil: ficha.movil.trim() || null, activo: ficha.activo,
      });
      toast({ texto: `${ficha.nombre} ${ficha.id ? 'actualizado' : 'creado'}` });
      cerrar();
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setErrores({ general: msg.includes('empleados_email_unico') ? 'Ya hay otro empleado con ese email.' : msg.includes('empleados_codigo_unico') ? 'Ya hay otro empleado con esas siglas.' : msg });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (e: Empleado) => {
    try {
      await api.borrarEmpleado(e.id);
      toast({ texto: `${nombreCompleto(e)} eliminado` });
      setConfirmar(null);
      if (ficha?.id === e.id) cerrar();
      await cargar();
    } catch (err) {
      toast({ texto: `No se ha podido eliminar: ${(err as Error).message}` });
    }
  };

  const filtro = q.trim().toLowerCase();
  const vis = lista.filter((e) => !filtro || `${e.codigo} ${e.nombre} ${e.apellidos} ${e.email ?? ''}`.toLowerCase().includes(filtro));
  const set = (k: keyof Borrador) => (ev: React.ChangeEvent<HTMLInputElement>) => setFicha((f) => f && { ...f, [k]: k === 'activo' ? ev.target.checked : ev.target.value });

  return (
    <div className="pagina">
      <div className="pagina-cab">
        <div>
          <nav aria-label="Ruta" className="muted" style={{ fontSize: 13 }}><Link to="/admin" className="muted">Escritorio</Link> / Empleados</nav>
          <h1>Empleados</h1>
        </div>
        <button className="btn btn-primario" onClick={() => abrir()}><Icono n="mas" />Nuevo empleado</button>
      </div>

      <div className="fila-flex" style={{ alignItems: 'flex-start' }}>
        <section className="tarjeta" style={{ flex: '2 1 560px', overflow: 'hidden' }}>
          <div className="tarjeta-cab">
            <div style={{ flex: '1 1 240px', maxWidth: 360, position: 'relative' }}>
              <label htmlFor="q" className="sr">Buscar por nombre, siglas o email</label>
              <span style={{ position: 'absolute', left: 13, top: 13 }} className="muted"><Icono n="buscar" /></span>
              <input id="q" type="search" className="input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 40, background: 'var(--fondo)' }} />
            </div>
            <span className="muted" style={{ fontSize: 14 }}>{vis.length} de {lista.length}</span>
          </div>
          <div className="scroll-x">
            <div className="tabla" role="table" aria-label="Empleados" style={{ minWidth: 640 }}>
              <div className="tabla-fila tabla-cab" role="row" style={{ gridTemplateColumns: COLS }}>
                <span role="columnheader">Empleado</span><span role="columnheader">Móvil</span><span role="columnheader">Estado</span><span role="columnheader" style={{ textAlign: 'right' }}>Acciones</span>
              </div>
              {cargando && <div className="cargando">Cargando…</div>}
              {vis.map((e) => confirmar === e.id ? (
                <div key={e.id} role="row" style={{ background: 'var(--rojo-claro)', borderTop: '1px solid #f3c9c4', padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7a130a', fontSize: 14 }}><strong>¿Eliminar a {nombreCompleto(e)}?</strong> También se borran sus turnos y excepciones. No se puede deshacer.</span>
                  <span className="acciones">
                    <button className="btn" onClick={() => setConfirmar(null)}>Cancelar</button>
                    <button className="btn btn-primario" onClick={() => borrar(e)}>Eliminar</button>
                  </span>
                </div>
              ) : (
                <div key={e.id} role="row" className="tabla-fila" style={{ gridTemplateColumns: COLS, background: ficha?.id === e.id ? 'var(--fondo-2)' : undefined }}>
                  <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar e={e} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{nombreCompleto(e)} <span className="mono muted" style={{ fontSize: 12 }}>{e.codigo}</span></span>
                      <span style={{ fontSize: 13, color: e.email ? 'var(--gris)' : 'var(--rojo-osc)' }}>{e.email ?? 'Sin email'}</span>
                    </span>
                  </span>
                  <span role="cell" className="mono" style={{ fontSize: 13, color: e.movil ? undefined : 'var(--gris)' }}>{e.movil || '—'}</span>
                  <span role="cell"><span className={`chip ${e.activo ? 'chip-gris' : 'chip-borde'}`}>{e.activo ? 'Activo' : 'De baja'}</span></span>
                  <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Link to={`/admin/horarios/${e.id}`} className="btn btn-icono" aria-label={`Ver horario de ${nombreCompleto(e)}`} title="Ver horario"><Icono n="calendario" /></Link>
                    <button className="btn btn-icono" aria-label={`Editar a ${nombreCompleto(e)}`} title="Editar" onClick={() => abrir(e)}><Icono n="editar" /></button>
                    <button className="btn btn-icono" style={{ color: 'var(--rojo-osc)' }} aria-label={`Eliminar a ${nombreCompleto(e)}`} title="Eliminar" onClick={() => setConfirmar(e.id)}><Icono n="papelera" /></button>
                  </span>
                </div>
              ))}
              {!cargando && !vis.length && <div className="vacio">Ningún empleado coincide.</div>}
            </div>
          </div>
        </section>

        {ficha && (
          <section className="tarjeta ficha" aria-labelledby="ficha-titulo">
            <div className="ficha-barra" />
            <div className="tarjeta-cab">
              <div>
                <h2 id="ficha-titulo">{ficha.id ? 'Editar empleado' : 'Nuevo empleado'}</h2>
                <span className="muted" style={{ fontSize: 14 }}>{ficha.id ? 'Los cambios se aplican al guardar' : 'Después aparecerá en la rotación por sus siglas'}</span>
              </div>
              <button className="btn btn-icono" aria-label="Cerrar ficha" onClick={cerrar}><Icono n="cerrar" /></button>
            </div>
            <form onSubmit={guardar} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12 }}>
                <Campo id="f-n" label="Nombre" valor={ficha.nombre} onChange={set('nombre')} error={errores.nombre} />
                <Campo id="f-c" label="Siglas" valor={ficha.codigo} onChange={set('codigo')} error={errores.codigo} mono />
              </div>
              <Campo id="f-a" label="Apellidos" valor={ficha.apellidos} onChange={set('apellidos')} error={errores.apellidos} />
              <Campo id="f-e" label="Email" tipo="email" valor={ficha.email} onChange={set('email')} error={errores.email} />
              <Campo id="f-m" label="Móvil" opcional tipo="tel" valor={ficha.movil} onChange={set('movil')} mono />
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, cursor: 'pointer' }}>
                <input type="checkbox" checked={ficha.activo} onChange={set('activo')} style={{ width: 18, height: 18, accentColor: 'var(--rojo)' }} />
                Activo (si lo desmarcas deja de aparecer en horarios y envíos)
              </label>
              <div className="aviso aviso-gris"><Icono n="email" />Con este email entrará a ver su horario y recibirá cada mes el PDF.</div>
              {errores.general && <span className="error-txt" role="alert">{errores.general}</span>}
              <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
                <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : ficha.id ? 'Guardar cambios' : 'Crear empleado'}</button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function Campo(p: { id: string; label: string; valor: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; error?: string; tipo?: string; opcional?: boolean; mono?: boolean }) {
  return (
    <div className="campo">
      <label htmlFor={p.id}>{p.label} {p.opcional && <span className="opcional">(opcional)</span>}</label>
      <input id={p.id} type={p.tipo ?? 'text'} className={`input ${p.error ? 'invalido' : ''} ${p.mono ? 'mono' : ''}`} value={p.valor} onChange={p.onChange} aria-invalid={Boolean(p.error)} />
      {p.error && <span className="error-txt">{p.error}</span>}
    </div>
  );
}
