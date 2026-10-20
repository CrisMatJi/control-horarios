// Ejecuta las migraciones y el seed en un Postgres embebido (PGlite)
// con un esquema auth simulado, y comprueba el cálculo del horario y RLS.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const AUTH_STUB = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', nullif(current_setting('test.email', true), '')) $$;
create role anon nologin; create role authenticated nologin;
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
`;

let db: PGlite;
const como = async (uid: string | null, email: string | null) => {
  await db.exec(`reset role; select set_config('test.uid', '${uid ?? ''}', false), set_config('test.email', '${email ?? ''}', false);`);
  if (uid) await db.exec('set role authenticated;');
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of readdirSync('supabase/migrations').sort()) {
    const sql = readFileSync(`supabase/migrations/${f}`, 'utf8');
    if (!sql.startsWith('-- @solo-supabase')) await db.exec(sql);
  }
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  await db.exec(`
    insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'admin@test.es');
    insert into public.admins select '00000000-0000-0000-0000-00000000000a', id from public.empresas;
    update public.empleados set email = 'vs@test.es' where codigo = 'VS';
    update public.empleados set email = 'ej@test.es' where codigo = 'EJ';
    grant all on all tables in schema public to authenticated;
  `);
}, 60_000);

const turnosDe = async (codigo: string, desde: string, hasta: string) => {
  const r = await db.query<{ fecha: string; inicio: string; fin: string }>(
    `select to_char(h.fecha,'YYYY-MM-DD') fecha, to_char(h.inicio,'HH24:MI') inicio, to_char(h.fin,'HH24:MI') fin
     from public.horario($1, $2) h join public.empleados e on e.id = h.empleado_id where e.codigo = $3`,
    [desde, hasta, codigo],
  );
  return r.rows.map((x) => `${x.fecha} ${x.inicio}-${x.fin}`);
};

describe('rotación', () => {
  it('calcula la semana de rotación respecto al ancla (19/10/2026 = semana 2)', async () => {
    await como(null, null);
    const r = await db.query<{ s: number }>(`select public.semana_rotacion(6, '2026-10-19', 2, d::date) s from unnest(array['2026-10-19','2026-10-25','2026-10-26','2026-10-12','2026-09-28','2026-11-30']) d`);
    expect(r.rows.map((x) => x.s)).toEqual([2, 2, 3, 1, 5, 2]); // 30/11 = 6 semanas después → vuelve a la 2
  });

  it('genera el horario de VS de esta semana', async () => {
    await como('00000000-0000-0000-0000-00000000000a', 'admin@test.es');
    expect(await turnosDe('VS', '2026-10-19', '2026-10-25')).toEqual([
      '2026-10-19 10:00-14:00', '2026-10-19 15:00-20:00',
      '2026-10-20 10:00-14:00', '2026-10-20 15:00-20:00',
      '2026-10-21 10:00-14:00', '2026-10-21 15:00-20:00',
      '2026-10-22 08:00-15:00',
      '2026-10-23 08:00-14:00',
    ]);
  });

  it('aplica excepciones: día libre y cambio puntual', async () => {
    await como('00000000-0000-0000-0000-00000000000a', 'admin@test.es');
    await db.exec(`
      insert into public.excepciones (empleado_id, fecha, tipo) select id, '2026-10-19', 'LIBRE' from public.empleados where codigo = 'VS';
      insert into public.excepciones (empleado_id, fecha, tipo, inicio, fin) select id, '2026-10-20', 'CAMBIO', '09:00', '13:00' from public.empleados where codigo = 'VS';
    `);
    const t = await turnosDe('VS', '2026-10-19', '2026-10-20');
    expect(t).toEqual(['2026-10-20 09:00-13:00']);
  });
});

describe('seguridad (RLS)', () => {
  it('un empleado solo ve sus propios turnos', async () => {
    await como('00000000-0000-0000-0000-0000000000e1', 'ej@test.es');
    const r = await db.query<{ codigo: string }>(
      `select distinct e.codigo from public.horario('2026-10-01','2026-10-31') h join public.empleados e on e.id = h.empleado_id`);
    expect(r.rows.map((x) => x.codigo)).toEqual(['EJ']);
    const emp = await db.query(`select codigo from public.empleados`);
    expect(emp.rows).toHaveLength(1);
  });

  it('un usuario sin ficha de empleado no ve nada', async () => {
    await como('00000000-0000-0000-0000-0000000000ff', 'desconocido@test.es');
    const r = await db.query(`select * from public.horario('2026-10-01','2026-10-31')`);
    expect(r.rows).toHaveLength(0);
  });

  it('un empleado no puede crear excepciones', async () => {
    await como('00000000-0000-0000-0000-0000000000e1', 'ej@test.es');
    await expect(db.exec(`insert into public.excepciones (empleado_id, fecha, tipo) select privado.mi_empleado_id(), '2026-10-28', 'LIBRE'`)).rejects.toThrow();
  });
});

describe('la web y SQL calculan igual la semana', () => {
  it('300 fechas alrededor del ancla dan la misma semana', async () => {
    const { semanaRotacion, sumarDias } = await import('../supabase/functions/_shared/horario.ts');
    await como(null, null);
    const fechas = Array.from({ length: 300 }, (_, i) => sumarDias('2026-01-01', i * 3));
    const r = await db.query<{ s: number }>(`select public.semana_rotacion(6, '2026-10-19', 2, d::date) s from unnest($1::text[]) d`, [fechas]);
    expect(r.rows.map((x) => x.s)).toEqual(fechas.map((f) => semanaRotacion({ semanas: 6, ancla_lunes: '2026-10-19', ancla_semana: 2 }, f)));
  });
});
