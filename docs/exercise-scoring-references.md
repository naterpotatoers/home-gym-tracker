# Exercise muscle-score references

Why each exercise in the catalog scores the muscles it does. The numbers live
in `src/lib/data/exercises.ts` (`exerciseMuscleScores`); this document is the
evidence behind them, compiled from an EMG-literature review (August 2026).
The heat map, weekly volume math, and coverage meters all derive from these
scores, so this page is effectively the bibliography for the whole muscle
model. The rehab/prehab additions (Aug 2026) and the pre-built Care routines
are documented separately in
[pt-exercise-references.md](./pt-exercise-references.md).

## How to read the scores

- **Scale:** integers 0–10 per (exercise, muscle). 10 = primary mover — the
  movement exists to train it. 6–8 = strong secondary, works hard every rep.
  3–5 = supporting. 1–2 = stabilizer. Scores are meant to be comparable
  *across* exercises: a 10 means "among the best things in this catalog for
  that muscle."
- **Seed vs editor:** these hand-tuned free values apply to the built-in
  catalog. Exercises authored in the app use the coarser role scale
  (10/7/4/2) as a guardrail against inflated profiles.
- Modality variants (barbell vs dumbbell vs band) *adjust* these baselines via
  modifiers; they never re-author them. Scores describe the default modality.
- Mobility exercises carry no scores on purpose — they're excluded from
  volume math rather than contributing zeros.
- Ties at the 10 ceiling are deliberate where the literature supports two
  champions: hip thrust & deadlift (glutes), RDL & Nordic curl (hamstrings —
  hip-extension vs knee-flexion emphasis, Bourne 2017), lateral walk &
  side-lying abduction (glute med). The ordering tests only assert strict
  inequalities against third exercises.

### Caveats that shaped the numbers

EMG amplitude is an imperfect proxy for training stimulus, so the scores lean
on it critically rather than literally:

- **Normalization artifacts.** Cross-study %MVIC comparisons can mislead —
  e.g. the famous "step-up = 125% MVIC glute max" figure (Neto 2020's top
  entry) traces to a non-standard MVIC normalization; corrected, step-ups sit
  with lunges and split squats, not above them.
- **Load ceiling matters.** A bodyweight glute bridge can show decent EMG but
  cannot progress like a loaded hip thrust — bridges and quadruped moves are
  scored below loaded hip extension for that reason.
- **Isometrics read low.** Planks and holds produce lower EMG than dynamic
  work at similar effort; static core moves score a notch under dynamic peers
  by design.
- **Co-contraction isn't work.** Squat hamstring EMG is real but reflects
  knee-stabilizing co-contraction, not hamstring training — hence stabilizer
  scores despite measurable activity.
- **Where no exercise-specific EMG exists** (Pallof press, mountain climber,
  woodchopper, jumping jacks, burpee, wall sit, fire hydrant), scores are
  clinical/coaching consensus and are flagged as such below.

---

## Squat family & lunges

**Key findings**

- Front vs back squat: quad EMG is essentially equal at matched relative
  loads (Gullett 2009; Yavuz 2015 found *higher* vastus medialis in the front
  squat ascent). The front rack raises trunk demand — but erector activity is
  **not** lower in the front squat (Yavuz 2015: ~25% higher), so both score
  lower_back 4, and the front squat's edge shows up in `abs` instead.
- Stance width: widening does not change quad or hamstring EMG (Escamilla
  2001; Paoli 2009) but does raise glute max (McCaw & Melrose 1999; Paoli
  2009). The adductor advantage is mixed — McCaw & Melrose found it, Paoli
  and Escamilla didn't — so the wide-stance squat keeps an adductor emphasis
  (7) without overclaiming.
- Squat hamstrings are famously low: ~4–12% MVIC unloaded, roughly half of a
  leg curl / stiff-leg deadlift even when loaded (Wright 1999; Escamilla
  2001). All bilateral squats score hamstrings as stabilizers.
- Bulgarian split squat: glute max ≈ back squat at far lower absolute load
  (DeForest 2014), with greater glute med and biceps femoris (McCurdy 2010) —
  the unilateral frontal-plane stabilization is the mechanism.
- Unilateral work (lunge, step-up, BSS) beats bilateral squats for glute med;
  in the forward lunge, glute med EMG is comparable to or above glute max
  (Muyor 2020).
- Jumping: plantarflexors dominate ankle power release at take-off, with
  gastrocnemius contributing up to ~25% of jump height (Pandy & Zajac 1991;
  Bobbert & van Ingen Schenau; Farris 2016) — the squat jump's calves 6.
