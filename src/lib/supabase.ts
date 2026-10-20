import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'sin-configurar', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const EMPRESA = (import.meta.env.VITE_EMPRESA as string | undefined) ?? 'DeMÁT';

/** URL pública de la app (respeta la base de GitHub Pages) */
export const urlApp = (ruta = '') => `${window.location.origin}${import.meta.env.BASE_URL}${ruta}`;

/** Enlace de suscripción al calendario de un empleado (https para Google, webcal para iPhone/Mac) */
export const urlCalendario = (token: string) => `${url}/functions/v1/calendario?t=${token}`;
export const webcalCalendario = (token: string) => urlCalendario(token).replace(/^https?:/, 'webcal:');
