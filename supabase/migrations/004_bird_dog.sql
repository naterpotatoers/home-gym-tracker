-- reverse_dead_bug was renamed to bird_dog in the TS reference data (same
-- movement, the name everyone actually uses). exercise_id is plain text
-- validated in app code, so live rows just need the string updated.
update set_logs set exercise_id = 'bird_dog' where exercise_id = 'reverse_dead_bug';
update routine_exercises set exercise_id = 'bird_dog' where exercise_id = 'reverse_dead_bug';
