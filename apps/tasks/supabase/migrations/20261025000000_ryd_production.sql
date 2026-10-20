-- RY-D production: after an order is verified, when it went off to be made
-- and when it was actually done. A track of its own beside the fulfillment
-- batch, so an order can be in production whether or not fulfillment has had
-- its file yet. Done always implies sent: marking an order done that skipped
-- the first step stamps both.

alter table public.ryd_orders
  add column if not exists production_sent_at timestamptz,
  add column if not exists production_sent_by uuid
    references public.profiles (id) on delete set null,
  add column if not exists done_at timestamptz,
  add column if not exists done_by uuid
    references public.profiles (id) on delete set null;

alter table public.ryd_orders
  drop constraint if exists ryd_orders_done_after_production_check;
alter table public.ryd_orders
  add constraint ryd_orders_done_after_production_check
  check (done_at is null or production_sent_at is not null);

-- Moving orders between production stages is recorded like every other change.
alter table public.ryd_order_events
  drop constraint if exists ryd_order_events_action_check;
alter table public.ryd_order_events
  add constraint ryd_order_events_action_check check (
    action in (
      'imported', 'status', 'note', 'linked', 'unlinked', 'emailed', 'sent',
      'production'
    )
  );
