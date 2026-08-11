# Physical therapy & rehab references

The evidence behind the app's rehab/prehab additions: the PT-style exercises
added to the seed catalog (Aug 2026) and the six pre-built **Care routines**
(`src/lib/data/care-routines.ts`). Companion to
[exercise-scoring-references.md](./exercise-scoring-references.md), which
covers the strength catalog — same deal: the numbers live in code, this page
is why they are what they are. Keep prescriptions and doc in sync.

> **This is not medical advice.** The Care routines are general conditioning
> templates for healthy people with everyday complaints — a stiff back after
> deadlifts, cranky knees on stairs, desk shoulders. They are not a diagnosis
> or a treatment plan. Pain that is sharp, worsening, persistent beyond a few
> weeks, or accompanied by numbness/weakness/night pain belongs with a
> clinician, not a template. As a working rule during any of these routines:
> discomfort up to ~5/10 that settles by the next morning is acceptable
> tendon-loading territory (Silbernagel 2007); anything beyond that means
> back off.

## How the routines were built

Every exercise selection and prescription carries an **evidence tier**, and
the tiers are honest — rehab culture is full of confident claims the
literature doesn't support:

- **[RCT / SR-MA]** — randomized trials, systematic reviews, meta-analyses.
  The strongest tier; used for *what to do* (e.g. hip + knee strengthening
  for kneecap pain).
- **[EMG]** — activation studies. Good for *which exercise hits which
  muscle*; says nothing about clinical outcomes by itself.
- **[consensus]** — clinical practice and coaching convention with no direct
  studies. Included when mechanically sensible, always labeled.

Claims this document deliberately does **not** make, because the evidence
doesn't: that any exercise "activates dormant muscles" (gluteal amnesia is
coaching lore — even post-ACL-injury glute inhibition evidence is limited);
that TKEs "target the VMO" (17 of 20 EMG studies say the VMO can't be
preferentially activated — Smith 2009); that posture work prevents pain (the
posture–pain link is weak — Slater 2019); that dead hangs decompress
shoulders (zero peer-reviewed support); or that tibialis raises prevent shin
splints (strengthening is unproven for MTSS — Winters 2013).

---

## Low back — "Care: Low Back (McGill Big 3)"

**What the evidence says**

- Exercise clearly helps chronic low back pain: the 2021 Cochrane review
  (249 trials, ~24,500 participants) found meaningful pain and function
  improvements vs usual care [SR/MA — Hayden 2021]. The Owen 2020 network
  meta-analysis ranks stabilization/motor-control work among the best
  exercise types for function [SR/MA]. The honest headline: *doing
  structured exercise matters more than which type*.
- Core-stability exercise beats general exercise short-term for pain and
  function [SR/MA — Coulombe 2017; Wang 2012], converging at long-term
  follow-up.
- The McGill Big 3 specifically (curl-up, side plank, bird dog) is
  trial-tested with results roughly equivalent to conventional PT, trending
  better [RCT — Ghorbanpour 2018]. Spine-sparing rationale: repeated
  loaded flexion herniates porcine discs [mechanistic — Callaghan & McGill
  2001], and sit-ups impose ~3,300 N of lumbar compression — hence the
  neutral-spine curl-up for symptomatic backs. Counterpoint cited honestly:
  the flexion-injury claim for *healthy* spines is "highly speculative"
  (Contreras & Schoenfeld 2011) — which is why the catalog keeps sit-ups and
  crunches for training and reserves the curl-up for care work.
- McGill's actual dosage [consensus — McGill 2015]: short ~8–10s braced
  holds (never long ones), descending-pyramid reps (5-3-1 style), progress
  by adding reps not seconds, daily practice, cat-camel as prep, and avoid
  loaded flexion in the first hour after waking.

