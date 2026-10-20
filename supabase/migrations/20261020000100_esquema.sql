-- Control de horarios · esquema base
-- El horario de un día se calcula desde la rotación (plantilla de N semanas)
-- y se corrige con excepciones (día libre, cambio puntual, vacaciones…).

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

create table public.departamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);

create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  codigo text not null,                       -- siglas tal como aparecen en la hoja (VS, EJ…)
  nombre text not null,
  apellidos text not null default '',
  email text,                                 -- obligatorio en el formulario; nulo solo en datos iniciales
  movil text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint empleados_codigo_unico unique (departamento_id, codigo)
);
create unique index empleados_email_unico on public.empleados (lower(email)) where email is not null;

-- Usuarios de Supabase Auth con permisos de administración
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.rotaciones (
  id uuid primary key default gen_random_uuid(),
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  nombre text not null,
  semanas int not null check (semanas between 1 and 12),
  ancla_lunes date not null check (extract(isodow from ancla_lunes) = 1),
  ancla_semana int not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  constraint rotaciones_ancla_valida check (ancla_semana between 1 and semanas)
);
create unique index rotaciones_una_activa on public.rotaciones (departamento_id) where activa;

-- Un tramo de trabajo; un turno partido son dos filas
create table public.turnos_plantilla (
  id uuid primary key default gen_random_uuid(),
  rotacion_id uuid not null references public.rotaciones(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  semana int not null check (semana >= 1),
  dia_semana int not null check (dia_semana between 1 and 7),  -- 1 = lunes
  inicio time not null,
  fin time not null,
  constraint turnos_plantilla_orden check (fin > inicio)
);
create index turnos_plantilla_busqueda on public.turnos_plantilla (rotacion_id, semana, dia_semana);
create index turnos_plantilla_empleado on public.turnos_plantilla (empleado_id);

-- LIBRE: anula la plantilla ese día. CAMBIO: sustituye la plantilla por sus tramos.
-- VACACIONES / BAJA: como LIBRE pero con motivo.
create table public.excepciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('LIBRE', 'CAMBIO', 'VACACIONES', 'BAJA')),
  inicio time,
  fin time,
  nota text,
  lote uuid,                                   -- agrupa las creadas juntas (p. ej. "vaciar mes") para poder deshacer
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint excepciones_tramo check (
    (tipo = 'CAMBIO' and inicio is not null and fin is not null and fin > inicio)
    or (tipo <> 'CAMBIO' and inicio is null and fin is null)
  )
);
create index excepciones_empleado_fecha on public.excepciones (empleado_id, fecha);

create table public.envios (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  estado text not null check (estado in ('ENVIADO', 'ERROR', 'SIN_EMAIL')),
  detalle text,
  created_at timestamptz not null default now()
);
create index envios_empleado on public.envios (empleado_id, created_at desc);
