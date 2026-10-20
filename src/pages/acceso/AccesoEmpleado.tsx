import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { supabase, urlApp } from '../../lib/supabase';

export function AccesoEmpleado() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'enviado'>('inicio');
  const [error, setError] = useState('');

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError('Escribe un email válido.'); return; }
    setEstado('enviando');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: urlApp() } });
    if (error) {
      setEstado('inicio');
      setError(error.status === 429 ? 'Has pedido varios enlaces seguidos. Espera un minuto y vuelve a intentarlo.' : 'No se ha podido enviar el enlace. Inténtalo de nuevo.');
      return;
    }
    setEstado('enviado');
  };

  return (
    <div className="emp" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 6, background: 'var(--rojo)' }} />
      <main style={{ flex: 1, width: '100%', maxWidth: 440, margin: '0 auto', padding: '40px 20px 32px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DeMÁT" style={{ width: 160 }} />
        {estado !== 'enviado' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h1 style={{ fontSize: 30, fontWeight: 800 }}>Consulta tu horario</h1>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: 'var(--carbon-2)' }}>
                Escribe el email en el que recibes los horarios. Te enviaremos un enlace para entrar, sin contraseña.
              </p>
            </div>
            <form className="tarjeta" onSubmit={enviar} style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="campo">
                <label htmlFor="em">Tu email</label>
                <input id="em" className={`input ${error ? 'invalido' : ''}`} style={{ height: 52, fontSize: 17 }} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {error && <span className="error-txt" role="alert">{error}</span>}
              </div>
              <button className="btn btn-primario btn-grande" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Enviarme el enlace'}</button>
              <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Abre el enlace en este mismo móvil o navegador. Si tu email no está dado de alta, habla con tu responsable.</span>
            </form>
          </>
        ) : (
          <div className="tarjeta" style={{ padding: '28px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--rojo-claro)', color: 'var(--rojo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icono n="email" t={28} /></span>
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>Revisa tu correo</h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: 'var(--carbon-2)' }}>
              Hemos enviado un enlace a <strong>{email}</strong>. Ábrelo desde este dispositivo para entrar.
            </p>
            <button className="btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => setEstado('inicio')}>Usar otro email</button>
          </div>
        )}
        <div style={{ marginTop: 'auto', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }} className="muted">
          <span>Una vez dentro, la sesión se mantiene en este dispositivo.</span>
          <Link to="/admin/login">Acceso para administración</Link>
        </div>
      </main>
    </div>
  );
}
