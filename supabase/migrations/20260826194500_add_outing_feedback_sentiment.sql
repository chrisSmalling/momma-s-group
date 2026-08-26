alter table public.outing_feedback
  add column if not exists sentiment text;

alter table public.outing_feedback
  drop constraint if exists outing_feedback_sentiment_check;

alter table public.outing_feedback
  add constraint outing_feedback_sentiment_check
  check (sentiment is null or sentiment = any (array['loved'::text, 'good'::text, 'not_for_us'::text]));

comment on column public.outing_feedback.sentiment is 'Lightweight post-activity outcome used to improve future recommendations.';
