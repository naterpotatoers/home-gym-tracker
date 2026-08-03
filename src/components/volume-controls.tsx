"use client";

import { useRouter } from "next/navigation";
import { chipClass } from "@/components/ui";
import { progressHref, type ProgressParams } from "@/lib/progress-url";

export type VolumeSort = "group" | "volume" | "status";
export type VolumeFilter = "all" | "needs-work";

/** Sort/filter chips for the Progress page's per-muscle volume section.
 *  Person is page-level state now, so there's no person select here. */
export function VolumeControls({ params }: { params: ProgressParams }) {
  const router = useRouter();

  function navigate(patch: Partial<ProgressParams>) {
    router.replace(progressHref({ ...params, ...patch }), { scroll: false });
  }


  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="flex gap-1">
        {(
          [
            ["group", "by group"],
            ["volume", "by volume"],
            ["status", "by status"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={chipClass(params.sort === id)}
            onClick={() => navigate({ sort: id })}
          >
            {label}
          </button>
        ))}
      </span>

      <span className="ml-2 flex gap-1">
        <button
          type="button"
          className={chipClass(params.filter === "all")}
          onClick={() => navigate({ filter: "all" })}
        >
          all
        </button>
        <button
          type="button"
          className={chipClass(params.filter === "needs-work")}
          onClick={() => navigate({ filter: "needs-work" })}
        >
          needs work
        </button>
      </span>
    </div>
  );
}
