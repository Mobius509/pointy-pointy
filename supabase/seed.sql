-- Sample starter data. Safe to run after the initial migration.
-- Edit freely once you're using the parent admin to manage tasks.

insert into public.tasks (name, description, points, recurring, sort_order) values
  ('Make bed',          'Pillows up, blanket smooth.',    5, true,  10),
  ('Brush teeth (AM)',  'Two minutes, top and bottom.',   5, true,  20),
  ('Brush teeth (PM)',  'Two minutes before bed.',        5, true,  30),
  ('Read for 20 min',   'Any book counts!',               5, true,  40),
  ('Tidy room',         'Clothes off the floor, books on the shelf.', 5, true, 50),
  ('Help with dinner',  'Set the table or help cook.',    5, false, 60),
  ('Help with groceries', 'Carrying bags or putting away.', 10, false, 70);

insert into public.goals (name, target_points)
select 'Get a dog', 5000
where not exists (select 1 from public.goals where redeemed_at is null);
