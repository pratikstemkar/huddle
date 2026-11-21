-- The send-push function checks the caller's x-push-secret against Vault itself, so the secret lives in
-- one place (Vault's push_function_secret) instead of also being copied into a function secret.
-- Service role only: the function calls it with its own service-role client.

create function public.push_secret_ok(candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(candidate, '') <> ''
     and exists (
       select 1 from vault.decrypted_secrets
       where name = 'push_function_secret'
         -- Compare digests so the check doesn't leak how much of the secret matched.
         and extensions.digest(decrypted_secret, 'sha256') = extensions.digest(candidate, 'sha256')
     );
$$;

revoke all on function public.push_secret_ok(text) from public, anon, authenticated;
grant execute on function public.push_secret_ok(text) to service_role;
