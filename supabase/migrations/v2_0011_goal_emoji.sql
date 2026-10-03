-- v2: an optional emoji on a goal and on each milestone ("🍨" for "Two
-- scoops of ice cream"). The kid's goal ring shows it at the tip of the
-- filled part.
--
-- Written to be safe to run more than once.

alter table v2.goals
  add column if not exists emoji text check (char_length(emoji) <= 16);

alter table v2.goal_milestones
  add column if not exists emoji text check (char_length(emoji) <= 16);
