-- Pin the search path of the two notification helpers (Supabase advisor: function_search_path_mutable).
-- Both only use built-ins, which pg_catalog always provides, so an empty path is enough.

alter function public.notification_category(text) set search_path = '';
alter function public.short_range(date, date) set search_path = '';
