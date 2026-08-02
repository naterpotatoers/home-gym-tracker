"use client";

import { useRouter } from "next/navigation";
import { NumberInput, Select } from "@/components/ui";
import { exerciseById } from "@/lib/data/exercises";
import { modalityById } from "@/lib/data/modalities";
import type { TrainedVariant } from "@/lib/queries";

export type MetricsView = "prs" | "weight-for-reps" | "reps-for-weight";

const VIEWS: { id: MetricsView; label: string }[] = [
  { id: "prs", label: "PRs" },
  { id: "weight-for-reps", label: "Weight for rep range" },
  { id: "reps-for-weight", label: "Reps for weight" },
];

/** URL-state controls for the metrics explorer — the server page reads the
 *  same searchParams and computes everything. */
export function MetricsControls({
  variants,
  selected,
  view,
  repMin,
  repMax,
  weight,
}: {
  variants: TrainedVariant[];
  selected: { exerciseId: string; modalityId: string } | null;
  view: MetricsView;
  repMin: number;
  repMax: number;
  weight: number;
}) {
  const router = useRouter();

  function navigate(patch: Partial<Record<string, string | number>>) {
    const params = new URLSearchParams();
    const merged = {
      exercise: selected?.exerciseId ?? "",
      modality: selected?.modalityId ?? "",
      view,
      repMin,
      repMax,
      weight,
      ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== "" && value !== undefined) params.set(key, String(value));
    }
    router.replace(`/metrics?${params.toString()}`);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
      <Select
        value={selected ? `${selected.exerciseId}|${selected.modalityId}` : ""}
        onChange={(e) => {
          const [exercise, modality] = e.target.value.split("|");
          navigate({ exercise: exercise ?? "", modality: modality ?? "" });
        }}
        className="max-w-full"
      >
        <option value="">All exercises — top PRs</option>
        {variants.map((variant) => (
          <option
            key={`${variant.exerciseId}|${variant.modalityId}`}
            value={`${variant.exerciseId}|${variant.modalityId}`}
          >
            {exerciseById.get(variant.exerciseId)?.name ?? variant.exerciseId} —{" "}
            {modalityById.get(variant.modalityId)?.name ?? variant.modalityId}
          </option>
        ))}
      </Select>

      {selected && (
        <span className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => navigate({ view: v.id })}
              className={`min-h-10 rounded-md px-3 text-xs ${
                view === v.id
                  ? "bg-accent-soft font-semibold text-accent-text"
                  : "text-muted hover:bg-current/5 hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </span>
      )}

      {selected && view === "weight-for-reps" && (
        <span className="flex items-center gap-1">
          <span className="text-xs text-muted">reps</span>
          <NumberInput
            min={1}
            value={repMin}
            onChange={(v) => navigate({ repMin: v ?? 1 })}
            className="w-16"
          />
          <span className="text-muted">–</span>
          <NumberInput
            min={1}
            value={repMax}
            onChange={(v) => navigate({ repMax: v ?? 1 })}
            className="w-16"
          />
        </span>
      )}

      {selected && view === "reps-for-weight" && (
        <span className="flex items-center gap-1">
          <NumberInput
            min={0}
            step={5}
            value={weight}
            onChange={(v) => navigate({ weight: v ?? 0 })}
            className="w-24"
          />
          <span className="text-xs text-muted">lb total</span>
        </span>
      )}
    </div>
  );
}
