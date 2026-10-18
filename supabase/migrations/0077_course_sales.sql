-- Every lesson-place course is sold from its OWN page (/jawad-ai/course/<id>) at its OWN price; an order belongs to the course it bought.
alter table public.learn_courses add column if not exists price_sar integer check (price_sar is null or price_sar between 1 and 100000);
alter table public.course_orders add column if not exists course_id uuid references public.learn_courses (id) on delete set null;
create index if not exists course_orders_course_idx on public.course_orders (course_id, created_at desc);
