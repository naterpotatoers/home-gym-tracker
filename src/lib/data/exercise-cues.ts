/**
 * Built-in coaching cues for the seed catalog — what "Explain exercise"
 * shows. At most MAX_CUES per exercise, each at most MAX_CUE_WORDS words
 * (exercise-catalog.ts; enforced in exercise-cues.test.ts, and MAX_CUES /
 * MAX_CUE_LENGTH on save). Two voices:
 *
 * - Lifts follow Jonni Shreve's execution lens (written in his style, not
 *   quoted): set up so the target muscle takes the load, feel it doing the
 *   work, then the honest standard — own the stretch and the lowering, full
 *   range, no swinging ("if you're swinging, it's too heavy").
 * - Care, rehab, stability, mobility and the bike follow Squat University /
 *   PT: the position, the movement, the pain or compensation limit.
 *
 * Fewer than three is fine — no filler. They reach the live DB through the
 * /exercises "Re-sync built-ins" button.
 */
const CARRY_CUES = [
  "Stand tall, shoulders back and down.",
  "Short, quick steps; don't let the weights swing.",
  "Crush the handles and breathe behind the brace.",
];

export const SEED_EXERCISE_CUES: Readonly<Record<string, readonly string[]>> = {
  // ---- squat ----
  squat: [
    "Brace hard: big breath into the belly, ribs down.",
    "Sit down between the heels; knees track over the toes.",
    "Own full depth — don't cut reps short to add weight.",
  ],
  front_squat: [
    "Bar on the shoulders, elbows high, fingertips just holding it.",
    "Sit straight down and keep the chest tall.",
    "Drive the elbows up first out of the bottom.",
  ],
  goblet_squat: [
    "Hold the weight tight to the chest, elbows tucked.",
    "Sit down between the knees; elbows brush the inner thighs.",
    "Heels planted the whole rep — don't rush the bottom.",
  ],
  wide_stance_squat: [
    "Feet past shoulder width, toes out about 30°.",
    "Push the knees out over the toes on the way down.",
    "Drive up by squeezing the glutes and inner thighs.",
  ],
  bulgarian_split_squat: [
    "Rear foot on the bench; load the front leg.",
    "Drop the back knee straight down; feel the front glute stretch.",
    "Lean forward for glutes, stay upright for quads.",
  ],
  wall_sit: [
    "Back flat on the wall, knees over the ankles.",
    "Sit as low as the knees allow; breathe steadily.",
    "Push the knees slightly out so they don't cave.",
  ],
  squat_jump: [
    "Quarter squat, arms back, then explode up.",
    "Land soft and quiet — hips back, knees over toes.",
    "Stick each landing before the next jump.",
  ],
  burpee: [
    "Hands down, jump the feet back to a solid plank.",
    "Chest to the floor, then snap the feet under the hips.",
    "Keep the core tight so the hips never sag.",
  ],

  // ---- hinge ----
  deadlift: [
    "Bar over mid-foot; pull the slack out before it moves.",
    "Push the floor away and drag the bar up the legs.",
    "Lock out with the glutes — don't lean back at the top.",
  ],
  romanian_deadlift: [
    "Soft knees; push the hips back like shutting a car door.",
    "Bar stays on the legs; feel the hamstrings load up.",
    "Stop when the hamstrings stop you — rounding isn't range.",
  ],
  single_leg_rdl: [
    "Hips square; the back leg rises as the chest lowers.",
    "Feel the standing leg's hamstring and glute stretch.",
    "Slow it down — if you wobble, it's too heavy.",
  ],
  good_morning: [
    "Bar on the upper back, soft knees, brace hard.",
    "Push the hips back until the hamstrings stop you.",
    "Flat back the whole way; drive the hips forward to stand.",
  ],
  back_extension: [
    "Pad just below the hip crease so you can hinge.",
    "Lower with a flat back; rise by squeezing the glutes.",
    "Stop at a straight line — no arching past it.",
  ],
  hip_thrust: [
    "Bench under the shoulder blades, shins vertical at the top.",
    "Chin tucked, ribs down; drive through the heels.",
    "Squeeze the glutes hard at the top — not the low back.",
  ],
  glute_bridge: [
    "Feet flat, close enough to touch the heels with your fingertips.",
    "Flatten the low back, then drive the hips up through the heels.",
    "Hold the top a second — feel glutes, not hamstrings.",
  ],
  single_leg_glute_bridge: [
    "One foot planted, the other knee pulled toward the chest.",
    "Drive the hips up level — don't let one side drop.",
    "Pause at the top; the glute does the work, not the back.",
  ],
  donkey_kick: [
    "On all fours, knee bent 90°, core braced.",
    "Press the heel toward the ceiling with the glute.",
    "Stop before the low back arches — that's not glute.",
  ],
  superman: [
    "Face down, arms overhead, neck long.",
    "Lift arms and legs a few inches with glutes and upper back.",
    "Hold briefly — control matters more than height.",
  ],

  // ---- lunge ----
  lunge: [
    "Step long enough that both knees hit about 90°.",
    "Drop the back knee straight down; torso tall.",
    "Drive through the front heel and feel the front glute.",
  ],
  side_lunge: [
    "Step wide and sit back into one hip; other leg straight.",
    "Knee tracks over the toes, heel planted.",
    "Push off the bent leg — feel the inner thigh and glute.",
  ],
  step_up: [
    "Whole foot on the box; lean slightly forward.",
    "Drive up through the top leg — no push off the bottom foot.",
    "Knee stays over the toes; don't let it cave in.",
  ],

  // ---- push ----
  bench_press: [
    "Shoulder blades pinned, feet planted, slight arch.",
    "Lower to the lower chest and feel the pecs stretch.",
    "Touch and press — no bouncing the bar off the chest.",
  ],
  incline_bench_press: [
    "Bench at about 30°; shoulder blades back and down.",
    "Lower to the upper chest, wrists stacked over the elbows.",
    "Press up over the shoulders and squeeze the upper chest.",
  ],
  decline_bench_press: [
    "Lock the legs in; shoulder blades pinched.",
    "Lower to the lower chest under control.",
    "Press up over the chest — no bouncing.",
  ],
  floor_press: [
    "On the floor, shoulder blades pinched, knees bent.",
    "Lower until the upper arms touch — pause, don't bounce.",
    "Press with chest and triceps; easy on cranky shoulders.",
  ],
  push_up: [
    "Hands just outside the shoulders; body in one straight line.",
    "Elbows about 45° as the chest lowers to the floor.",
    "Squeeze glutes and quads — sagging hips mean the set's over.",
  ],
  scapular_push_up: [
    "Plank position, elbows locked.",
    "Let the chest sink between the shoulder blades, then push away.",
    "Only the shoulder blades move — arms stay straight.",
  ],
  chest_fly: [
    "Slight bend in the elbows, locked in place.",
    "Open wide until the chest stretches — not the shoulder.",
    "Hug a big tree and squeeze the pecs together.",
  ],
  shoulder_press: [
    "Squeeze the glutes and brace so the low back doesn't arch.",
    "Press straight up; the head moves back, then through.",
    "Finish with the biceps by the ears.",
  ],
  dip: [
    "Shoulders down and away from the ears at the top.",
    "Lean slightly forward; lower until the upper arms are parallel.",
    "Stop if the front of the shoulder pinches.",
  ],
  bench_dip: [
    "Hands on the bench edge, hips close to it.",
    "Lower until the elbows reach 90°; shoulders stay down.",
    "Press through the palms and squeeze the triceps.",
  ],

  // ---- pull ----
  bent_over_row: [
    "Hinge to about 45°, back flat, bar under the shoulders.",
    "Pull to the belly button, driving the elbows back.",
    "If the torso jerks up, it's too heavy.",
  ],
  single_arm_row: [
    "Hand and knee on the bench, back flat.",
    "Drive the elbow toward the hip; feel the lat pull.",
    "Let the shoulder blade stretch forward at the bottom.",
  ],
  chest_supported_row: [
    "Chest stays on the pad the whole set.",
    "Drive the elbows back and squeeze the shoulder blades together.",
    "Lower to a full stretch without shrugging.",
  ],
  inverted_row: [
    "Body straight from heels to head, glutes tight.",
    "Pull the chest to the bar, elbows about 45°.",
    "Lower to straight arms — full range, every rep.",
  ],
  face_pull: [
    "Rope or band at forehead height, palms in.",
    "Pull toward the eyes and spread the hands apart.",
    "Finish thumbs back, like a double-biceps pose.",
  ],
  band_pull_apart: [
    "Arms straight in front at shoulder height.",
    "Pull the band to the chest by squeezing the shoulder blades.",
    "Shoulders stay down — no shrugging.",
  ],
  prone_ytw: [
    "Face down, thumbs up, neck long.",
    "Lift into a Y, then T, then W.",
    "Light or no weight — it's lower traps, not neck.",
  ],
  pull_up: [
    "Dead hang, then pull the shoulders down first.",
    "Drive the elbows to the back pockets; feel the lats.",
    "Lower all the way under control — no kipping.",
  ],
  chin_up: [
    "Palms facing you, shoulder width.",
    "Pull the chest to the bar, elbows close to the body.",
    "Full hang at the bottom of every rep — no half reps.",
  ],
  bicep_curl: [
    "Elbows pinned to your sides.",
    "Curl up and squeeze hard at the top.",
    "Take 2–3 seconds down — swinging means it's too heavy.",
  ],
  hammer_curl: [
    "Palms face each other the whole rep.",
    "Elbows pinned; curl toward the shoulder and squeeze.",
    "If the torso swings, go lighter.",
  ],
  tricep_extension: [
    "Upper arms stay still, close to the head.",
    "Lower deep behind the head; feel the triceps stretch.",
    "Lock out fully and squeeze — elbows don't flare.",
  ],
  lateral_raise: [
    "Lean slightly forward; lead with the elbows, not the hands.",
    "Raise to shoulder height and feel the side delt do it.",
    "Lower under control — if you're swinging, it's too heavy.",
  ],
  shrug: [
    "Stand tall, arms straight.",
    "Lift the shoulders straight up toward the ears.",
    "Hold a second at the top; no rolling.",
  ],
  calf_raise: [
    "Balls of the feet on the edge, heels free.",
    "Rise all the way onto the big toe; pause.",
    "Lower for 3 seconds into a full stretch.",
  ],

  // ---- prehab ----
  external_rotation: [
    "Elbow pinned at your side, bent 90° (a towel roll helps).",
    "Rotate the forearm out without the elbow leaving the body.",
    "Keep it light — the rotator cuff is small.",
  ],
  band_internal_rotation: [
    "Elbow pinned at your side, bent 90°.",
    "Rotate the forearm in across the belly.",
    "Control the return — don't let the band snap back.",
  ],
  scaption_raise: [
    "Thumbs up, arms about 30° forward of the sides.",
    "Raise to shoulder height without shrugging.",
    "Stop short of any pinch at the top.",
  ],
  band_tke: [
    "Band behind the knee, foot flat, knee slightly bent.",
    "Straighten the knee fully and squeeze the quad.",
    "Knee stays over the toes — don't let it drift in.",
  ],
  nordic_curl: [
    "Heels anchored, body straight from knees to head.",
    "Lower as slowly as you can, hips extended.",
    "Catch yourself with your hands and push back up.",
  ],
  tibialis_raise: [
    "Back against a wall, heels about a foot out.",
    "Pull the toes up toward the shins as high as they go.",
    "Lower slowly; feel the front of the shin.",
  ],

  // ---- carry ----
  farmer_carry: CARRY_CUES,
  timed_carry: CARRY_CUES,
  suitcase_carry: [
    "Weight in one hand; don't lean toward it or away.",
    "Ribs over hips — the obliques hold you level.",
    "Walk slowly and switch sides.",
  ],
  bar_hang: [
    "Full grip, arms straight.",
    "Relax into the hang and let the spine decompress.",
    "If the shoulders pinch, pull them slightly down.",
  ],

  // ---- core ----
  plank: [
    "Elbows under the shoulders, body in one line.",
    "Squeeze the glutes and pull the ribs toward the hips.",
    "Stop when the hips sag or the low back aches.",
  ],
  side_plank: [
    "Elbow under the shoulder, feet stacked or staggered.",
    "Push the hips high into one straight line.",
    "Don't roll forward — the chest faces straight ahead.",
  ],
  copenhagen_plank: [
    "Top leg on the bench: knee is easier, ankle harder.",
    "Lift the hips until the body is straight.",
    "Short holds with good form beat long sagging ones.",
  ],
  pallof_press: [
    "Stand side-on to the anchor, band at the chest.",
    "Press straight out and hold — don't let it turn you.",
    "Brace like you're about to be poked in the belly.",
  ],
  hanging_knee_raise: [
    "Dead hang, shoulders pulled slightly down.",
    "Curl the pelvis up as the knees rise — feel the abs.",
    "No swinging — momentum isn't abs.",
  ],
  hanging_leg_raise: [
    "Dead hang, legs straight, shoulders active.",
    "Lift the legs by curling the pelvis up.",
    "Control the way down — no swinging for reps.",
  ],
  lateral_walk: [
    "Band at the knees or ankles; quarter squat.",
    "Step out with the lead leg, toes forward.",
    "Keep the band tight — feel the side of the hip burn.",
  ],
  clam_shell: [
    "On your side, hips stacked, knees bent.",
    "Open the top knee without rolling the hips back.",
    "Feel the side of the glute, not the low back.",
  ],
  side_lying_hip_abduction: [
    "On your side, bottom knee bent, top leg straight.",
    "Lift the top leg slightly behind you, toes forward.",
    "Hips stay stacked — rolling back cheats the glute.",
  ],
  fire_hydrant: [
    "On all fours, core braced.",
    "Lift the bent knee out to the side with the glute.",
    "Hips stay level — don't shift your weight away.",
  ],
  dead_bug: [
    "On your back, arms up, knees over the hips.",
    "Low back pressed down; reach the opposite arm and leg long.",
    "Exhale as you reach; stop if the back lifts.",
  ],
  bird_dog: [
    "On all fours, flat back — a glass of water on it.",
    "Reach the opposite arm and leg long, not high.",
    "Hold, then return without shifting the hips.",
  ],
  sit_up: [
    "Knees bent, feet anchored or flat.",
    "Curl up one vertebra at a time.",
    "Lower under control — don't flop back.",
  ],
  mcgill_curl_up: [
    "One knee bent, hands under the low back's natural arch.",
    "Lift just the head and shoulders an inch; hold.",
    "Neck stays still — the move is tiny on purpose.",
  ],
  hollow_hold: [
    "Low back pressed into the floor.",
    "Lift the shoulders and legs; arms reach overhead.",
    "Bend the knees or bring the arms in to make it easier.",
  ],
  russian_twist: [
    "Lean back with a straight spine, feet down or up.",
    "Rotate the ribs side to side, not just the hands.",
    "Chest stays up — don't round to reach the floor.",
  ],
  bicycle_crunch: [
    "Hands lightly at the head; never pull the neck.",
    "Shoulder toward the opposite knee as the other leg extends.",
    "Slow and squeezed — the low back stays down.",
  ],
  mountain_climber: [
    "Plank with the hands under the shoulders.",
    "Drive the knees toward the chest one at a time.",
    "Hips stay level — no bouncing up.",
  ],
  woodchopper: [
    "Band anchored high (or low); feet wide.",
    "Rotate through the hips and torso; arms stay long.",
    "Feel the obliques turn you — the arms just hold on.",
  ],

  // ---- conditioning ----
  jumping_jacks: [
    "Land softly on the balls of the feet.",
    "Arms all the way overhead each rep.",
  ],
  bear_crawl: [
    "Hands under the shoulders, knees an inch off the floor.",
    "Move the opposite hand and foot together.",
    "Keep the hips low and the back flat.",
  ],
  echo_bike: [
    "Seat height: slight knee bend at the bottom of the stroke.",
    "Push and pull the handles — arms and legs share the work.",
    "Start a bit under target and build.",
  ],

  // ---- mobility ----
  stretch: [
    "Ease into the stretch until you feel tension, not pain.",
    "Breathe slowly and relax into it.",
    "Hold 20–30 seconds.",
  ],
  wall_slide: [
    "Back, head and arms against the wall.",
    "Slide the arms up while keeping contact.",
    "Stop before the low back arches off the wall.",
  ],
  knee_to_wall: [
    "Foot a few inches from the wall, heel down.",
    "Drive the knee toward the wall over the second toe.",
    "Move the foot back as it gets easier.",
  ],
  standing_hamstring_stretch: [
    "Heel on a low step, leg straight.",
    "Hinge forward from the hips with a flat back.",
    "Feel it in the back of the thigh, not behind the knee.",
  ],
  standing_quad_stretch: [
    "Grab the ankle and pull the heel toward the glute.",
    "Knees together; tuck the pelvis under.",
  ],
  calf_stretch: [
    "Hands on the wall, back leg straight, heel down.",
    "Lean in until you feel the calf stretch.",
    "Bend the back knee to target the lower calf.",
  ],
  butterfly_stretch: [
    "Soles of the feet together, knees out.",
    "Sit tall and lean forward from the hips.",
    "Gently press the knees down with the elbows.",
  ],
  figure_four_stretch: [
    "On your back, cross one ankle over the other knee.",
    "Pull the bottom leg toward the chest.",
    "Feel it deep in the glute of the crossed leg.",
  ],
  pigeon_pose: [
    "Front shin angled across the body, back leg straight behind.",
    "Hips square; walk the hands forward to deepen.",
    "Ease off if the front knee hurts.",
  ],
  ninety_ninety_stretch: [
    "Both knees bent at 90°, one in front, one to the side.",
    "Sit tall and lean over the front shin.",
    "Switch sides by rotating the knees over.",
  ],
  kneeling_hip_flexor_stretch: [
    "Half-kneeling, squeeze the glute on the down-knee side.",
    "Tuck the pelvis, then shift slightly forward.",
    "Reach the same-side arm up to add the side stretch.",
  ],
  worlds_greatest_stretch: [
    "Lunge forward, hand inside the front foot.",
    "Rotate the chest open and reach the arm up.",
    "Return and straighten the front leg for the hamstring.",
  ],
  childs_pose: [
    "Knees wide, big toes together.",
    "Sit the hips back toward the heels.",
    "Reach the arms long and breathe into the back.",
  ],
  cat_cow: [
    "On all fours, move slowly with the breath.",
    "Inhale: arch and look up. Exhale: round and tuck the chin.",
    "Move one segment of the spine at a time.",
  ],
  cobra_stretch: [
    "Lie face down, hands under the shoulders.",
    "Press the chest up, hips stay on the floor.",
    "Only go as high as the low back is comfortable.",
  ],
  thread_the_needle: [
    "On all fours, reach one arm under the body.",
    "Let the shoulder and head rest down; rotate the upper back.",
    "Open back up and reach toward the ceiling.",
  ],
  downward_dog: [
    "Hands and feet down, hips high in an upside-down V.",
    "Push the floor away; chest toward the thighs.",
    "Bend the knees if the back rounds.",
  ],
  doorway_chest_stretch: [
    "Forearm on the door frame, elbow at shoulder height.",
    "Step through until you feel the chest stretch.",
    "Shoulder stays down — no pinching in front.",
  ],
  cross_body_shoulder_stretch: [
    "Bring one arm across the chest.",
    "Pull it gently with the other arm at the elbow.",
    "Keep the shoulder down, away from the ear.",
  ],
  overhead_triceps_stretch: [
    "Reach one hand down the back, elbow overhead.",
    "Gently pull the elbow with the other hand.",
    "Stand tall — don't arch the low back.",
  ],
  standing_lat_stretch: [
    "Hold a post or door frame at chest height.",
    "Sit the hips back and let the arms lengthen.",
    "Rotate slightly to find the side of the back.",
  ],
  seated_forward_fold: [
    "Legs straight, sit tall first.",
    "Hinge from the hips toward the toes.",
    "Lead with the chest, not the head.",
  ],
  standing_forward_fold: [
    "Feet hip-width, soft knees.",
    "Fold from the hips and let the head hang.",
    "Straighten the legs gradually.",
  ],
  upward_dog: [
    "Press up with straight arms; the thighs lift off the floor.",
    "Shoulders down and back; open the chest.",
    "Ease off if the low back pinches.",
  ],
  supine_spinal_twist: [
    "On your back, drop the bent knees to one side.",
    "Keep both shoulders on the floor.",
  ],
  seated_spinal_twist: [
    "Sit tall, one knee crossed over the other leg.",
    "Rotate toward the bent knee from the ribs.",
    "Lengthen on the inhale, twist on the exhale.",
  ],
  happy_baby: [
    "On your back, grab the outside of the feet.",
    "Pull the knees toward the armpits.",
    "Low back and tailbone stay on the floor.",
  ],
  frog_pose: [
    "On all fours, knees wide, ankles in line with the knees.",
    "Rock the hips slowly back toward the heels.",
    "Stop at a stretch, not a strain, in the inner thighs.",
  ],
  lizard_pose: [
    "Lunge with both hands inside the front foot.",
    "Sink the hips low and forward.",
    "Drop to the forearms to go deeper.",
  ],
  triangle_pose: [
    "Feet wide, front toes forward, back foot turned in.",
    "Hinge sideways over the front leg; reach the top arm up.",
    "Keep the chest open — don't collapse forward.",
  ],
  pancake_stretch: [
    "Sit with the legs wide and straight, knees up.",
    "Hinge forward from the hips with a flat back.",
    "Walk the hands forward; breathe into the inner thighs.",
  ],
  // ---- 2026-11 additions ----
  standing_leg_curl: [
    "Hold the rack; knees side by side, thigh stays still.",
    "Curl the heel toward the glute, squeeze, lower slow.",
    "Don't arch the back to swing the leg up.",
  ],
  prone_leg_curl: [
    "Lie face down, hips pressed into the floor.",
    "Curl the heel to the glute without the hips lifting.",
    "Lower slow — the way down is half the work.",
  ],
  standing_glute_kickback: [
    "Hold the rack, brace, slight bend in the standing knee.",
    "Push the leg straight back from the glute.",
    "Stop before the low back arches.",
  ],
  standing_hip_abduction: [
    "Stand tall holding the rack, toes pointing forward.",
    "Lift the leg out to the side from the hip.",
    "No leaning — the torso stays upright.",
  ],
  side_lying_hip_adduction: [
    "Lie on your side, top foot planted in front.",
    "Lift the bottom leg straight up, inner thigh first.",
    "Small, slow range; no rolling back.",
  ],
  standing_hip_flexion: [
    "Stand tall holding the rack.",
    "Drive the knee up to hip height, pause.",
    "Lower with control; don't lean back.",
  ],
  seated_leg_extension: [
    "Sit tall on the bench edge, hands on the sides.",
    "Straighten the knee fully and squeeze the quad.",
    "Lower slow; stop short of pain behind the kneecap.",
  ],
  straight_leg_raise: [
    "Lie down, other knee bent, low back flat.",
    "Lock the knee straight, then lift to the other knee's height.",
    "Lower slow without the knee bending.",
  ],
  reverse_lunge: [
    "Step back long; front shin stays near vertical.",
    "Drop the back knee straight down.",
    "Drive through the front heel to stand.",
  ],
  curtsy_lunge: [
    "Step back and across, like a curtsy.",
    "Hips stay square; front knee tracks over the toes.",
    "Feel the outside of the front hip working.",
  ],
  split_squat: [
    "Long stance, back heel up, torso tall.",
    "Drop straight down until the back knee nearly touches.",
    "Drive through the front foot; don't bounce.",
  ],
  cossack_squat: [
    "Wide stance; sit into one hip, other leg straight.",
    "Heel of the working foot stays down.",
    "Only go as deep as you can keep the chest up.",
  ],
  step_down: [
    "Stand on the step, hips level.",
    "Lower the free heel slow until it taps the floor.",
    "Knee tracks over the toes, not caving in.",
  ],
  sumo_deadlift: [
    "Wide stance, toes out, hands inside the knees.",
    "Push the floor apart and keep the chest up.",
    "Hips and shoulders rise together; lock out with the glutes.",
  ],
  rear_delt_fly: [
    "Hinge forward, flat back, slight bend in the elbows.",
    "Sweep the weights out wide, leading with the pinkies.",
    "Light weight, no swinging; feel the back of the shoulder.",
  ],
  upright_row: [
    "Wider grip; pull the elbows up and out.",
    "Stop at chest height, elbows just above the wrists.",
    "Skip it if the shoulder pinches.",
  ],
  pullover: [
    "Lie across the bench, one dumbbell over the chest.",
    "Lower it back behind the head with soft elbows.",
    "Pull it back over with the lats, ribs down.",
  ],
  arnold_press: [
    "Start palms facing you at chin height.",
    "Rotate the palms out as you press overhead.",
    "Reverse it on the way down, under control.",
  ],
  tricep_kickback: [
    "Hinge forward, upper arm pinned to the side.",
    "Straighten the elbow fully and squeeze.",
    "Only the forearm moves — no swinging.",
  ],
  close_grip_push_up: [
    "Hands under the shoulders, elbows brushing the ribs.",
    "Body in one straight line, glutes tight.",
    "Lower the chest to the hands, press out through the triceps.",
  ],
  pike_push_up: [
    "Hips high, hands shoulder-width, head between the arms.",
    "Lower the head toward the floor in front of the hands.",
    "Press back up through the shoulders.",
  ],
  zottman_curl: [
    "Curl up with palms facing up.",
    "Turn the palms down at the top.",
    "Lower slow with palms down — that's the forearm work.",
  ],
  hip_airplane: [
    "Balance on one leg, holding the rack.",
    "Hinge forward, then rotate the pelvis open and closed.",
    "Slow and controlled; the standing hip does the work.",
  ],
  reverse_crunch: [
    "Lie down, knees bent, low back flat.",
    "Curl the hips off the floor, knees toward the chest.",
    "Lower slow; don't swing the legs.",
  ],
  flutter_kick: [
    "Low back pressed flat into the floor.",
    "Legs straight, small fast kicks just off the floor.",
    "Raise the legs higher if the back starts to arch.",
  ],
  side_plank_hip_dip: [
    "Side plank on the elbow, body in a straight line.",
    "Lower the hip toward the floor, then lift it high.",
    "Elbow stays under the shoulder.",
  ],
  deep_squat_hold: [
    "Hold the rack and sink between the heels.",
    "Heels down, chest tall, knees out over the toes.",
    "Breathe and relax into the bottom.",
  ],
  band_pass_through: [
    "Hold a light band wide, arms straight.",
    "Lift it overhead and behind, then back in front.",
    "Go wider if the shoulders pinch or the elbows bend.",
  ],
  hip_cars: [
    "Stand tall holding the rack, brace the trunk.",
    "Draw the biggest slow circle the hip allows.",
    "Only the hip moves — no pelvis twisting.",
  ],
};
