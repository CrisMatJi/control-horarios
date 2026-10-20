import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { supabase } from './supabase';
import type { Empleado } from './tipos';

export type Rol = 'admin' | 'empleado' | 'sin-ficha';
type Estado = { cargando: boolean; sesion: Session | null; rol: Rol | null; empleado: Empleado | null; salir: () => Promise<void> };

const Ctx = createContext<Estado>({ cargando: true, sesion: null, rol: null, empleado: null, salir: async () => {} });

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const resolver = async (s: Session | null) => {
      if (!vivo) return;
      setSesion(s);
      if (!s) { setRol(null); setEmpleado(null); setCargando(false); return; }
      setCargando(true);
      try {
        const { data: esAdmin } = await supabase.rpc('es_admin');
        if (esAdmin) { setRol('admin'); setEmpleado(null); }
        else {
          const e = await api.miEmpleado();
          setEmpleado(e);
          setRol(e ? 'empleado' : 'sin-ficha');
        }
      } finally {
        if (vivo) setCargando(false);
      }
    };
    supabase.auth.getSession().then(({ data }) => resolver(data.session));
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        // fuera del callback para no bloquear el cliente de auth
        setTimeout(() => resolver(s), 0);
      }
    });
    return () => { vivo = false; data.subscription.unsubscribe(); };
  }, []);

  const salir = async () => { await supabase.auth.signOut(); };
  return <Ctx.Provider value={{ cargando, sesion, rol, empleado, salir }}>{children}</Ctx.Provider>;
}

export const useSesion = () => useContext(Ctx);
