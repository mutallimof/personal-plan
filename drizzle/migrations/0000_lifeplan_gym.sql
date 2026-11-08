
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm numeric,
  weight_kg numeric,
  goal text,
  sessions_per_week int,
  experience text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  family text NOT NULL,
  equipment text NOT NULL,
  muscle_group text NOT NULL,
  primary_muscles text[] NOT NULL DEFAULT '{}',
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  steps text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises readable" ON public.exercises FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  sets int NOT NULL DEFAULT 3,
  reps text NOT NULL DEFAULT '8-10',
  weight_kg numeric,
  weight_note text,
  position int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_exercises TO authenticated;
GRANT ALL ON public.session_exercises TO service_role;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session_exercises" ON public.session_exercises FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.scheduled_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  date date NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_sessions TO authenticated;
GRANT ALL ON public.scheduled_sessions TO service_role;
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled" ON public.scheduled_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.exercises (slug,name,family,equipment,muscle_group,primary_muscles,secondary_muscles,steps) VALUES
('incline-db-press','Incline dumbbell press','incline-press','dumbbell','chest','{chest}','{shoulders-front,triceps}','{"Set the bench to 30–45°.","Press the dumbbells up over your upper chest.","Lower slowly until elbows are just below the bench.","Keep shoulder blades pulled back and down.","Press up without locking the elbows hard."}'),
('incline-machine-press','Incline machine press','incline-press','machine','chest','{chest}','{shoulders-front,triceps}','{"Adjust the seat so handles line up with upper chest.","Grip handles, shoulder blades back.","Press forward and up in a smooth arc.","Return slowly until you feel a stretch."}'),
('flat-db-press','Flat dumbbell press','flat-press','dumbbell','chest','{chest}','{shoulders-front,triceps}','{"Lie flat, feet planted.","Start with dumbbells over your chest.","Lower to chest level with elbows at ~45°.","Press back up, keep wrists stacked."}'),
('machine-chest-press','Machine chest press','flat-press','machine','chest','{chest}','{shoulders-front,triceps}','{"Set seat so handles are at mid-chest.","Keep back against the pad.","Press until arms are nearly straight.","Return slowly with control."}'),
('push-up','Push-up','flat-press','bodyweight','chest','{chest}','{shoulders-front,triceps,abs}','{"Hands slightly wider than shoulders.","Body in a straight line from head to heels.","Lower chest to just above the floor.","Push back up, keep core tight."}'),
('cable-fly','Cable fly','fly','cable','chest','{chest}','{shoulders-front}','{"Set pulleys at shoulder height.","Step forward, slight bend in elbows.","Bring hands together in a wide arc.","Return slowly until you feel a stretch."}'),
('pec-deck','Pec deck','fly','machine','chest','{chest}','{shoulders-front}','{"Adjust seat so handles are at chest height.","Keep elbows slightly bent.","Squeeze the handles together.","Open slowly under control."}'),
('lat-pulldown','Lat pulldown','vertical-pull','cable','back','{lats}','{biceps,upper-back}','{"Grip the bar slightly wider than shoulders.","Lean back a little, chest up.","Pull the bar to the top of your chest.","Drive elbows down, then return slowly."}'),
('neutral-pulldown','Neutral-grip pulldown','vertical-pull','cable','back','{lats}','{biceps,upper-back,forearms}','{"Use a close neutral-grip handle.","Sit tall with thighs under the pads.","Pull handles to upper chest.","Control the way up to a full stretch."}'),
('pull-up','Pull-up','vertical-pull','bodyweight','back','{lats}','{biceps,upper-back,forearms}','{"Hang with hands shoulder-width.","Pull shoulder blades down first.","Pull until chin passes the bar.","Lower all the way under control."}'),
('seated-cable-row','Seated cable row','row','cable','back','{upper-back,lats}','{biceps,shoulders-rear}','{"Sit tall, slight bend in knees.","Pull the handle to your lower ribs.","Squeeze shoulder blades together.","Return slowly without rounding your back."}'),
('db-row','One-arm dumbbell row','row','dumbbell','back','{upper-back,lats}','{biceps,shoulders-rear}','{"Support one hand and knee on a bench.","Pull the dumbbell to your hip.","Keep your back flat.","Lower until the arm is straight."}'),
('lateral-raise','Lateral raise','lateral-raise','dumbbell','shoulders','{shoulders-side}','{traps}','{"Stand tall, dumbbells at your sides.","Raise arms out to shoulder height.","Lead with elbows, slight bend.","Lower slowly, no swinging."}'),
('cable-lateral-raise','Cable lateral raise','lateral-raise','cable','shoulders','{shoulders-side}','{traps}','{"Set pulley low, stand side-on.","Raise the handle out to shoulder height.","Keep the arm slightly bent.","Lower under control."}'),
('machine-lateral-raise','Machine lateral raise','lateral-raise','machine','shoulders','{shoulders-side}','{traps}','{"Align shoulders with the machine pivot.","Raise pads to shoulder height.","Pause briefly at the top.","Lower slowly."}'),
('seated-db-shoulder-press','Seated dumbbell shoulder press','shoulder-press','dumbbell','shoulders','{shoulders-front}','{shoulders-side,triceps}','{"Set the bench upright.","Start with dumbbells at ear height.","Press overhead without clashing them.","Lower slowly to start."}'),
('machine-shoulder-press','Machine shoulder press','shoulder-press','machine','shoulders','{shoulders-front}','{shoulders-side,triceps}','{"Set seat so handles are at shoulder height.","Keep back against the pad.","Press up until arms are nearly straight.","Return slowly."}'),
('face-pull','Face pull','rear-delt','cable','shoulders','{shoulders-rear}','{upper-back,traps}','{"Set the rope at upper-chest height.","Pull the rope toward your face.","Split the rope and turn hands out.","Return slowly."}'),
('rear-delt-fly','Rear delt fly','rear-delt','dumbbell','shoulders','{shoulders-rear}','{upper-back}','{"Hinge forward with a flat back.","Raise dumbbells out to the sides.","Lead with the elbows.","Lower slowly."}'),
('reverse-pec-deck','Reverse pec deck','rear-delt','machine','shoulders','{shoulders-rear}','{upper-back}','{"Face the pad, handles at shoulder height.","Push the handles back in an arc.","Squeeze the back of your shoulders.","Return slowly."}'),
('biceps-curl','Biceps curl','curl','dumbbell','arms','{biceps}','{forearms}','{"Stand tall, palms forward.","Curl the dumbbells up, elbows fixed.","Squeeze at the top.","Lower slowly all the way."}'),
('ez-bar-curl','EZ-bar curl','curl','barbell','arms','{biceps}','{forearms}','{"Grip the angled part of the bar.","Keep elbows by your sides.","Curl the bar to shoulder height.","Lower slowly."}'),
('close-grip-ez-curl','Close-grip EZ-bar curl','curl','barbell','arms','{biceps}','{forearms}','{"Grip the inner angles of the bar.","Keep elbows pinned.","Curl up and squeeze.","Lower under control."}'),
('cable-curl','Cable curl','curl','cable','arms','{biceps}','{forearms}','{"Set the pulley low with a bar.","Curl up, elbows still.","Squeeze at the top.","Lower slowly."}'),
('hammer-curl','Hammer curl','hammer-curl','dumbbell','arms','{biceps,forearms}','{}','{"Hold dumbbells with palms facing in.","Curl up keeping the neutral grip.","Keep elbows at your sides.","Lower slowly."}'),
('triceps-pushdown','Triceps pushdown','triceps','cable','arms','{triceps}','{}','{"Set the pulley high with a bar or rope.","Elbows tucked at your sides.","Push down until arms are straight.","Return slowly to 90°."}'),
('overhead-triceps-ext','Overhead triceps extension','triceps','dumbbell','arms','{triceps}','{}','{"Hold one dumbbell overhead with both hands.","Lower it behind your head.","Keep elbows pointing up.","Extend back to the top."}'),
('dips','Dips','triceps','bodyweight','arms','{triceps,chest}','{shoulders-front}','{"Support yourself on parallel bars.","Lower until elbows reach ~90°.","Keep shoulders down.","Press back up."}'),
('close-grip-press','Close-grip bench press','triceps','barbell','arms','{triceps}','{chest,shoulders-front}','{"Grip the bar shoulder-width.","Lower to lower chest, elbows tucked.","Press up in a straight line.","Keep wrists straight."}'),
('hanging-leg-raise','Hanging leg raise','core','bodyweight','core','{abs}','{obliques}','{"Hang from a bar, arms straight.","Raise legs by curling your pelvis up.","Avoid swinging.","Lower slowly."}'),
('plank','Plank','core-hold','bodyweight','core','{abs}','{obliques,lower-back}','{"Forearms under shoulders.","Body in a straight line.","Squeeze glutes and brace your core.","Breathe steadily and hold."}'),
('squat','Barbell squat','squat','barbell','legs','{quads,glutes}','{hamstrings,lower-back}','{"Bar on upper back, feet shoulder-width.","Brace and sit down between your hips.","Go to at least parallel.","Drive up through the whole foot."}'),
('leg-press','Leg press','squat','machine','legs','{quads,glutes}','{hamstrings}','{"Feet shoulder-width on the platform.","Lower until knees reach ~90°.","Keep lower back on the pad.","Press up without locking knees."}'),
('goblet-squat','Goblet squat','squat','dumbbell','legs','{quads,glutes}','{abs}','{"Hold a dumbbell at your chest.","Sit down between your heels.","Keep chest up.","Stand back up."}'),
('romanian-deadlift','Romanian deadlift','hinge','barbell','legs','{hamstrings,glutes}','{lower-back}','{"Stand with the bar at your hips.","Push hips back, soft knees.","Lower until you feel a hamstring stretch.","Drive hips forward to stand."}'),
('db-rdl','Dumbbell Romanian deadlift','hinge','dumbbell','legs','{hamstrings,glutes}','{lower-back}','{"Hold dumbbells in front of thighs.","Hinge at the hips, back flat.","Lower to mid-shin.","Squeeze glutes to stand."}'),
('leg-curl','Leg curl','leg-curl','machine','legs','{hamstrings}','{calves}','{"Align knees with the machine pivot.","Curl the pad toward you.","Squeeze at the end.","Return slowly."}'),
('calf-raise','Calf raise','calf','machine','legs','{calves}','{}','{"Balls of feet on the edge.","Lower heels for a full stretch.","Rise as high as you can.","Pause at the top."}');