- No peer-reviewed EMG exists for the burpee or wall sit; their scores are
  movement-phase reasoning (burpee = squat + plank + push-up + jump at
  bodyweight ceilings; wall sit = quad-dominant isometric).

**Orderings encoded in tests:** quads squat ≈ front ≈ wide (±1);
abs front_squat > squat; hamstrings lunge > squat;
glute_med bulgarian_split_squat > squat.

**Sources**

- [Gullett et al. 2009, *J Strength Cond Res* — front vs back squat EMG](https://pubmed.ncbi.nlm.nih.gov/19002072/)
- [Yavuz et al. 2015, *J Sports Sci* — 1RM front vs back squat](https://pubmed.ncbi.nlm.nih.gov/25630691/)
- [Escamilla et al. 2001, *Med Sci Sports Exerc* — stance width EMG](https://pubmed.ncbi.nlm.nih.gov/11408442/)
- [Paoli et al. 2009, *J Strength Cond Res* — stance width, eight thigh muscles](https://pubmed.ncbi.nlm.nih.gov/19130646/)
- [McCaw & Melrose 1999, *Med Sci Sports Exerc* — stance width and bar load](https://pubmed.ncbi.nlm.nih.gov/10188748/)
- [Wright et al. 1999, *J Strength Cond Res* — hamstring EMG: leg curl, SLDL, squat](https://journals.lww.com/nsca-jscr/abstract/1999/05000/electromyographic_activity_of_the_hamstrings.12.aspx)
- [McCurdy et al. 2010, *J Sport Rehabil* — modified single-leg squat vs 2-leg squat: higher glute med & hamstring EMG unilaterally](https://pubmed.ncbi.nlm.nih.gov/20231745/)
- [DeForest et al. 2014, *Int J Exerc Sci* — BSS vs back squat loading](https://pmc.ncbi.nlm.nih.gov/articles/PMC4831906/)
- [Muyor et al. 2020, *PLOS One* — lunge / monopodal squat / lateral step-up EMG](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0230841)
- [Pandy & Zajac 1991, *J Biomech* — muscular coordination in jumping](https://www.sciencedirect.com/science/article/pii/002192909190321D)
- [Farris et al. 2016, *J Exp Biol* — plantarflexor role in maximal jumping](https://journals.biologists.com/jeb/article/219/4/528/16541/)
- [Neto et al. 2020, *J Sports Sci Med* — glute max EMG systematic review (and the step-up normalization caveat)](https://pubmed.ncbi.nlm.nih.gov/32132843/)

---

## Hinge family

**Key findings**

- Deadlift: the Martín-Fuentes 2020 systematic review found erector spinae
  and quads the most activated muscles across deadlift variants, with
  hamstring EMG moderate — so the deadlift scores quads 6 / hamstrings 7
  rather than the folk "pure posterior chain" profile. Glutes stay 10 on
  hip-extension torque plus Neto 2020's "very high" classification.
- RDL vs deadlift: the RDL is the hamstring exercise (McAllister 2014 —
  highest biceps femoris of the variants tested, especially eccentric; Lee
  2018 agrees), while the conventional pull wins quads.
- Hip thrust: glute ceiling alongside the deadlift (Contreras 2015 —
  thrust ≫ squat for glute max; Andersen 2018 — thrust > hex-bar deadlift).
  Its vastus lateralis EMG is surprisingly high (~100% MVIC, ≈ back squat;
  Contreras 2015), so quads earn a real 4. Hamstrings are *lower* than in a
  deadlift (Andersen 2018: BF 20–48% higher in the pull).
- Bodyweight hip extension (glute bridge, donkey kick, superman): Neto 2020
  classifies bilateral bridges and quadruped/prone work low-to-moderate
  (~31–34% MVIC quadruped) — scored 6–7, clearly under the loaded lifts.
- Single-leg glute bridge: hamstrings are actually the highest-EMG muscle
  (~75% MVIC at 90° knee), with glute max ~51% and glute med ~58%
  (Lehecka 2017).
- Good morning ≈ RDL for erectors at matched relative load (McAllister 2014);
  the GM keeps a 1-point erector edge for the bar-on-back spinal moment arm.

**Orderings encoded in tests:** hamstrings RDL > deadlift > hip_thrust;
glutes hip_thrust/deadlift > squat; glutes hip_thrust > glute_bridge and
donkey_kick.

**Sources**

- [Martín-Fuentes et al. 2020, *PLOS One* — deadlift EMG systematic review](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0229507)
- [Contreras et al. 2015, *J Appl Biomech* — hip thrust vs back squat EMG](https://pubmed.ncbi.nlm.nih.gov/26214739/)
- [Andersen et al. 2018, *J Strength Cond Res* — hip thrust vs hex/barbell deadlift](https://pubmed.ncbi.nlm.nih.gov/28151780/)
- [McAllister et al. 2014, *J Strength Cond Res* — hamstring exercise EMG](https://journals.lww.com/nsca-jscr/fulltext/2014/06000/muscle_activation_during_various_hamstring.11.aspx)
- [Lee et al. 2018, *J Exerc Sci Fit* — RDL vs conventional deadlift](https://www.sciencedirect.com/science/article/pii/S1728869X18301291)
- [Lehecka et al. 2017, *Int J Sports Phys Ther* — single-leg bridge EMG](https://pubmed.ncbi.nlm.nih.gov/28900560/)
- [Neto et al. 2020, *J Sports Sci Med* — glute max EMG systematic review](https://pubmed.ncbi.nlm.nih.gov/32132843/)
- [Superman / multifidus equivalence study, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8967528/)

---

## Horizontal & vertical pushes

**Key findings**

- Bench angle shifts are **modest**, not categorical. At 30° incline the
  clavicular (upper) pec is *not* more active than flat, and the sternal head
  still hits ~87% of its flat value (Lauver 2016; Rodríguez-Ridao 2020 —
  upper pec peaks around 30°, mid/lower pec highest flat, triceps identical
  at every angle). Hence: flat bench now credits upper_chest 4, incline
  keeps mid_chest 6.
- Decline: greater lower-pec concentric activation than incline (Glass &
  Armstrong 1997); clavicular head drops — decline correctly lists no
  upper_chest.
- Push-up ≈ bench press for prime-mover EMG at matched (6RM) load, with
  equivalent strength gains after training (Calatayud 2015); the push-up adds
  serratus and core demand the bench doesn't have.
- Dips: pec major and triceps dominate with anterior delt lower; bar dips
  beat bench dips in peak EMG across pec, delts, triceps, serratus, and lats
  (McKenzie 2022) — hence the dip's lats 2 and its 10/8 vs the bench dip's
  9/5.
- Overhead press: medial delt runs close behind anterior (Saeterbakken &
  Fimland 2013 — standing/dumbbell variants raise deltoid EMG; standing
  barbell = highest triceps), but still clearly below the lateral raise for
  medial delt (Botton 2020) — side_delts 7 vs the lateral raise's 10.
- Floor press: no direct EMG study exists; its triceps lean is mechanical
  reasoning, kept conservative (a 2025 partial-ROM study actually found full
  ROM highest for mean triceps excitation — so triceps was not raised
  further).

**Orderings encoded in tests:** upper_chest incline > flat;
mid_chest flat > incline; side_delts lateral_raise > shoulder_press;
lower_chest dip > bench_dip.

**Sources**

- [Lauver et al. 2016, *Eur J Sport Sci* — bench angle and pec regions](https://pubmed.ncbi.nlm.nih.gov/25799093/)
- [Rodríguez-Ridao et al. 2020, *IJERPH* — five bench inclinations](https://pmc.ncbi.nlm.nih.gov/articles/PMC7579505/)
- [Glass & Armstrong 1997, *J Strength Cond Res* — incline vs decline pec EMG](https://journals.lww.com/nsca-jscr/abstract/1997/08000/electromyographical_activity_of_the_pectoralis.6.aspx)
- [Calatayud et al. 2015, *J Strength Cond Res* — push-up vs bench at 6RM](https://pubmed.ncbi.nlm.nih.gov/24983847/)
- [McKenzie et al. 2022, *IJERPH* — bench, bar, and ring dips](https://pmc.ncbi.nlm.nih.gov/articles/PMC9564194/)
- [Saeterbakken & Fimland 2013, *J Strength Cond Res* — OHP variants](https://pubmed.ncbi.nlm.nih.gov/23096062/)
- [Botton et al. 2020 — medial delt across pressing/raising exercises](https://pubmed.ncbi.nlm.nih.gov/29489727/)
- [Bench press partial ROM, *Sci Rep* 2025](https://www.nature.com/articles/s41598-025-98354-9)

---

## Horizontal & vertical pulls

**Key findings**

- Row variants trade lower-back involvement, not upper-back stimulus.
  Fenwick/McGill 2009: the bent-over row produced the highest erector
  activation and lumbar load; the inverted row the highest lat and
  upper-back EMG at the *lowest* lumbar load (plus the highest hip-extensor
  demand — its rigid-plank glutes 2); the standing one-arm row the highest
  torsional trunk demand (the single-arm row's obliques 4). ACE/Edelburg
  2018 found supported and unsupported rows *equivalent* for mid-trap —
  chest support spares the spine, it does not add rhomboid EMG, so the
  chest-supported row is co-primary lats/rhomboids 9/9 rather than a
  rhomboid-10 isolation claim.
- Pull-up vs chin-up (Youdas 2010): lats are high in both grips
  (117–130% MVIC, difference n.s.); biceps (78–96%) and pec major (44–57%)
  significantly higher in the chin-up; lower trap significantly higher in
  the pull-up; infraspinatus 71–79% MVIC in both — which is why both now
  carry rotator_cuff 4. The pull-up's 1-point lat edge leans on the
  pulldown analog (Lusk 2010: pronated > supinated lat EMG).
- Face pull matches the scapular pattern Cools 2007 recommends (external
  rotation + horizontal abduction → high lower/mid trap and infraspinatus,
  low upper-trap dominance).
- Band pull-apart: mid trap ~56% / upper trap ~53% MVIC (Jeong 2022) — trap
  work on par with the posterior delt, hence traps 6.

**Orderings encoded in tests:** biceps chin_up > pull_up;
traps pull_up > chin_up; lower_back bent_over_row > chest_supported_row.

**Sources**

- [Fenwick, Brown & McGill 2009, *J Strength Cond Res* — three rows: muscle activation and lumbar load](https://pubmed.ncbi.nlm.nih.gov/19620925/)
- [ACE / Edelburg 2018 — eight back exercises compared](https://www.acefitness.org/continuing-education/certified/december-2018/7138/ace-sponsored-research-what-is-the-best-back-exercise/)
- [Youdas et al. 2010, *J Strength Cond Res* — pull-up / chin-up / rotational grip](https://journals.lww.com/nsca-jscr/fulltext/2010/12000/surface_electromyographic_activation_patterns_and.27.aspx)
- [Dickie et al. 2017, *J Electromyogr Kinesiol* — pull-up grip variations](https://www.sciencedirect.com/science/article/abs/pii/S1050641116302978)
- [Lusk et al. 2010, *J Strength Cond Res* — grip in the lat pulldown](https://pubmed.ncbi.nlm.nih.gov/20543740/)
- [Cools et al. 2007, *Am J Sports Med* — scapular muscle balance exercises](https://journals.sagepub.com/doi/abs/10.1177/0363546507303560)
- [Jeong et al. 2022, *Int J Sports Phys Ther* — band pull-apart EMG](https://pubmed.ncbi.nlm.nih.gov/35391860/)

---

## Isolation (arms, delts, traps, calves)

**Key findings**

- Curls: EZ ≥ barbell > dumbbell for both biceps and brachioradialis, with
  modest differences (Marcolin 2018) — grip shifts emphasis, it never removes
  either muscle, so bicep curl (10/4) and hammer curl (8/8) stay in the same
  band.
- Lateral raise: the supraspinatus is a working co-abductor throughout the
  raise, comparably active in full-can and empty-can positions
  (Reinold 2007) — upgraded from stabilizer 2 to supporting 4. Upper-trap
  involvement is substantial and grows toward 90° (Coratella 2020) — traps 3.
- External rotation: side-lying ER produces the highest infraspinatus
  (~62% MVIC) and teres minor (~67%) with the posterior delt minimized at 0°
  abduction (Reinold 2004) — rotator_cuff 10, rear_delts 4.
- Shrug: top-tier upper-trap EMG among common exercises (Ekstrom 2003
  lineage); forearms 5 for the unstrapped grip.
- Calf raise: plantarflexion is gastrocnemius + soleus. Knee angle changes
  gastrocnemius length, not hamstring drive (Signorile 2002; Arampatzis
  2006) — the old hamstrings 2 row was removed entirely.

**Sources**

- [Marcolin et al. 2018, *PeerJ* — barbell/EZ/dumbbell curl EMG](https://peerj.com/articles/5165/)
- [Reinold et al. 2007, *J Athl Train* — full-can vs empty-can supraspinatus](https://pmc.ncbi.nlm.nih.gov/articles/PMC2140071/)
- [Reinold et al. 2004, *J Orthop Sports Phys Ther* — shoulder external rotation EMG](https://www.jospt.org/doi/10.2519/jospt.2004.34.7.385)
- [Coratella et al. 2020, *IJERPH* — lateral/frontal raise variations](https://pmc.ncbi.nlm.nih.gov/articles/PMC7503819/)
- [Ekstrom et al. 2003, *J Orthop Sports Phys Ther* — trapezius & serratus EMG](https://www.jospt.org/doi/10.2519/jospt.2003.33.5.247)
- [Signorile et al. 2002 / knee angle & triceps surae EMG](https://www.sciencedirect.com/science/article/abs/pii/S1360859220301753)

---

## Carries & hangs

**Key findings**

- Farmer's carry: maximal grip demand with high oblique/QL activation
  stiffening the spine laterally while it stays near neutral (McGill,
  McDermott & Fenwick 2009) — big forearms/obliques, modest lower_back. The
  pickup and propulsion resemble a deadlift (Winwood 2014), earning a small
  glutes row; glute med resists pelvic drop every step (Stastny 2015). The
  timed and distance-measured versions are the same movement and are tested
  to stay score-identical.
- Dead hang: finger-flexor dominated (climbing EMG literature); the lat is
  largely on passive stretch, so its score dropped from 5 to 3.

**Sources**

- [McGill, McDermott & Fenwick 2009, *J Strength Cond Res* — strongman events](https://pubmed.ncbi.nlm.nih.gov/19387373/)
- [Winwood et al. 2014 — farmer's walk biomechanics vs deadlift](https://www.researchgate.net/publication/262300415_A_Biomechanical_Analysis_of_the_Farmers_Walk_and_Comparison_with_the_Deadlift_and_Unloaded_Walk)
- [Stastny et al. 2015, *J Hum Kinet* — glute med in the farmer's walk](https://pmc.ncbi.nlm.nih.gov/articles/PMC4415828/)
- [Dead-hang forearm EMG in climbers, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10249616/)

---

## Core

**Key findings**

- Hanging knee/leg raises sit in the top tier for *both* rectus abdominis and
  external obliques across every ab-exercise comparison (Escamilla 2006) —
  both score abs 10. Straight legs lengthen the lever, so the leg raise keeps
  hip_flexors 10 and the knee raise drops to 9.
- Bicycle crunch: ranked #1 of 13 exercises for rectus (≈2.5× a standard
  crunch) and #2 for obliques in the ACE/Francis 2001 study — abs 9.
- Copenhagen plank: adductor longus at 108% normalized EMG, the highest of
  eight adductor exercises (Serner 2014) — the catalog's adductor ceiling,
  and a test asserts nothing else reaches it.
- Side plank (side bridge): glute med ~74% MVIC and external oblique ~69%
  (Ekstrom 2007) — the glute med is a genuine strong secondary (7), not a
  bystander.
- Glute med hierarchy: side-lying abduction > single-leg squat > lateral band
  walk > clam (Distefano 2009; Boren 2011's banded-clam progressions land
  higher) — encoded as lateral_walk > clam_shell.
- Static stabilization moves (plank, dead bug, bird dog) score below dynamic
  flexion peers by design — isometric core work reads lower on EMG at similar
  effort (Escamilla 2006; Oliva-Lozano & Muyor 2020 review).
- No exercise-specific EMG exists for the Pallof press, mountain climber,
  woodchopper, or jumping jacks; those scores are clinical/coaching
  consensus, flagged as such in the seed file.

**Orderings encoded in tests:** hip_flexors hanging_leg_raise >
hanging_knee_raise; glute_med lateral_walk > clam_shell; adductors
copenhagen_plank = catalog ceiling.

**Sources**

- [Escamilla et al. 2006, *Phys Ther* — twelve ab exercises, RA & EO EMG](https://pubmed.ncbi.nlm.nih.gov/16649890/)
- [ACE / Francis 2001 — thirteen ab exercises ranked](https://www.acefitness.org/about-ace/press-room/in-the-news/246/american-council-on-exercise-ace-sponsored-study-reveals-best-and-worst-abdominal-exercises/)
- [Serner et al. 2014, *Br J Sports Med* — eight adductor exercises](https://pubmed.ncbi.nlm.nih.gov/24124040/)
- [Ekstrom et al. 2007, *J Orthop Sports Phys Ther* — nine rehab exercises](https://www.jospt.org/doi/10.2519/jospt.2007.2471)
- [Distefano et al. 2009, *J Orthop Sports Phys Ther* — glute med hierarchy](https://www.jospt.org/doi/10.2519/jospt.2009.2796)
- [Boren et al. 2011, *Int J Sports Phys Ther* — glute med/max rehab EMG](https://pubmed.ncbi.nlm.nih.gov/22163090/)
- [Oliva-Lozano & Muyor 2020, *IJERPH* — core EMG systematic review](https://pubmed.ncbi.nlm.nih.gov/32560185/)
- [Copenhagen adduction systematic review, *Int J Sports Phys Ther* 2021](https://ijspt.scholasticahq.com/article/27975)
