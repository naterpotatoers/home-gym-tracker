"use client";

import { useRouter } from "next/navigation";
import { Select, StepperInput } from "@/components/ui";
import { muscleGroups } from "@/lib/data/muscles";
import { modalities } from "@/lib/data/modalities";
import { progressHref, type ProgressParams } from "@/lib/progress-url";
import type { MuscleGroupId } from "@/lib/types";

function useNavigate(params: ProgressParams) {
  const router = useRouter();
  return (patch: Partial<ProgressParams>) =>
    router.replace(progressHref({ ...params, ...patch }), { scroll: false });
}

/** The rep-range / weight steppers inside the exercise view's load explorer —
 *  compact +/- controls so answers can be nudged without typing. */
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
        <StepperInput
          size="sm"
          min={1}
          value={params.repMin}
          onChange={(v) => navigate({ repMin: v ?? 8 })}
          className="w-12"
        />
        <span className="text-muted">–</span>
        <StepperInput
          size="sm"
          min={1}
          value={params.repMax}
          onChange={(v) => navigate({ repMax: v ?? 12 })}
          className="w-12"
        />
      </span>
    );
  }
  return (
    <StepperInput
      size="sm"
      min={0}
      step={5}
      value={params.weight}
      onChange={(v) => navigate({ weight: v ?? 100 })}
      className="w-16"
    />
  );
}

/** Gear + muscle-group dropdowns for the unified lift list — rendered inline
 *  so they share one flex row with the lift picker. */
export function LiftListControls({ params }: { params: ProgressParams }) {
  const navigate = useNavigate(params);

  return (
    <>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        Gear
        <Select value={params.mod} onChange={(e) => navigate({ mod: e.target.value })}>
          <option value="">all</option>
          {modalities
            .filter((m) => m.owned)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name.toLowerCase()}
              </option>
            ))}
        </Select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        Muscle
        <Select
          value={params.group}
          onChange={(e) =>
            navigate({ group: e.target.value as MuscleGroupId | "" })
          }
        >
          <option value="">all</option>
          {[...muscleGroups]
            .sort((a, b) => a.order - b.order)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.label.toLowerCase()}
              </option>
            ))}
        </Select>
      </label>
    </>
  );
}
