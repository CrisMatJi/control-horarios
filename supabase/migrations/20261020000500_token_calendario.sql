-- Enlace privado de suscripción al calendario (webcal) por empleado.
-- Quien tenga el enlace ve los turnos de ese empleado, así que es un valor aleatorio y regenerable.
alter table public.empleados add column token_calendario uuid not null default gen_random_uuid();
create unique index empleados_token_calendario on public.empleados (token_calendario);
