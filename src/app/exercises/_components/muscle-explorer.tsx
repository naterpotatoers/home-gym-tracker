"use client";

import { useState } from "react";
import { BodyFigure } from "@/components/body-figure";
import { ExerciseInfoSheet } from "@/components/exercise-info-sheet";
import { ModalityChip } from "@/components/modality-chip";
import { MuscleGroupLegend } from "@/components/muscle-group-legend";
import { ColorDot, toggleChipClass } from "@/components/ui";
import { bodyMap } from "@/lib/body-map";
import { MUSCLE_GROUP_COLORS, muscleById, muscleGroups, muscles } from "@/lib/data/muscles";
import { exercisesForMuscle, type ExerciseCatalog, type MuscleExercise } from "@/lib/exercise-catalog";
import type { ModalityId, MuscleId } from "@/lib/types";

/**
 * Library › Muscles: learn the body, then what trains it. Both figures are
 * colored by muscle group (legend below); tap a region — or a chip, which
 * also reaches deep muscles and keyboard users — for what the muscle does
 * and the exercises that hit it hardest. Tapping an exercise explains it.
 * The selection lives in ?muscle= (replaceState — no server round trip).
 */
export function MuscleExplorer({
  catalog,
  initialMuscle,
}: {
  catalog: ExerciseCatalog;
  initialMuscle: MuscleId | null;
}) {
  const [selected, setSelected] = useState<MuscleId | null>(initialMuscle);
  const [explaining, setExplaining] = useState<{ exerciseId: string; modalityId: ModalityId } | null>(null);

  function select(muscleId: MuscleId) {
    setSelected(muscleId);
    const url = new URL(window.location.href);
    url.searchParams.set("muscle", muscleId);
    window.history.replaceState(null, "", url);
  }

  const fill = (muscleId: MuscleId) => {
    const group = muscleById.get(muscleId)?.groupId;
    if (!group) return null;
    // The pick pops; everything else recedes to a tint of its group.
    const amount = selected === null ? 60 : selected === muscleId ? 95 : 18;
    return `color-mix(in oklab, ${MUSCLE_GROUP_COLORS[group]} ${amount}%, transparent)`;
  };

  const muscle = selected ? muscleById.get(selected) : undefined;
  const group = muscle ? muscleGroups.find((g) => g.id === muscle.groupId) : undefined;
  const lists = selected ? exercisesForMuscle(catalog, selected) : null;
  const deep = selected ? bodyMap[selected].some((r) => r.deep) : false;

  return (
    <div className="md:grid md:grid-cols-[minmax(0,26rem)_1fr] md:items-start md:gap-8">
      <div className="md:sticky md:top-20">
        <div className="mx-auto grid max-w-sm grid-cols-2 gap-3 md:max-w-none">
          {(["front", "back"] as const).map((view) => (
            <BodyFigure
              key={view}
              view={view}
              fill={fill}
              selected={selected}
              onSelect={select}
              label="Muscles"
              className="w-full"
            />
          ))}
        </div>
        <div className="mt-2 flex justify-center">
          <MuscleGroupLegend />
        </div>
      </div>

      <div className="mt-6 min-w-0 md:mt-0">
        {muscle && lists ? (
          <section aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{muscle.name}</h2>
              {group && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <ColorDot color={MUSCLE_GROUP_COLORS[group.id]} /> {group.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm">{muscle.about}</p>
            {deep && (
              <p className="mt-1 text-xs text-muted">Deep muscle — drawn as a dashed callout on the figure.</p>
            )}
            <ExerciseList
              title="Best for it"
              rows={lists.primary}
              onExplain={(row) => setExplaining({ exerciseId: row.exerciseId, modalityId: row.modalityIds[0] })}
            />
            <ExerciseList
              title="Also works it"
              rows={lists.secondary}
              onExplain={(row) => setExplaining({ exerciseId: row.exerciseId, modalityId: row.modalityIds[0] })}
            />
            {lists.primary.length + lists.secondary.length === 0 && (
              <p className="mt-4 text-sm text-muted">No exercise in the catalog trains it much yet.</p>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted">
            Tap a muscle on the body — or pick one below — to see what it does and what trains it.
          </p>
        )}

        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">All muscles</h3>
          {[...muscleGroups]
            .sort((a, b) => a.order - b.order)
            .map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex w-20 shrink-0 items-center gap-1.5 text-xs text-muted">
                  <ColorDot color={MUSCLE_GROUP_COLORS[g.id]} /> {g.label}
                </span>
                {muscles
                  .filter((m) => m.groupId === g.id)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={selected === m.id}
                      onClick={() => select(m.id)}
                      className={toggleChipClass(selected === m.id, "min-h-9 rounded-md px-2.5 text-xs pointer-coarse:min-h-11")}
                    >
                      {m.name}
                    </button>
                  ))}
              </div>
            ))}
        </div>
      </div>

      {explaining && (
        <ExerciseInfoSheet
          catalog={catalog}
          exerciseId={explaining.exerciseId}
          modalityId={explaining.modalityId}
          onClose={() => setExplaining(null)}
        />
      )}
    </div>
  );
}

function ExerciseList({
  title,
  rows,
  onExplain,
}: {
  title: string;
  rows: MuscleExercise[];
  onExplain: (row: MuscleExercise) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-accent-text">{title}</h3>
      <ul className="mt-1 divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map((row) => (
          <li key={row.exerciseId}>
            <button
              type="button"
              onClick={() => onExplain(row)}
              className="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 text-left text-sm hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60"
            >
              <span className="font-medium">{row.name}</span>
              {row.modalityIds.slice(0, 3).map((m) => (
                <ModalityChip key={m} modalityId={m} />
              ))}
              {row.modalityIds.length > 3 && (
                <span className="text-xs text-muted">+{row.modalityIds.length - 3}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
