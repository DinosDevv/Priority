-- Optional weekly time ceiling per area (minutes). When set, it replaces the
-- generic ">50% of the week" dominance alert for that area.
alter table public.areas
  add column ceiling_min int check (ceiling_min > 0);
