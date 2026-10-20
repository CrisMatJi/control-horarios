import { useSesion } from '../../lib/sesion';

export function SinAcceso() {
  const { sesion, salir } = useSesion();
  return (
    <div className="acceso-form" style={{ minHeight: '100vh' }}>
      <div className="caja">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DeMÁT" />
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Tu email no está dado de alta</h1>
        <p style={{ margin: 0, lineHeight: 1.55 }} className="muted">
          Has entrado como <strong>{sesion?.user.email}</strong>, pero no aparece en la lista de empleados. Pide a tu responsable que lo añada y vuelve a entrar.
        </p>
        <button className="btn" onClick={salir}>Salir</button>
      </div>
    </div>
  );
}
