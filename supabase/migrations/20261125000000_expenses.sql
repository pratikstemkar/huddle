-- Splitting costs. Amounts are integers in the currency's minor unit (paise for INR).
--
-- An expense is paid by one person and split equally between some members. The shares are worked out
-- here, in one transaction, so they always add up to the amount; the app never writes shares itself.
-- A settlement records one person paying another back.
--
-- People who leave keep their place in the money: their expenses, shares and settlements stay, and
-- trip-mates can still see their names. Deleting an account sets that person to null everywhere,
-- which writes off their debts pair by pair (the app skips null people when it adds up balances).

alter table public.trips
  add column currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  category text not null default 'other' check (category in ('stay', 'travel', 'food', 'other')),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  paid_by uuid references public.profiles (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  share_minor bigint not null check (share_minor >= 0),
  unique (expense_id, user_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_user uuid references public.profiles (id) on delete set null,
  to_user uuid references public.profiles (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index on public.expenses (trip_id, created_at);
create index on public.expenses (paid_by);
create index on public.expenses (created_by);
create index on public.expense_shares (expense_id);
create index on public.expense_shares (trip_id);
create index on public.expense_shares (user_id);
create index on public.settlements (trip_id);
create index on public.settlements (from_user);
create index on public.settlements (to_user);
create index on public.settlements (created_by);

alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;

-- Whether a person belongs to a trip's money: a current member, or someone who left but still has an
-- expense, a share or a settlement in it.
create function public.in_trip_money(t uuid, p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members m where m.trip_id = t and m.user_id = p)
      or exists (select 1 from expense_shares s where s.trip_id = t and s.user_id = p)
      or exists (select 1 from expenses e where e.trip_id = t and e.paid_by = p)
      or exists (select 1 from settlements x where x.trip_id = t and p in (x.from_user, x.to_user));
$$;

create policy "members read expenses" on public.expenses for select using (public.is_member(trip_id));
-- The shares go with the expense (on delete cascade).
create policy "remove own expenses" on public.expenses for delete
  using (public.is_member(trip_id) and (created_by = auth.uid() or public.is_organiser(trip_id)));

create policy "members read shares" on public.expense_shares for select using (public.is_member(trip_id));
-- No insert or update policies on expenses or shares: writes go through save_expense() only.

create policy "members read settlements" on public.settlements for select using (public.is_member(trip_id));
-- You record a payment you made or received, with someone in this trip's money.
create policy "record a settlement you're part of" on public.settlements for insert with check (
  created_by = auth.uid()
  and auth.uid() in (from_user, to_user)
  and public.is_member(trip_id)
  and public.in_trip_money(trip_id, from_user)
  and public.in_trip_money(trip_id, to_user)
);
create policy "undo own settlement" on public.settlements for delete
  using (created_by = auth.uid() and public.is_member(trip_id));

grant select, delete on public.expenses to authenticated;
grant select on public.expense_shares to authenticated;
grant select, insert, delete on public.settlements to authenticated;
revoke insert, update on public.expenses from anon, authenticated;
revoke insert, update, delete on public.expense_shares from anon, authenticated;
revoke update on public.settlements from anon, authenticated;

-- Adds an expense (`expense` null) or replaces one, splitting it equally between `split_with`.
-- The remainder of the division goes one unit each to the first people by user id, so the shares
-- always add up to the amount. Only the author or an organiser edits an expense.
-- Everyone named must be a current member, or already on this expense (someone who has since left).
create function public.save_expense(
  t uuid, expense uuid, title text, category text, amount_minor bigint, paid_by uuid, split_with uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e uuid := save_expense.expense;
  people uuid[];
  n int;
  base bigint;
  rem bigint;
begin
  if auth.uid() is null or not is_member(save_expense.t) then
    raise exception 'Not in this trip' using errcode = '42501';
  end if;
  if save_expense.paid_by is null then
    raise exception 'Pick who paid' using errcode = 'P0001';
  end if;
  if save_expense.amount_minor is null or save_expense.amount_minor <= 0 then
    raise exception 'The amount must be more than zero' using errcode = 'P0001';
  end if;

  people := array(
    select distinct q.uid from unnest(save_expense.split_with) as q(uid) where q.uid is not null order by q.uid
  );
  n := coalesce(cardinality(people), 0);
  if n = 0 then
    raise exception 'Pick who to split with' using errcode = 'P0001';
  end if;

  if e is not null and not exists (select 1 from expenses x where x.id = e and x.trip_id = save_expense.t) then
    raise exception 'That expense is not part of this trip' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from unnest(people || save_expense.paid_by) as q(uid)
    where not exists (select 1 from trip_members m where m.trip_id = save_expense.t and m.user_id = q.uid)
      and not (e is not null and (
        exists (select 1 from expense_shares s where s.expense_id = e and s.user_id = q.uid)
        or exists (select 1 from expenses x where x.id = e and x.paid_by = q.uid)
      ))
  ) then
    raise exception 'Everyone in the split must be in the trip' using errcode = 'P0001';
  end if;

  if e is null then
    insert into expenses (trip_id, title, category, amount_minor, paid_by, created_by)
    values (save_expense.t, btrim(save_expense.title), save_expense.category, save_expense.amount_minor,
            save_expense.paid_by, auth.uid())
    returning expenses.id into e;
  else
    update expenses x
       set title = btrim(save_expense.title),
           category = save_expense.category,
           amount_minor = save_expense.amount_minor,
           paid_by = save_expense.paid_by,
           updated_at = now()
     where x.id = e and x.trip_id = save_expense.t
       and (x.created_by = auth.uid() or is_organiser(save_expense.t));
    if not found then
      raise exception 'You can only edit your own expenses' using errcode = '42501';
    end if;
    delete from expense_shares s where s.expense_id = e;
  end if;

  base := save_expense.amount_minor / n;
  rem := save_expense.amount_minor % n;
  insert into expense_shares (expense_id, trip_id, user_id, share_minor)
  select e, save_expense.t, q.uid, base + case when q.ord <= rem then 1 else 0 end
  from unnest(people) with ordinality as q(uid, ord);

  return e;
end $$;

revoke all on function public.save_expense(uuid, uuid, text, text, bigint, uuid, uuid[]) from public, anon;
grant execute on function public.save_expense(uuid, uuid, text, text, bigint, uuid, uuid[]) to authenticated;

-- Trip-mates who left still appear in the trip's money, so their names stay visible to its members.
create function public.shares_money_with(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from expense_shares s where s.user_id = p and is_member(s.trip_id))
      or exists (select 1 from expenses e where e.paid_by = p and is_member(e.trip_id))
      or exists (select 1 from settlements x where p in (x.from_user, x.to_user) and is_member(x.trip_id));
$$;

create policy "see people in your trips' money" on public.profiles for select using (public.shares_money_with(id));

-- Shares change only with their expense, so the expense event is the reload signal for both.
alter publication supabase_realtime add table public.expenses, public.settlements;
