import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutAdmin } from './components/LayoutAdmin';
import { ToastProvider } from './components/Toast';
import { SesionProvider, useSesion, type Rol } from './lib/sesion';
import { configurado } from './lib/supabase';
import { AccesoEmpleado } from './pages/acceso/AccesoEmpleado';
import { Calendario } from './pages/acceso/Calendario';
import { LoginAdmin } from './pages/acceso/LoginAdmin';
import { SinAcceso } from './pages/acceso/SinAcceso';
import { Empleados } from './pages/admin/Empleados';
import { Envios } from './pages/admin/Envios';
import { Escritorio } from './pages/admin/Escritorio';
import { Horarios } from './pages/admin/Horarios';
import { Rotacion } from './pages/admin/Rotacion';
import { MiHorario } from './pages/empleado/MiHorario';

const DESTINO: Record<Rol, string> = { admin: '/admin', empleado: '/mi-horario', 'sin-ficha': '/sin-acceso' };

function Cargando() {
  return <div className="cargando" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>;
}

/** Solo deja pasar al rol indicado; si no hay sesión manda al acceso que toque */
function Solo({ rol, children, login }: { rol: Rol; children: ReactNode; login: string }) {
  const s = useSesion();
  if (s.cargando) return <Cargando />;
  if (!s.sesion) return <Navigate to={login} replace />;
  if (s.rol !== rol) return <Navigate to={DESTINO[s.rol!]} replace />;
  return <>{children}</>;
}

/** Pantallas de acceso: si ya hay sesión, a su sitio */
function Publica({ children }: { children: ReactNode }) {
  const s = useSesion();
  if (s.cargando) return <Cargando />;
  if (s.sesion && s.rol) return <Navigate to={DESTINO[s.rol]} replace />;
  return <>{children}</>;
}

function Inicio() {
  const s = useSesion();
  if (s.cargando) return <Cargando />;
  if (!s.sesion || !s.rol) return <Navigate to="/acceso" replace />;
  return <Navigate to={DESTINO[s.rol]} replace />;
}

export function App() {
  if (!configurado) {
    return <div className="vacio">Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (mira .env.example).</div>;
  }
  return (
    <SesionProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/acceso" element={<Publica><AccesoEmpleado /></Publica>} />
            <Route path="/admin/login" element={<Publica><LoginAdmin /></Publica>} />
            <Route path="/sin-acceso" element={<Solo rol="sin-ficha" login="/acceso"><SinAcceso /></Solo>} />
            <Route path="/mi-horario" element={<Solo rol="empleado" login="/acceso"><MiHorario /></Solo>} />
            <Route path="/admin" element={<Solo rol="admin" login="/admin/login"><LayoutAdmin /></Solo>}>
              <Route index element={<Escritorio />} />
              <Route path="empleados" element={<Empleados />} />
              <Route path="horarios" element={<Horarios />} />
              <Route path="horarios/:id" element={<Horarios />} />
              <Route path="rotacion" element={<Rotacion />} />
              <Route path="envios" element={<Envios />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </SesionProvider>
  );
}
