"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { clients } from "@/lib/data/clients";

export type VolumeSort = "group" | "volume" | "status";
export type VolumeFilter = "all" | "needs-work";

/** URL-state controls for the library's per-muscle volume section — the
 *  server page reads the same searchParams and computes everything. */
export function VolumeControls({
  clientId,
  sort,
  filter,
}: {
  clientId: string;
  sort: VolumeSort;
  filter: VolumeFilter;
}) {
  const router = useRouter();

  function navigate(patch: Partial<{ client: string; sort: string; filter: string }>) {
    const merged = { client: clientId, sort, filter, ...patch };
    const params = new URLSearchParams();
    if (merged.client !== "nate") params.set("client", merged.client);
    if (merged.sort !== "group") params.set("sort", merged.sort);
    if (merged.filter !== "all") params.set("filter", merged.filter);
    const qs = params.toString();
    router.replace(`/library${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  const chip = (selected: boolean) =>
    `min-h-10 rounded-md px-3 text-xs ${
      selected
        ? "bg-accent-soft font-semibold text-accent-text"
        : "text-muted hover:bg-current/5 hover:text-foreground"
    }`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <Select
        value={clientId}
        onChange={(e) => navigate({ client: e.target.value })}
        aria-label="Person"
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.firstName}
          </option>
        ))}
      </Select>

      <span className="ml-2 flex gap-1">
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
            className={chip(sort === id)}
            onClick={() => navigate({ sort: id })}
          >
            {label}
          </button>
        ))}
      </span>

      <span className="flex gap-1 sm:ml-2">
        <button
          type="button"
          className={chip(filter === "all")}
          onClick={() => navigate({ filter: "all" })}
        >
          all
        </button>
        <button
          type="button"
          className={chip(filter === "needs-work")}
          onClick={() => navigate({ filter: "needs-work" })}
        >
          needs work
        </button>
      </span>
    </div>
  );
}
