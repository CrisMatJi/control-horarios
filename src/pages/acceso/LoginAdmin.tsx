import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from '../../components/Icono';
import { supabase, urlApp } from '../../lib/supabase';

export function LoginAdmin() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setEnviando(false);
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: urlApp() } });
    if (error) setError('El acceso con Google no está activado todavía.');
  };

  return (
    <div className="acceso">
      <section className="acceso-marca">
        <span className="etiqueta" style={{ color: '#C9CAC0' }}>Control de horarios</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1>Los turnos de todo el equipo, en un solo panel.</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: '#D6D7CE', maxWidth: 480 }}>
            Carga la rotación una vez, ajusta los días sueltos y envía a cada empleado su horario del mes por email.
          </p>
        </div>
        <span style={{ fontSize: 13, color: '#A8A99E' }}>Materiales y Aplicaciones para la Construcción, S.L.</span>
      </section>
      <section className="acceso-form">
        <form onSubmit={entrar}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DeMÁT" />
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>Iniciar sesión</h2>
            <span className="muted">Acceso para administración</span>
          </div>
          <div className="campo">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="pass">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input id="pass" className="input" type={ver ? 'text' : 'password'} autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} style={{ paddingRight: 48 }} />
              <button type="button" className="btn btn-icono" style={{ position: 'absolute', right: 2, top: 2 }} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVer(!ver)}>
                <Icono n="ojo" t={18} />
              </button>
            </div>
          </div>
          {error && <span className="error-txt" role="alert">{error}</span>}
          <button className="btn btn-primario btn-grande" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
          <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }} className="muted">
            <span style={{ flex: 1, height: 1, background: 'var(--linea)' }} />o<span style={{ flex: 1, height: 1, background: 'var(--linea)' }} />
          </div>
          <button type="button" className="btn btn-grande" onClick={google}>Continuar con Google</button>
          <Link to="/acceso" style={{ fontSize: 14, textAlign: 'center' }}>¿Eres empleado? Consulta tu horario</Link>
        </form>
      </section>
    </div>
  );
}