**How the routine reflects it:** cat-cow prep → curl-up, side plank, and
bird dog all as short 10s holds in pyramid style → glute bridge for
hip-dominant patterning → child's pose flagged "skip if end-range flexion
aggravates symptoms." The McGill curl-up scores abs 6 on purpose — it's
deliberately sub-maximal (sit-up 9, bicycle crunch 9).

**Sources**

- [Hayden et al. 2021, *Cochrane Database Syst Rev* — exercise for chronic LBP](https://pubmed.ncbi.nlm.nih.gov/34580864/)
- [Owen et al. 2020, *Br J Sports Med* — network meta-analysis of exercise types](https://doi.org/10.1136/bjsports-2019-100886)
- [Coulombe et al. 2017, *J Athl Train* — core stability vs general exercise](https://doi.org/10.4085/1062-6050-51.11.16)
- [Wang et al. 2012, *PLOS One* — core stability meta-analysis](https://doi.org/10.1371/journal.pone.0052082)
- [Ghorbanpour et al. 2018, *J Phys Ther Sci* — McGill exercises RCT](https://pubmed.ncbi.nlm.nih.gov/29706690/)
- [Callaghan & McGill 2001, *Clin Biomech* — flexion + compression disc model](https://pubmed.ncbi.nlm.nih.gov/11114441/)
- [Contreras & Schoenfeld 2011, *Strength Cond J* — the crunch counterpoint](https://doi.org/10.1519/SSC.0b013e3182259d05)
- [McGill 2015, *Low Back Disorders* 3rd ed. — Big 3 prescription](https://www.backfitpro.com/pdf/selecting_back_exercises.pdf)

---

## Knee (patellofemoral) — "Care: Knee (Patellofemoral)"

**What the evidence says**

- The best-supported recipe for kneecap pain is **hip + knee strengthening
  together**: hip work beat quad-only work outright in Khayambashi 2014
  [RCT]; hip/core resolved pain earlier in Ferber 2015 [RCT, n=199];
  proximal-plus-local wins in meta-analysis [SR/MA — Lack 2015, Nascimento
  2018]; and it's a Grade A recommendation in the JOSPT clinical practice
  guideline [consensus/CPG — Willy 2019]. The routine's 3 quad + 3 hip
  exercise structure is that recipe.
- Quad work is supported *as a class* — open and closed chain both produce
  good long-term outcomes [RCT — Witvrouw 2000/2004]. The TKE is included as
  a well-tolerated low-load entry point [consensus], **not** as a VMO
  targeter (debunked — Smith 2009 EMG review).
- Wall-sit isometrics: 45s heavy holds produced immediate ~45-minute pain
  relief in patellar tendinopathy [RCT — Rio 2015]; isometric and isotonic
  programs end up equal at 4 weeks [RCT — van Ark 2016]. Applying this to
  PFP is an extrapolation across diagnoses — labeled as such — and the
  studied dose is heavier than a bodyweight wall sit, hence the routine's
  "build toward 4–5×45s" note.
- Step exercises carry direct RCT support at ~2–4 sets of 10+ reps for ≥6
  weeks [SR — Harvie 2011]; the 3s-lowering emphasis is [consensus].
- Restricted ankle dorsiflexion predicts patellar tendinopathy [prospective
  cohort — Backman & Danielson 2011] and associates with knee valgus
  [SR/MA — Lima 2018]; the knee-to-wall stretch addresses it, with modest
  expected ROM gains (~2–3° from calf stretching [SR/MA — Radford 2006]).

**Sources**

- [Khayambashi et al. 2014, *Arch Phys Med Rehabil* — hip beats quads for PFP](https://pubmed.ncbi.nlm.nih.gov/24440362/)
- [Ferber et al. 2015, *J Athl Train* — multicenter hip/core vs knee RCT](https://pubmed.ncbi.nlm.nih.gov/25365133/)
- [Lack et al. 2015, *Br J Sports Med* — proximal rehab meta-analysis](https://pubmed.ncbi.nlm.nih.gov/26175019/)
- [Nascimento et al. 2018, *JOSPT* — hip+knee > knee-only](https://www.jospt.org/doi/10.2519/jospt.2018.7365)
- [Willy et al. 2019, *JOSPT* — PFP clinical practice guideline](https://www.jospt.org/doi/10.2519/jospt.2019.0302)
- [Rathleff et al. 2015, *Br J Sports Med* — exercise + education cluster RCT](https://pubmed.ncbi.nlm.nih.gov/25388961/)
- [Witvrouw et al. 2004, *Am J Sports Med* — open vs closed chain, 5-year follow-up](https://pubmed.ncbi.nlm.nih.gov/15262632/)
- [Harvie et al. 2011 — systematic review of PFP exercise parameters](https://pubmed.ncbi.nlm.nih.gov/22135495/)
- [Rio et al. 2015, *Br J Sports Med* — isometric analgesia in patellar tendinopathy](https://pubmed.ncbi.nlm.nih.gov/25979840/)
- [van Ark et al. 2016, *J Sci Med Sport* — isometric vs isotonic in-season](https://www.sciencedirect.com/science/article/abs/pii/S1440244015002315)
- [Backman & Danielson 2011, *Am J Sports Med* — dorsiflexion predicts tendinopathy](https://pubmed.ncbi.nlm.nih.gov/21917610/)
- [Lima et al. 2018, *Phys Ther Sport* — dorsiflexion & dynamic knee valgus](https://www.sciencedirect.com/science/article/pii/S1466853X16301614)
- [Radford et al. 2006, *Br J Sports Med* — calf stretching meta-analysis](https://pubmed.ncbi.nlm.nih.gov/16926259/)

---

## Shoulder — "Care: Shoulder (Cuff & Scapula)"

**What the evidence says**

- Exercise is first-line for rotator-cuff/subacromial pain: significant
  pain and function gains, with **home programs as effective as supervised
  ones** [SR — Kuhn 2009]; a specific eccentric-cuff + scapular program
  reduced the need for surgery [RCT — Holmgren 2012, BMJ]; exercise beats
  non-exercise across trials [SR/MA — Steuri 2017].
- **Scapular push-up (push-up plus)**: the canonical serratus exercise —
  ~120% MVIC in the plus phase with the lowest upper-trap:serratus ratio
  [EMG — Ludewig 2004] — and one of the best subscapularis exercises as a
  bonus [EMG — Decker 2003]. That's why it's the catalog's serratus 10.
- **Scaption (full-can)**: supraspinatus works as hard as in the empty-can
  but with less deltoid compensation and no impingement position [EMG —
  Reinold 2007] — hence thumbs-up, stopped at shoulder height.
- **External rotation**: side-lying ER is the highest-activation cuff
  isolation [EMG — Reinold 2004]. **Internal rotation** is the balance
  counterpart, but band IR gets heavy pec/lat assistance and the landmark
  RCTs succeeded without it — scored rotator_cuff 6 and given the lowest
  volume in the routine [EMG — Decker 2003; consensus].
- **Prone Y-T-W**: the prone-Y position tops lower-trap EMG (~97% MVIC)
  [EMG — Ekstrom 2003] and the T-with-external-rotation is among Cools
  2007's preferred low-upper-trap exercises [EMG]. Cue: pain-free range —
  above-90° positions can provoke an irritable shoulder.
- **Band pull-apart**: palms-up biases lower trap + infraspinatus; the
  classic palms-down grip biases upper trap + rear delt [EMG — Sgroi 2022]
  — the routines cue palms-up.
- **Face pull** has no dedicated EMG study — supported by extension from
  the rowing/horizontal-abduction literature [consensus].
- **Dead hang**: no peer-reviewed evidence at all (the popular claims trace
  to a self-published, uncontrolled case series) [consensus/anecdote] —
  included as optional stretch/grip work, flagged to skip if painful.

**Sources**

- [Kuhn 2009, *J Shoulder Elbow Surg* — exercise for impingement, SR of 11 RCTs](https://pubmed.ncbi.nlm.nih.gov/18835532/)
- [Holmgren et al. 2012, *BMJ* — specific exercise strategy RCT](https://pubmed.ncbi.nlm.nih.gov/22349588/)
- [Steuri et al. 2017, *Br J Sports Med* — meta-analysis](https://pubmed.ncbi.nlm.nih.gov/28630217/)
- [Ludewig et al. 2004, *Am J Sports Med* — push-up plus serratus EMG](https://journals.sagepub.com/doi/10.1177/0363546503258911)
- [Decker et al. 2003, *Am J Sports Med* — subscapularis exercise EMG](https://journals.sagepub.com/doi/10.1177/03635465030310010601)
- [Reinold et al. 2007, *J Athl Train* — full-can vs empty-can](https://pmc.ncbi.nlm.nih.gov/articles/PMC2140071/)
- [Reinold et al. 2004, *JOSPT* — external rotation EMG](https://pubmed.ncbi.nlm.nih.gov/15296366/)
- [Ekstrom et al. 2003, *JOSPT* — prone Y lower-trap EMG](https://www.jospt.org/doi/10.2519/jospt.2003.33.5.247)
- [Cools et al. 2007, *Am J Sports Med* — scapular exercise selection](https://pubmed.ncbi.nlm.nih.gov/17606671/)
- [Sgroi et al. 2022, *Int J Sports Phys Ther* — pull-apart grip/direction EMG](https://pubmed.ncbi.nlm.nih.gov/35391860/)
- [Silbernagel et al. 2007, *Am J Sports Med* — the pain-monitoring model](https://journals.sagepub.com/doi/abs/10.1177/0363546506298279)

---

## Hips & glute med — "Care: Hips & Glute Activation"

**What the evidence says**

- The glute-med EMG hierarchy [EMG — Distefano 2009; Boren 2011; Reiman
  2012]: **side-lying hip abduction tops the list (81% MVIC)** — the new
  catalog exercise and its glute_med 10; banded lateral walk lands
  mid-hierarchy (~61%) but climbs with the band at the **ankles or feet**
  [EMG — Cambridge 2012], which the routine cues; the basic clam is modest
  (~40% MVIC) — its virtue is the best glute-to-TFL specificity of the
  drills [EMG — Selkowitz 2013], which is why it stays in the routine but
  was rescored to glute_med 7.
- Hip-abductor strengthening has real clinical wins: ITBS runners returned
  to pain-free running after six weeks of abductor rehab [case-control +
  intervention — Fredericson 2000], and hip strengthening treats PFP (see
  knee section). Honest framing: weakness hasn't been shown to *cause*
  these problems prospectively [SR — Mucha 2017] — strengthening helps
  recovery; it isn't fixing a proven defect.
- "Glute activation / gluteal amnesia" is coaching lore — no study shows
  glutes "shut off" from sitting [SR-adjacent; even post-ACL inhibition
  evidence is limited]. The routine name says *activation* in the
  colloquial warm-up sense; the mechanism claim stops there.

**Sources**

- [Distefano et al. 2009, *JOSPT* — glute med EMG hierarchy](https://www.jospt.org/doi/10.2519/jospt.2009.2796)
- [Boren et al. 2011, *Int J Sports Phys Ther* — glute med/max rehab EMG](https://pubmed.ncbi.nlm.nih.gov/22034614/)
- [Reiman et al. 2012, *Physiother Theory Pract* — activation thresholds review](https://pubmed.ncbi.nlm.nih.gov/22007858/)
- [Selkowitz et al. 2013, *JOSPT* — glute:TFL activation index](https://www.jospt.org/doi/10.2519/jospt.2013.4116)
- [Cambridge et al. 2012, *Clin Biomech* — band placement and glute EMG](https://www.sciencedirect.com/science/article/abs/pii/S0268003312000460)
- [Fredericson et al. 2000, *Clin J Sport Med* — ITBS hip-abductor rehab](https://pubmed.ncbi.nlm.nih.gov/10959926/)
- [Mucha et al. 2017, *J Sci Med Sport* — abductor weakness & injury review](https://pubmed.ncbi.nlm.nih.gov/27693442/)

---

## Posture & upper back — "Care: Posture & Upper Back"

**What the evidence says**

- Strengthening the scapular retractors + stretching the pecs measurably
  improves head/shoulder posture angles [RCT — Ruivo 2017 (adolescents,
  16 weeks); Harman 2005 (adults, 10 weeks); SR/MA — 2024 upper-crossed
  meta-analysis]. Effects are modest and fade on detraining.
- **The honest hedge, stated up front**: the posture–pain link is weak, and
  no "correct" posture is proven protective [consensus/expert — Slater
  2019, JOSPT; Hrysomallis 2010]. This routine builds shoulder health and
  may ease long-sitting discomfort; it is not sold as pain prevention.
- **Wall slide**: serratus activation not significantly different from the
  push-up plus at/above 90° of elevation [EMG — Hardwick 2006] — a valid
  low-load home serratus/control drill (kept scoreless in the catalog as a
  mobility movement).
- **Prone Y-T-W** and **palms-up band pull-aparts** carry the same EMG
  support as in the shoulder section (Ekstrom 2003; Cools 2007; Sgroi
  2022). **Doorway stretch**: the unilateral doorway/corner position
  produced the greatest pec-minor length change of the stretches tested
  [biomech — Borstad & Ludewig 2006]. Thread-the-needle is thoracic-rotation
  rationale only [consensus].

**Sources**

- [Ruivo et al. 2017, *J Manipulative Physiol Ther* — posture RCT](https://doi.org/10.1016/j.jmpt.2016.10.005)
- [Harman et al. 2005, *J Man Manip Ther* — forward-head posture RCT](https://doi.org/10.1179/106698105790824888)
- [Hrysomallis 2010, *J Strength Cond Res* — posture-correction review](https://pubmed.ncbi.nlm.nih.gov/20072041/)
- [Upper-crossed-syndrome exercise meta-analysis 2024, *BMC Musculoskelet Disord*](https://pubmed.ncbi.nlm.nih.gov/38302926/)
- [Hardwick et al. 2006, *JOSPT* — wall slide serratus EMG](https://doi.org/10.2519/jospt.2006.2306)
- [Borstad & Ludewig 2006, *J Shoulder Elbow Surg* — pec minor stretches](https://pubmed.ncbi.nlm.nih.gov/16679233/)
- [Slater et al. 2019, *JOSPT* — "Sit Up Straight": time to re-evaluate](https://doi.org/10.2519/jospt.2019.0610)

---

## Ankle, Achilles & hamstrings — "Care: Ankle, Achilles & Hamstrings"

**What the evidence says**

- **Eccentric calf work** is the classic Achilles-tendinopathy protocol
  [cohort — Alfredson 1998: 3×15 twice daily, all 15 athletes returned to
  running], but the modern reading is that *progressive load* is the active
  ingredient, not the exact dose: heavy-slow resistance 3×/week matched the
  Alfredson protocol with better satisfaction [RCT — Beyer 2015], no
  protocol is clearly superior [SR/MA — Murphy 2018], and do-as-tolerated
  volume was non-inferior [RCT — Stevens & Tan 2014]. Hence the routine's
  "progress by adding load" note. Alfredson also runs knee-bent sets for
  the soleus — worth adding as tolerance grows.
- **Nordic curls** are the hamstring-strain-prevention standout: ~60–70%
  injury reduction [cluster RCT — Petersen 2011, n=942], 2 vs 12 injuries
  [RCT — van der Horst 2015], roughly halved rates in meta-analysis [SR/MA
  — van Dyk 2019] (point estimate contested on methods — Impellizzeri 2021
  — so the effect is "probably large," not "exactly 51%"). Low volume works:
  ~2×4/week matched high-volume for fascicle and strength gains [RCT —
  Presland 2018], validating 3×3–5 — but gains detrain in ~2 weeks, so
  consistency beats volume.
- **Nordic vs RDL hamstring 10s are complementary, not redundant** [EMG —
  Bourne 2017]: Nordics preferentially load semitendinosus via knee
  flexion; RDL-pattern lifts load the biceps femoris long head (the sprint
  muscle) via hip extension. The single-leg RDL sits at 8 — load-limited by
  the dumbbell and balance, and it buys proprioception the bilateral lifts
  don't.
- **Tibialis raises**: labeled [consensus] — strengthening is *unproven*
  for shin splints [SR — Winters 2013], and the endurance deficit actually
  measured in MTSS athletes is in the *calf* [case-control — Madeley 2007].
  Included for balanced ankle strength and mechanical plausibility, nothing
  more.
- **Stretching**: static calf stretching adds a real but small ~2–3° of
  dorsiflexion [SR/MA — Radford 2006]; hamstring stretching improves ROM by
  ~8–12° over weeks [SR/MA — Medeiros 2016]. ROM claims only — strain
  prevention belongs to the Nordic, not the stretch.

**Sources**

- [Alfredson et al. 1998, *Am J Sports Med* — the original eccentric protocol](https://journals.sagepub.com/doi/10.1177/03635465980260030301)
- [Beyer et al. 2015, *Am J Sports Med* — heavy slow resistance RCT](https://pubmed.ncbi.nlm.nih.gov/26018970/)
- [Murphy et al. 2018, *Sports Med* — loading-protocol meta-analysis](https://pubmed.ncbi.nlm.nih.gov/29766442/)
- [Stevens & Tan 2014, *JOSPT* — do-as-tolerated eccentric RCT](https://www.jospt.org/doi/10.2519/jospt.2014.4720)
- [Petersen et al. 2011, *Am J Sports Med* — Nordic cluster RCT](https://pubmed.ncbi.nlm.nih.gov/21825112/)
- [van der Horst et al. 2015, *Am J Sports Med* — Nordic RCT](https://journals.sagepub.com/doi/abs/10.1177/0363546515574057)
- [van Dyk et al. 2019, *Br J Sports Med* — Nordic meta-analysis](https://pubmed.ncbi.nlm.nih.gov/30808663/)
- [Impellizzeri et al. 2021, *J Clin Epidemiol* — methods reappraisal](https://www.sciencedirect.com/science/article/abs/pii/S0895435621002870)
- [Presland et al. 2018, *Scand J Med Sci Sports* — low-volume Nordic RCT](https://pubmed.ncbi.nlm.nih.gov/29572976/)
- [Bourne et al. 2017, *Br J Sports Med* — hamstring exercise selection EMG/fMRI](https://pubmed.ncbi.nlm.nih.gov/27467123/)
- [Monajati et al. 2017, *J Hum Kinet* — Nordic vs leg-curl EMG](https://pmc.ncbi.nlm.nih.gov/articles/PMC5765783/)
- [Winters et al. 2013, *Sports Med* — MTSS treatment review](https://link.springer.com/article/10.1007/s40279-013-0087-0)
- [Madeley et al. 2007, *J Sci Med Sport* — MTSS calf-endurance deficit](https://www.sciencedirect.com/science/article/abs/pii/S1440244007000060)
- [Radford et al. 2006, *Br J Sports Med* — calf stretching meta-analysis](https://pubmed.ncbi.nlm.nih.gov/16926259/)
- [Medeiros et al. 2016, *Physiother Theory Pract* — hamstring stretching meta-analysis](https://www.tandfonline.com/doi/full/10.1080/09593985.2016.1204401)
