import { iniciales, type Empleado } from '../lib/tipos';

const COLORES = ['#23231F', '#BD1E10', '#5E5F57', '#7A130A'];

export function Avatar({ e, t = 36 }: { e: Pick<Empleado, 'nombre' | 'apellidos' | 'codigo'>; t?: number }) {
  const h = [...e.codigo].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span className="avatar" aria-hidden="true" style={{ width: t, height: t, fontSize: Math.round(t * 0.36), background: COLORES[h % COLORES.length] }}>
      {iniciales(e)}
    </span>
  );
}
