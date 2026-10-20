import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { Icono } from './Icono';

const ITEMS = [
  { to: '/admin', label: 'Escritorio', icono: 'escritorio', end: true },
  { to: '/admin/empleados', label: 'Empleados', icono: 'empleados' },
  { to: '/admin/horarios', label: 'Horarios', icono: 'calendario' },
  { to: '/admin/rotacion', label: 'Rotación', icono: 'rotacion' },
  { to: '/admin/envios', label: 'Envíos', icono: 'email' },
];

export function LayoutAdmin() {
  const { sesion, salir } = useSesion();
  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DeMÁT" />
          <span className="etiqueta muted">Control de horarios</span>
        </div>
        <nav aria-label="Menú principal">
          {ITEMS.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className="nav-item">
              <Icono n={i.icono} t={20} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-pie">
          <span className="avatar" aria-hidden="true" style={{ width: 38, height: 38, background: '#23231F', fontSize: 14 }}>AD</span>
          <span className="quien">
            <strong style={{ fontSize: 14 }}>Administración</strong>
            <span className="muted">{sesion?.user.email}</span>
          </span>
          <button className="btn btn-icono" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={salir}><Icono n="salir" t={20} /></button>
        </div>
      </aside>
      <div className="contenido"><Outlet /></div>
    </div>
  );
}
