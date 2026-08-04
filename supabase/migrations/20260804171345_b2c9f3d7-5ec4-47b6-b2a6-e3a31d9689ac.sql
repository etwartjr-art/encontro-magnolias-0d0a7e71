create table if not exists public.thebank_webhook_logs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now(),
    payload jsonb,
    status_code integer,
    method text,
    processed_status text, -- 'success', 'error', 'no_match'
    error_message text,
    event_type text -- inferred from payload if possible
);

grant select on public.thebank_webhook_logs to authenticated;
grant all on public.thebank_webhook_logs to service_role;

alter table public.thebank_webhook_logs enable row level security;

create policy "Admins can see logs"
on public.thebank_webhook_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));
