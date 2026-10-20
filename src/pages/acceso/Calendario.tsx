import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { urlCalendario, webcalCalendario } from '../../lib/supabase';

const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esAndroid = () => /Android/i.test(navigator.userAgent);

/** Página pública a la que lleva el email: suscribe el calendario del móvil con el enlace privado */
export function Calendario({ token: tokenProp }: { token?: string }) {
  const [params] = useSearchParams();
  const token = tokenProp ?? params.get('t') ?? '';
  const [copiado, setCopiado] = useState(false);
  const valido = /^[0-9a-f-]{36}$/i.test(token);

  useEffect(() => {
    // En iPhone abrimos directamente la suscripción: el sistema pregunta "¿Suscribirse?"
    if (valido && !tokenProp && esIOS()) window.location.href = webcalCalendario(token);
  }, [token, valido, tokenProp]);

  if (!valido) return <div className="vacio">Este enlace de calendario no es válido.</div>;

  const copiar = async () => {
    await navigator.clipboard.writeText(urlCalendario(token));
    setCopiado(true);
  };

  const contenido = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <a className="btn btn-primario btn-grande" href={webcalCalendario(token)}>
        <Icono n="calendario" t={20} />Suscribirme en mi calendario
      </a>
      <span className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--carbon)' }}>iPhone / Mac:</strong> pulsa el botón y acepta «Suscribirse». Los turnos aparecen en un calendario «Horario DeMÁT» y se actualizan solos.
      </span>
      <span className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--carbon)' }}>Android (Google Calendar):</strong> copia el enlace y, desde un navegador, entra en calendar.google.com → «Otros calendarios» → <em>+</em> → «Desde URL» y pégalo. Después aparece también en el móvil.
      </span>
      <button className="btn" onClick={copiar}><Icono n={copiado ? 'check' : 'descargar'} />{copiado ? 'Enlace copiado' : 'Copiar enlace para Google Calendar'}</button>
      <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>El enlace es personal: no lo compartas, da acceso a tus turnos.</span>
    </div>
  );

  if (tokenProp) return contenido;
  return (
    <div className="emp" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 6, background: 'var(--rojo)' }} />
      <main style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DeMÁT" style={{ width: 150 }} />
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Añade tus turnos al calendario</h1>
        <div className="tarjeta" style={{ padding: 20 }}>{contenido}</div>
        {esAndroid() && <span className="muted" style={{ fontSize: 13 }}>Si usas Samsung Calendar, el botón de arriba también funciona.</span>}
        <Link to="/acceso" style={{ fontSize: 14 }}>Ver mi horario en la web</Link>
      </main>
    </div>
  );
}
