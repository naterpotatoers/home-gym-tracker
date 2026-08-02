"use client";

import { useRouter } from "next/navigation";
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
      <select
        value={selected ? `${selected.exerciseId}|${selected.modalityId}` : ""}
        onChange={(e) => {
          const [exercise, modality] = e.target.value.split("|");
          navigate({ exercise: exercise ?? "", modality: modality ?? "" });
        }}
        className="rounded border border-current/20 bg-transparent px-2 py-1.5 text-sm"
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
      </select>

      {selected && (
        <span className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => navigate({ view: v.id })}
              className={`rounded px-2 py-1 text-xs ${
                view === v.id
                  ? "bg-current/15 font-semibold"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              {v.label}
            </button>
          ))}
        </span>
      )}

      {selected && view === "weight-for-reps" && (
        <span className="flex items-center gap-1">
          <span className="text-xs opacity-60">reps</span>
          <input
            type="number"
            min={1}
            value={repMin}
            onChange={(e) => navigate({ repMin: Number(e.target.value) || 1 })}
            className="w-14 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <span className="opacity-40">–</span>
          <input
            type="number"
            min={1}
            value={repMax}
            onChange={(e) => navigate({ repMax: Number(e.target.value) || 1 })}
            className="w-14 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
        </span>
      )}

      {selected && view === "reps-for-weight" && (
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            step={5}
            value={weight}
            onChange={(e) => navigate({ weight: Number(e.target.value) || 0 })}
            className="w-20 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <span className="text-xs opacity-60">lb total</span>
        </span>
      )}
    </div>
  );
}
