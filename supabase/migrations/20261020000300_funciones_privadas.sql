-- Las funciones auxiliares de seguridad pasan a un esquema que no expone la API REST.
-- Las políticas siguen usándolas, pero ya no se pueden llamar por /rest/v1/rpc.

create schema if not exists privado;
grant usage on schema privado to authenticated;

alter function public.admin_empresa() set schema privado;
alter function public.mi_empleado_id() set schema privado;
alter function public.admin_de_departamento(uuid) set schema privado;
alter function public.admin_de_empleado(uuid) set schema privado;
alter function public.mi_departamento_id() set schema privado;

-- Las funciones referencian a otras por nombre cualificado: se recrean las que llaman a mi_empleado_id
create or replace function privado.mi_departamento_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.departamento_id from public.empleados e where e.id = privado.mi_empleado_id()
$$;

revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated;

-- es_admin la usa la web: pasa a SECURITY INVOKER (lee su propia fila de admins vía RLS)
create or replace function public.es_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
$$;
revoke execute on function public.es_admin() from anon;

-- guardar_rotacion usaba la versión pública del helper
create or replace function public.guardar_rotacion(
  p_departamento uuid, p_nombre text, p_semanas int,
  p_ancla_lunes date, p_ancla_semana int, p_turnos jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if not privado.admin_de_departamento(p_departamento) then
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
revoke execute on function public.semana_rotacion(int, date, int, date) from anon;
