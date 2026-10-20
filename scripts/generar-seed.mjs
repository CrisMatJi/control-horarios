// Genera supabase/seed.sql a partir de data/rotacion-ceramica.json
// Uso: node scripts/generar-seed.mjs [ruta-json] [empresa]
import { readFileSync, writeFileSync } from 'node:fs';

const ruta = process.argv[2] ?? 'data/rotacion-ceramica.json';
const empresa = process.argv[3] ?? 'DeMÁT';
const rot = JSON.parse(readFileSync(ruta, 'utf8'));
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const turnos = [];
for (const [semana, dias] of Object.entries(rot.semanas)) {
  for (const [dia, porEmpleado] of Object.entries(dias)) {
    const diaSemana = DIAS.indexOf(dia) + 1;
    if (diaSemana < 1) throw new Error(`Día desconocido: ${dia}`);
    for (const [codigo, tramos] of Object.entries(porEmpleado)) {
      for (const t of tramos) turnos.push(`(${q(codigo)}, ${Number(semana)}, ${diaSemana}, ${q(t.inicio)}, ${q(t.fin)})`);
    }
  }
}

const sql = `-- Generado por scripts/generar-seed.mjs desde ${ruta}. No editar a mano.
do $$
declare
  v_empresa uuid;
  v_dep uuid;
  v_rot uuid;
begin
  insert into public.empresas (nombre) values (${q(empresa)}) returning id into v_empresa;
  insert into public.departamentos (empresa_id, nombre) values (v_empresa, ${q(rot.departamento)}) returning id into v_dep;

  insert into public.empleados (departamento_id, codigo, nombre)
  select v_dep, c, c from unnest(array[${rot.empleados.map((e) => q(e.codigo)).join(', ')}]) as c;

  insert into public.rotaciones (departamento_id, nombre, semanas, ancla_lunes, ancla_semana)
  values (v_dep, ${q(`Rotación ${rot.departamento}`)}, ${rot.semanas_rotacion}, ${q(rot.ancla.lunes)}, ${rot.ancla.semana})
  returning id into v_rot;

  insert into public.turnos_plantilla (rotacion_id, empleado_id, semana, dia_semana, inicio, fin)
  select v_rot, e.id, t.semana, t.dia, t.inicio::time, t.fin::time
  from (values
    ${turnos.join(',\n    ')}
  ) as t(codigo, semana, dia, inicio, fin)
  join public.empleados e on e.departamento_id = v_dep and e.codigo = t.codigo;
end $$;
`;
writeFileSync('supabase/seed.sql', sql);
console.log(`seed.sql: ${rot.empleados.length} empleados, ${turnos.length} tramos`);
