import { MaintenanceSubmit } from "@/components/maintenance-submit";
import { Caret, summaryClass } from "@/components/ui";
import { importSeedExercises, resyncSeedCatalogScores } from "@/lib/actions/exercises";
import { exercises as seedExercises } from "@/lib/data/exercises";

/**
 * The Library's maintenance drawer: Import while the exercise tables are
 * empty, Re-sync (built-ins back to the shipped scores, aliases and cues)
 * once they aren't.
 */
export function CatalogMaintenance({ catalogEmpty }: { catalogEmpty: boolean }) {
  const count = seedExercises.length;
  return (
    <details className="group mt-8 rounded-xl border border-border bg-surface" open={catalogEmpty}>
      <summary className={summaryClass("rounded-xl px-4 py-2 text-sm font-semibold")}>
        <Caret /> Catalog maintenance
      </summary>
      <div className="border-t border-border px-4 py-3">
        {catalogEmpty ? (
          <>
            <h2 className="mb-2 font-semibold">Import the seed catalog</h2>
            <p className="mb-3 text-sm text-muted">
              The exercise tables are empty. Import the built-in catalog ({count} exercises with muscle scores,
              equipment variants and coaching cues) to start.
            </p>
            <form action={importSeedExercises}>
              <MaintenanceSubmit variant="primary" label="Import seed catalog" pendingLabel="Importing…" />
            </form>
          </>
        ) : (
          <>
            <h2 className="mb-2 font-semibold">Re-sync the built-ins</h2>
            <p className="mb-3 text-sm text-muted">
              Adds any built-in exercises and equipment options (like ankle weights) missing from your catalog —
              a built-in option you removed comes back — then overwrites muscle scores, alternative names and
              coaching cues for all {count} built-ins with the app&apos;s current versions. Use after the app
              ships new exercises or corrections. Score, name and cue edits you made on built-ins are discarded;
              custom exercises, exercise names and existing equipment options are untouched.
            </p>
            <form action={resyncSeedCatalogScores}>
              <MaintenanceSubmit
                label="Re-sync built-ins"
                pendingLabel="Re-syncing…"
                confirmText={`Add missing built-in exercises and equipment options, and overwrite muscle scores, alternative names and coaching cues for all ${count} built-in exercises with the app's current versions? Edits you made to those will be lost.`}
              />
            </form>
          </>
        )}
      </div>
    </details>
  );
}
