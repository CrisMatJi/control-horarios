-- @solo-supabase (usa pg_cron, pg_net y Vault; los tests locales la omiten)
-- Envío automático: el día 25 a las 9:00 (hora de Madrid ≈ 07:00 UTC) se manda el horario del mes siguiente.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Token aleatorio que comparte el cron con la Edge Function (guardado cifrado en Vault)
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_envio_horarios', 'Token para que pg_cron llame a enviar-horarios')
where not exists (select 1 from vault.secrets where name = 'cron_envio_horarios');

create or replace function public.validar_token_cron(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cron_envio_horarios' and decrypted_secret = p_token)
$$;
revoke execute on function public.validar_token_cron(text) from public, anon, authenticated;
grant execute on function public.validar_token_cron(text) to service_role;

-- La URL del proyecto se guarda también en Vault para no fijarla en la migración
select vault.create_secret('https://REEMPLAZAR.supabase.co', 'url_proyecto', 'URL base del proyecto para pg_cron')
where not exists (select 1 from vault.secrets where name = 'url_proyecto');

select cron.schedule(
  'enviar-horarios-mensual',
  '0 7 25 * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'url_proyecto') || '/functions/v1/enviar-horarios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_envio_horarios')
    ),
    body := jsonb_build_object('periodo', to_char(now() + interval '1 month', 'YYYY-MM')),
    timeout_milliseconds := 60000
  );
  $cron$
);
