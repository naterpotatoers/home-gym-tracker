"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExercisePicker } from "@/components/exercise-picker";
import { Button, chipClass, NumberInput } from "@/components/ui";
import type { Variant } from "@/lib/queries";
import { MUSCLE_GROUP_COLORS, muscleGroups } from "@/lib/data/muscles";
import { modalities } from "@/lib/data/modalities";
import { progressHref, type ProgressParams } from "@/lib/progress-url";

function useNavigate(params: ProgressParams) {
  const router = useRouter();
  return (patch: Partial<ProgressParams>) =>
    router.replace(progressHref({ ...params, ...patch }), { scroll: false });
}

/** Person chips + the lift picker — the page-level scope controls. The lift
 *  picker is the same searchable, pattern-grouped modal used for swapping
 *  exercises mid-workout. */
export function ProgressControls({
  params,
  people,
  variants,
  selectedLabel,
}: {
  params: ProgressParams;
  people: { id: string; firstName: string; color: string | null }[];
  /** Trained variants for the selected person, picker-shaped. */
  variants: Variant[];
  selectedLabel: string | null;
}) {
  const navigate = useNavigate(params);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="flex flex-wrap gap-1">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => navigate({ client: person.id })}
            className={chipClass(params.client === person.id, "min-h-11 px-3 text-sm")}
          >
            {person.color && (
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: person.color }}
              />
            )}
            {person.firstName}
          </button>
        ))}
      </span>

      <span className="flex items-center gap-1 sm:ml-auto">
        <Button onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
          {selectedLabel ?? "Pick a lift…"}
        </Button>
        {params.exercise && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ exercise: "", modality: "" })}
            aria-label="Clear lift selection"
          >
            ✕
          </Button>
        )}
      </span>

      {pickerOpen && (
        <ExercisePicker
          variants={variants}
          onSelect={(variant) => {
            setPickerOpen(false);
            navigate({
              exercise: variant.exerciseModality.exerciseId,
              modality: variant.exerciseModality.modalityId,
            });
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/** The rep-range / weight inputs inside the exercise view's load explorer. */
export function LoadExplorerControls({
  params,
  field,
}: {
  params: ProgressParams;
  field: "reps" | "weight";
}) {
  const navigate = useNavigate(params);
  if (field === "reps") {
    return (
      <span className="inline-flex items-center gap-1">
        <NumberInput
          min={1}
          value={params.repMin}
          onChange={(v) => navigate({ repMin: v ?? 8 })}
          className="w-16"
        />
        <span className="text-muted">–</span>
        <NumberInput
          min={1}
          value={params.repMax}
          onChange={(v) => navigate({ repMax: v ?? 12 })}
          className="w-16"
        />
      </span>
    );
  }
  return (
    <NumberInput
      min={0}
      step={5}
      value={params.weight}
      onChange={(v) => navigate({ weight: v ?? 100 })}
      className="w-24"
    />
  );
}

/** Sort + modality + muscle-group chips for the unified lift list. */
export function LiftListControls({ params }: { params: ProgressParams }) {
  const navigate = useNavigate(params);

  return (
    <div className="mb-4 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 w-12 text-[11px] uppercase tracking-wide text-muted">
          Gear
        </span>
        <button type="button" className={chipClass(params.mod === "")} onClick={() => navigate({ mod: "" })}>
          all
        </button>
        {modalities
          .filter((m) => m.owned)
          .map((m) => (
            <button key={m.id} type="button" className={chipClass(params.mod === m.id)} onClick={() => navigate({ mod: m.id })}>
              {m.name.toLowerCase()}
            </button>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 w-12 text-[11px] uppercase tracking-wide text-muted">
          Muscle
        </span>
        <button type="button" className={chipClass(params.group === "")} onClick={() => navigate({ group: "" })}>
          all
        </button>
        {[...muscleGroups]
          .sort((a, b) => a.order - b.order)
          .map((g) => (
            <button key={g.id} type="button" className={chipClass(params.group === g.id)} onClick={() => navigate({ group: g.id })}>
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: MUSCLE_GROUP_COLORS[g.id] }}
              />
              {g.label.toLowerCase()}
            </button>
          ))}
      </div>
    </div>
  );
}
