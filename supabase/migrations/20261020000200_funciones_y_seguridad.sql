-- Funciones de apoyo, cálculo del horario y Row Level Security

-- ── Quién es quién ───────────────────────────────────────────────────────────
create or replace function public.admin_empresa()
returns uuid language sql stable security definer set search_path = '' as $$
  select a.empresa_id from public.admins a where a.user_id = (select auth.uid())
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
$$;

-- Empleado vinculado al email de la sesión (acceso por enlace mágico)
create or replace function public.mi_empleado_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.empleados e
  where e.activo and e.email is not null
    and lower(e.email) = lower((select auth.jwt()) ->> 'email')
  limit 1
$$;

create or replace function public.admin_de_departamento(dep uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.departamentos d
    join public.admins a on a.empresa_id = d.empresa_id
    where d.id = dep and a.user_id = (select auth.uid())
  )
$$;

create or replace function public.admin_de_empleado(emp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.empleados e
    join public.departamentos d on d.id = e.departamento_id
    join public.admins a on a.empresa_id = d.empresa_id
    where e.id = emp and a.user_id = (select auth.uid())
  )
$$;

create or replace function public.mi_departamento_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.departamento_id from public.empleados e where e.id = public.mi_empleado_id()
$$;

-- ── Rotación ─────────────────────────────────────────────────────────────────
-- Semana de la rotación (1..semanas) en la que cae una fecha
create or replace function public.semana_rotacion(semanas int, ancla_lunes date, ancla_semana int, fecha date)
returns int language sql immutable set search_path = '' as $$
  select (((floor((fecha - ancla_lunes)::numeric / 7)::int + ancla_semana - 1) % semanas) + semanas) % semanas + 1
$$;

-- Horario efectivo entre dos fechas: plantilla + excepciones.
-- SECURITY INVOKER: cada usuario solo obtiene las filas que RLS le deja ver.
create or replace function public.horario(p_desde date, p_hasta date, p_empleado uuid default null)
returns table (fecha date, empleado_id uuid, inicio time, fin time, origen text)
language sql stable security invoker set search_path = '' as $$
  with dias as (
    select d::date as fecha
    from generate_series(p_desde, least(p_hasta, p_desde + 400), interval '1 day') d
  ),
  anulados as (
    select x.empleado_id, x.fecha from public.excepciones x
    where x.fecha between p_desde and p_hasta and x.tipo <> 'CAMBIO'
  ),
  con_cambio as (
    select distinct x.empleado_id, x.fecha from public.excepciones x
    where x.fecha between p_desde and p_hasta and x.tipo = 'CAMBIO'
  ),
  plantilla as (
    select d.fecha, t.empleado_id, t.inicio, t.fin, 'PLANTILLA'::text as origen
    from dias d
    join public.rotaciones r on r.activa
    join public.turnos_plantilla t
      on t.rotacion_id = r.id
     and t.dia_semana = extract(isodow from d.fecha)::int
     and t.semana = public.semana_rotacion(r.semanas, r.ancla_lunes, r.ancla_semana, d.fecha)
    join public.empleados e on e.id = t.empleado_id and e.activo
    where (p_empleado is null or t.empleado_id = p_empleado)
      and not exists (select 1 from anulados a where a.empleado_id = t.empleado_id and a.fecha = d.fecha)
      and not exists (select 1 from con_cambio c where c.empleado_id = t.empleado_id and c.fecha = d.fecha)
  ),
  cambios as (
    select x.fecha, x.empleado_id, x.inicio, x.fin, 'CAMBIO'::text
    from public.excepciones x
    join public.empleados e on e.id = x.empleado_id and e.activo
    where x.tipo = 'CAMBIO' and x.fecha between p_desde and p_hasta
      and (p_empleado is null or x.empleado_id = p_empleado)
      and not exists (select 1 from anulados a where a.empleado_id = x.empleado_id and a.fecha = x.fecha)
  )
  select * from plantilla
  union all
  select * from cambios
  order by 1, 2, 3
$$;

-- Sustituye la rotación activa de un departamento de forma atómica.
-- p_turnos: [{"empleado_id": uuid, "semana": 1, "dia_semana": 1, "inicio": "09:30", "fin": "14:00"}, …]
create or replace function public.guardar_rotacion(
  p_departamento uuid, p_nombre text, p_semanas int,
  p_ancla_lunes date, p_ancla_semana int, p_turnos jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.admin_de_departamento(p_departamento) then
    raise exception 'Sin permiso sobre este departamento' using errcode = '42501';
  end if;
  update public.rotaciones set activa = false where departamento_id = p_departamento and activa;
  insert into public.rotaciones (departamento_id, nombre, semanas, ancla_lunes, ancla_semana)
  values (p_departamento, p_nombre, p_semanas, p_ancla_lunes, p_ancla_semana)
  returning id into v_id;
  insert into public.turnos_plantilla (rotacion_id, empleado_id, semana, dia_semana, inicio, fin)
  select v_id, (t ->> 'empleado_id')::uuid, (t ->> 'semana')::int, (t ->> 'dia_semana')::int,
         (t ->> 'inicio')::time, (t ->> 'fin')::time
  from jsonb_array_elements(p_turnos) t;
  return v_id;
end
$$;

revoke execute on function public.guardar_rotacion(uuid, text, int, date, int, jsonb) from anon;
revoke execute on function public.horario(date, date, uuid) from anon;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.empresas enable row level security;
alter table public.departamentos enable row level security;
alter table public.empleados enable row level security;
alter table public.admins enable row level security;
alter table public.rotaciones enable row level security;
alter table public.turnos_plantilla enable row level security;
alter table public.excepciones enable row level security;
alter table public.envios enable row level security;

create policy "admin ve su empresa" on public.empresas for select to authenticated
  using (id = (select public.admin_empresa()));

create policy "admin ve su fila" on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "admin gestiona departamentos" on public.departamentos for all to authenticated
  using (empresa_id = (select public.admin_empresa()))
  with check (empresa_id = (select public.admin_empresa()));
create policy "empleado ve su departamento" on public.departamentos for select to authenticated
  using (id = (select public.mi_departamento_id()));

create policy "admin gestiona empleados" on public.empleados for all to authenticated
  using (public.admin_de_departamento(departamento_id))
  with check (public.admin_de_departamento(departamento_id));
create policy "empleado ve su ficha" on public.empleados for select to authenticated
  using (id = (select public.mi_empleado_id()));

create policy "admin gestiona rotaciones" on public.rotaciones for all to authenticated
  using (public.admin_de_departamento(departamento_id))
  with check (public.admin_de_departamento(departamento_id));
create policy "empleado ve la rotacion de su departamento" on public.rotaciones for select to authenticated
  using (departamento_id = (select public.mi_departamento_id()));

create policy "admin gestiona plantilla" on public.turnos_plantilla for all to authenticated
  using (public.admin_de_empleado(empleado_id))
  with check (public.admin_de_empleado(empleado_id));
create policy "empleado ve sus turnos" on public.turnos_plantilla for select to authenticated
  using (empleado_id = (select public.mi_empleado_id()));

create policy "admin gestiona excepciones" on public.excepciones for all to authenticated
  using (public.admin_de_empleado(empleado_id))
  with check (public.admin_de_empleado(empleado_id));
create policy "empleado ve sus excepciones" on public.excepciones for select to authenticated
  using (empleado_id = (select public.mi_empleado_id()));

create policy "admin ve envios" on public.envios for select to authenticated
  using (public.admin_de_empleado(empleado_id));