CREATE OR REPLACE FUNCTION public.seed_example_plan() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  DELETE FROM sessions WHERE user_id = uid;

  INSERT INTO sessions(user_id,name,position) VALUES (uid,'Upper A',0) RETURNING id INTO s;
  INSERT INTO session_exercises(user_id,session_id,exercise_id,sets,reps,weight_kg,weight_note,position)
  SELECT uid,s,e.id,v.sets,v.reps,v.w,v.note,v.pos FROM (VALUES
    ('incline-db-press',3,'8-10',12::numeric,'each',0),('lat-pulldown',3,'8-10',45,NULL,1),('seated-cable-row',3,'10-12',39,NULL,2),
    ('lateral-raise',3,'12-15',10,'each',3),('triceps-pushdown',2,'10-12',20.5,NULL,4),('biceps-curl',2,'10-12',10,'each',5)
  ) v(slug,sets,reps,w,note,pos) JOIN exercises e ON e.slug=v.slug;

  INSERT INTO sessions(user_id,name,position) VALUES (uid,'Upper B',1) RETURNING id INTO s;
  INSERT INTO session_exercises(user_id,session_id,exercise_id,sets,reps,weight_kg,weight_note,position)
  SELECT uid,s,e.id,v.sets,v.reps,v.w,v.note,v.pos FROM (VALUES
    ('seated-db-shoulder-press',3,'8-10',10::numeric,'each',0),('lateral-raise',3,'12-15',10,'each',1),('cable-fly',2,'12-15',5,'~ per arm',2),
    ('face-pull',2,'12-15',11.5,'11-12 kg',3),('ez-bar-curl',3,'10-12',7.5,'bar +',4),('close-grip-ez-curl',2,'12-15',7.5,'bar +',5),('overhead-triceps-ext',3,'10-12',12,NULL,6)
  ) v(slug,sets,reps,w,note,pos) JOIN exercises e ON e.slug=v.slug;

  INSERT INTO sessions(user_id,name,position) VALUES (uid,'Upper C',2) RETURNING id INTO s;
  INSERT INTO session_exercises(user_id,session_id,exercise_id,sets,reps,weight_kg,weight_note,position)
  SELECT uid,s,e.id,v.sets,v.reps,v.w,v.note,v.pos FROM (VALUES
    ('flat-db-press',3,'8-10',NULL::numeric,NULL,0),('neutral-pulldown',3,'6-10',NULL,NULL,1),('lateral-raise',3,'15',NULL,NULL,2),
    ('rear-delt-fly',2,'12-15',NULL,NULL,3),('hammer-curl',2,'10-12',NULL,NULL,4),('dips',2,'8-12',NULL,NULL,5),('hanging-leg-raise',3,'10-12',NULL,NULL,6)
  ) v(slug,sets,reps,w,note,pos) JOIN exercises e ON e.slug=v.slug;

  INSERT INTO sessions(user_id,name,position) VALUES (uid,'Lower',3) RETURNING id INTO s;
  INSERT INTO session_exercises(user_id,session_id,exercise_id,sets,reps,weight_kg,weight_note,position)
  SELECT uid,s,e.id,v.sets,v.reps,v.w,v.note,v.pos FROM (VALUES
    ('squat',3,'8-10',NULL::numeric,NULL,0),('romanian-deadlift',3,'8-10',NULL,NULL,1),('leg-curl',2,'10-12',NULL,NULL,2),
    ('calf-raise',3,'12-15',NULL,NULL,3),('plank',3,'45 s',NULL,NULL,4)
  ) v(slug,sets,reps,w,note,pos) JOIN exercises e ON e.slug=v.slug;
END $$;
GRANT EXECUTE ON FUNCTION public.seed_example_plan() TO authenticated;
