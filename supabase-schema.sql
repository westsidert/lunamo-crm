-- 루나모 영상 프로덕션 CRM 스키마

-- 거래처 테이블
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz default now()
);

-- 프로젝트 테이블
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references clients(id) on delete set null,
  status text check (status in ('진행중', '완료', '보류', '취소')) default '진행중',
  start_date date,
  end_date date,
  description text,
  total_budget numeric default 0,
  quote_id uuid references quotes(id) on delete set null,
  created_at timestamptz default now()
);

-- 거래 테이블 (매입/매출)
create table transactions (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('매출', '매입')) not null,
  project_id uuid references projects(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  transaction_date date not null default current_date,
  item text not null,
  supply_amount numeric not null default 0,  -- 공급가액
  vat numeric not null default 0,             -- 부가세
  total_amount numeric generated always as (supply_amount + vat) stored,
  invoice_issued boolean default false,       -- 세금계산서 발행 여부
  payment_status text check (payment_status in ('미수금', '수금완료', '미지급', '지급완료')) default '미수금',
  memo text,
  created_at timestamptz default now()
);

-- RLS 비활성화 (개인 사용 용도, 필요시 활성화)
alter table clients enable row level security;
alter table projects enable row level security;
alter table transactions enable row level security;

-- 모든 접근 허용 정책 (개발용 - 운영 시 인증 추가 권장)
create policy "Allow all" on clients for all using (true) with check (true);
create policy "Allow all" on projects for all using (true) with check (true);
create policy "Allow all" on transactions for all using (true) with check (true);

-- 인덱스
create index on transactions(transaction_date desc);
create index on transactions(type);
create index on transactions(client_id);
create index on transactions(project_id);
create index on projects(client_id);

-- 견적서 테이블
create table quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  client_name_override text,
  project_title text not null,
  quote_date date not null default current_date,
  status text check (status in ('작성중', '발송완료', '수주', '미수주')) default '작성중',
  is_first_deal boolean default false,
  discount_rate numeric default 15,
  sub_total numeric default 0,
  vat_amount numeric default 0,
  final_amount numeric default 0,
  memo text,
  created_at timestamptz default now()
);

-- 견적 항목 테이블
create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade not null,
  category text,
  contents text,
  preset_key text,
  each_price numeric default 0,
  qty integer default 1,
  day integer default 1,
  sum numeric default 0,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table quotes enable row level security;
alter table quote_items enable row level security;

create policy "Allow all" on quotes for all using (true) with check (true);
create policy "Allow all" on quote_items for all using (true) with check (true);

create index on quotes(quote_date desc);
create index on quotes(client_id);
create index on quote_items(quote_id);
