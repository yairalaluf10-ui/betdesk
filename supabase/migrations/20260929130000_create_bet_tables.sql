create table public.preferred_bets (
  id bigint generated always as identity primary key,
  customer_id bigint not null unique references public.customers (id) on delete cascade,
  bet_type text not null
);

create table public.bet_volumes (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id) on delete cascade,
  month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  unique (customer_id, month)
);

alter table public.preferred_bets enable row level security;
alter table public.bet_volumes enable row level security;

-- one preferred bet type per customer
insert into public.preferred_bets (customer_id, bet_type)
select c.id,
       (array['1X2', 'מעל/מתחת', 'תוצאה מדויקת', 'הימור משולב', 'מבקיע ראשון', 'הנדיקפ'])[1 + floor(random() * 6)::int]
from public.customers c;

-- monthly betting volume per customer for the last 3 months
insert into public.bet_volumes (customer_id, month, amount)
select c.id,
       (date_trunc('month', current_date) - make_interval(months => m))::date,
       round((100 + random() * 4900)::numeric, 2)
from public.customers c
cross join generate_series(0, 2) as m;
