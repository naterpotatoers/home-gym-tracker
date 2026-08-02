import { Note, Section, Stat, Td, Th } from "@/components/ui";
import { bars, dumbbells, hipBands, plates } from "@/lib/data/equipment";
import { exerciseById } from "@/lib/data/exercises";
import { modalities, modalityById } from "@/lib/data/modalities";
import { loadGymData } from "@/lib/db/snapshot";
import { loadableWeights, smallestIncrement } from "@/lib/loading";
import { deriveLoadFactor, effectiveLoadFactor } from "@/lib/modality";
import {
  availableVariants,
  blocksFor,
  clientSummaries,
  describeSet,
  hipBandLadder,
  muscleVolumeByGroup,
  musclesWithoutPrimary,
  personalRecords,
  sessionsFor,
} from "@/lib/queries";

/** Data reference: inventory, modality tradeoffs, and worked examples of the
 *  modeling decisions (per-set modality, ordinal loads, load factors). */
export default async function LibraryPage() {
  const data = await loadGymData();
  const summaries = clientSummaries(data);
  const variants = availableVariants();
  const ohioLoads = loadableWeights("ohio_bar");
  const volume = muscleVolumeByGroup(data, "nate");
  const noPrimary = musclesWithoutPrimary();

  // 2026-06-15 is the session with the deliberate mid-bench implement switch.
  const switchSession = sessionsFor(data, "nate").find((s) => s.date === "2026-06-15");
  // Lidia's latest shows band assistance and the 2.5 lb barbell step.
  const lidiaSession = sessionsFor(data, "lidia").at(0);
  const dbBenchFactor = deriveLoadFactor(data, "nate", "bench_press", "dumbbell");
  const dbBenchEffective = effectiveLoadFactor(data, "nate", "bench_press", "dumbbell");
  const records = personalRecords(data, "nate").slice(0, 6);

  const maxVolume = Math.max(
    ...volume.flatMap((g) => g.rows.map((r) => r.weightedVolumeLbs)),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Library</h1>
      <p className="mt-2 text-sm opacity-70">
        {summaries.length} people · {variants.length} available exercise variants ·{" "}
        {ohioLoads.length} loadable barbell weights
      </p>

      {/* ---------------------------------------------------------------- */}
      <Section title="Clients">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-current/20 text-left">
              <Th>Name</Th>
              <Th>Age</Th>
              <Th>Bodyweight</Th>
              <Th>Level</Th>
              <Th>Goal</Th>
              <Th numeric>Sessions</Th>
              <Th>Last</Th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ client, age, bodyweightLbs, bodyweightChangeLbs, sessionCount, lastSessionDate }) => (
              <tr key={client.id} className="border-b border-current/10">
                <Td>
                  {client.firstName}
                  {client.isTrainer && (
                    <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs">
                      trainer
                    </span>
                  )}
                </Td>
                <Td>{age}</Td>
                <Td>
                  {bodyweightLbs ?? "—"} lb
                  {bodyweightChangeLbs !== null && (
                    <span className="ml-1 text-xs opacity-60">
                      ({bodyweightChangeLbs > 0 ? "+" : ""}
                      {bodyweightChangeLbs})
                    </span>
                  )}
                </Td>
                <Td>{client.experienceLevel}</Td>
                <Td>{client.goal}</Td>
                <Td numeric>{sessionCount}</Td>
                <Td>{lastSessionDate ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>
          Age is derived from date of birth and bodyweight from the weigh-in
          history, so neither can go stale.
        </Note>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {switchSession && (
        <Section title={`Nate — ${switchSession.date}`}>
          <p className="mb-4 text-sm opacity-70">{switchSession.notes}</p>
          <div className="space-y-4">
            {blocksFor(data, switchSession.id).map((block, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold">
                  {exerciseById.get(block.exerciseId)?.name}
                  <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs font-normal">
                    {modalityById.get(block.modalityId)?.name}
                  </span>
                </h3>
                <ul className="mt-1 space-y-0.5 text-sm opacity-80">
                  {block.sets.map((set) => (
                    <li key={set.id} className="font-mono text-xs">
                      {set.setNumber}. {describeSet(data, set)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Note>
            Bench Press appears twice because the implement changed mid-session.
            Each set carries its own modality, so the switch is a recorded fact
            rather than two rows that look like a duplicate.
          </Note>
        </Section>
      )}

      {/* ---------------------------------------------------------------- */}
      {lidiaSession && (
        <Section title={`Lidia — ${lidiaSession.date}`}>
          <p className="mb-4 text-sm opacity-70">{lidiaSession.notes}</p>
          <div className="space-y-4">
            {blocksFor(data, lidiaSession.id).map((block, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold">
                  {exerciseById.get(block.exerciseId)?.name}
                  <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs font-normal">
                    {modalityById.get(block.modalityId)?.name}
                    {block.sets[0].bandRole === "assistance" && " · assisted"}
                  </span>
                </h3>
                <ul className="mt-1 space-y-0.5 text-sm opacity-80">
                  {block.sets.map((set) => (
                    <li key={set.id} className="font-mono text-xs">
                      {set.setNumber}. {describeSet(data, set)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Note>
            Her assisted pull-ups are <strong>band assistance</strong>, not
            resistance — the band removes load instead of adding it, and needs no
            separate exercise. Across her four sessions she moved green → blue,
            which is real progress that no weight column would show. The squat at
            67.5 lb is a 2.5 lb step up from the previous session; before the
            change plates the next loadable weight was 85 lb.
          </Note>
        </Section>
      )}

      {/* ---------------------------------------------------------------- */}
      <Section title="Dumbbell : barbell bench ratio (Nate)">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <Stat label="Seeded factor" value="0.85" />
          <Stat label="Measured" value={dbBenchFactor.factor.toFixed(2)} />
          <Stat
            label="Sample"
            value={`${dbBenchFactor.sampleSize} sets / ${dbBenchFactor.sessionCount} sessions`}
          />
          <Stat
            label="In use"
            value={`${dbBenchEffective.factor.toFixed(2)} (${
              dbBenchEffective.ceilingLimited ? "seed" : dbBenchEffective.source
            })`}
          />
        </dl>
        {dbBenchFactor.ceilingLimited && (
          <Note>
            The measured {dbBenchFactor.factor.toFixed(2)} is flagged
            ceiling-limited: every working set sat at the 50 lb dumbbell, so
            100 lb total is the hard cap and extra reps can only understate the
            real ratio. The seed is used instead until heavier dumbbells or a
            loadable handle exist.
          </Note>
        )}
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Per-muscle volume (Nate, all time)">
        <div className="space-y-5">
          {volume.map((group) => (
            <div key={group.groupId}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
                {group.label}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.muscleId}>
                      <td className="w-52 py-0.5">{row.name}</td>
                      <td className="w-14 py-0.5 text-right font-mono text-xs opacity-60">
                        {row.peakScore}/10
                      </td>
                      <td className="py-0.5 pl-3">
                        <div className="h-2 w-full rounded bg-current/10">
                          <div
                            className="h-2 rounded bg-current/50"
                            style={{
                              width: `${Math.max(
                                row.weightedVolumeLbs > 0 ? 1 : 0,
                                (row.weightedVolumeLbs / maxVolume) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="w-36 py-0.5 text-right font-mono text-xs">
                        {row.weightedVolumeLbs > 0
                          ? `${Math.round(row.weightedVolumeLbs).toLocaleString()} lb`
                          : "—"}
                        {row.ordinalReps > 0 && (
                          <span className="ml-1 opacity-60">
                            +{Math.round(row.ordinalReps)} ord
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <Note>
          Volume is score-weighted: each set counts toward every muscle it
          trains, scaled by how directly it trains it. &ldquo;ord&rdquo; is
          ordinal work — hip-band sets have no pound value, so they are counted
          as reps rather than folded into a pounds total they cannot support.
          Glute med is mostly ordinal for exactly this reason.
          {noPrimary.length > 0 && (
            <>
              {" "}
              Muscles with no primary exercise in the library:{" "}
              <strong>{noPrimary.join(", ")}</strong> — by design, since it is a
              stabilizer rather than a training target.
            </>
          )}
        </Note>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Top estimated 1RMs (Nate)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-current/20 text-left">
              <Th>Exercise</Th>
              <Th>Modality</Th>
              <Th numeric>Best e1RM</Th>
              <Th numeric>Heaviest</Th>
              <Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={`${r.exerciseId}-${r.modalityId}`} className="border-b border-current/10">
                <Td>{exerciseById.get(r.exerciseId)?.name}</Td>
                <Td>{modalityById.get(r.modalityId)?.name}</Td>
                <Td numeric>{Math.round(r.bestE1rmLbs)} lb</Td>
                <Td numeric>{r.heaviestLbs} lb</Td>
                <Td>{r.date}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Modality tradeoffs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-current/20 text-left">
              <Th>Modality</Th>
              <Th numeric>Stability</Th>
              <Th numeric>Load factor</Th>
              <Th numeric>ROM</Th>
              <Th>Resistance</Th>
              <Th>Precision</Th>
              <Th numeric>Skill</Th>
            </tr>
          </thead>
          <tbody>
            {modalities.map((m) => (
              <tr
                key={m.id}
                className={`border-b border-current/10 ${m.owned ? "" : "opacity-40"}`}
              >
                <Td>
                  {m.name}
                  {!m.owned && <span className="ml-2 text-xs">(not owned)</span>}
                </Td>
                <Td numeric>{m.stabilityDemand}</Td>
                <Td numeric>{m.seedLoadFactor?.toFixed(2) ?? "—"}</Td>
                <Td numeric>{m.romQuality}</Td>
                <Td>{m.resistanceProfile}</Td>
                <Td>{m.defaultLoadPrecision ?? "per band"}</Td>
                <Td numeric>{m.skillDemand}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>
          Band resistance is <em>ascending</em> — hardest at end range, easiest
          at the stretch. That is a drawback when a band adds load, but close to
          ideal when it removes it: an assisted pull-up gets the most help at the
          bottom, where you are weakest.
        </Note>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Inventory">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Stat
            label="Bars"
            value={bars.map((b) => `${b.name} ${b.weightLbs} lb`).join(" · ")}
          />
          <Stat
            label="Plate pairs"
            value={plates.map((p) => p.weightLbs).join(", ")}
          />
          <Stat
            label="Barbell range"
            value={`${ohioLoads[0]} – ${ohioLoads.at(-1)} lb in ${smallestIncrement("ohio_bar")} lb steps (${ohioLoads.length} loads, no gaps)`}
          />
          <Stat
            label="Dumbbells"
            value={`${dumbbells.map((d) => d.weightLbs).join(", ")} lb — ${
              (dumbbells[1].weightLbs - dumbbells[0].weightLbs) * 2
            } lb minimum total jump`}
          />
          <Stat
            label="Hip bands (easiest → hardest)"
            value={hipBandLadder()
              .map(({ band }) => `${band.label} ${band.sizeInches}"`)
              .join(" → ")}
          />
          <Stat label="Kettlebells" value="none" />
        </dl>
        <Note>
          With the change plates the barbell steps 2.5 lb while the fixed
          dumbbells step 10 lb total — so the barbell is now the finer
          progression tool, which inverts the usual beginner advice. Pick
          dumbbells for stability, range of motion, and asymmetry work, not for
          load precision. Hip band rank is derived from circumference:{" "}
          {hipBands.map((b) => `${b.sizeInches}"`).join(" and ")} — smaller is
          harder.
        </Note>
      </Section>
    </main>
  );
}
