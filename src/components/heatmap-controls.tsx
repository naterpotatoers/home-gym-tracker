"use client";

import { useRouter } from "next/navigation";
import { clients } from "@/lib/data/clients";
import type { PeriodKind } from "@/lib/periods";

export type HeatmapParams = {
  client: string;
  mode: "logged" | "prescribed";
  period: PeriodKind;
  date?: string;
  from?: string;
  to?: string;
  program?: string;
  week?: string;
  compare?: string;
  bDate?: string;
  bFrom?: string;
  bTo?: string;
  bProgram?: string;
  bWeek?: string;
};

const PERIODS: PeriodKind[] = ["day", "week", "program", "custom"];

/** URL-state controls for the heat map; the server page reads the same
 *  searchParams and computes everything. */
export function HeatmapControls({
  params,
  programs,
  prevAnchor,
  nextAnchor,
}: {
  params: HeatmapParams;
  programs: { id: string; name: string; weeks: number }[];
  prevAnchor: string | null;
  nextAnchor: string | null;
}) {
  const router = useRouter();
  const comparing = params.compare === "1";

  function navigate(patch: Partial<HeatmapParams>) {
    const merged: Record<string, string | undefined> = { ...params, ...patch };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    router.replace(`/metrics/heatmap?${search.toString()}`);
  }

  const input =
    "rounded border border-current/20 bg-transparent px-2 py-1 text-xs outline-none";
  const tab = (selected: boolean) =>
    `rounded px-2 py-1 text-xs ${selected ? "bg-current/15 font-semibold" : "opacity-60 hover:opacity-100"}`;

  return (
    <div className="mt-6 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex gap-1">
          <button type="button" className={tab(params.mode === "logged")} onClick={() => navigate({ mode: "logged" })}>
            Logged
          </button>
          <button type="button" className={tab(params.mode === "prescribed")} onClick={() => navigate({ mode: "prescribed" })}>
            Prescribed
          </button>
        </span>

        {params.mode === "logged" && (
          <select
            value={params.client}
            onChange={(e) => navigate({ client: e.target.value })}
            className={input}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className={tab(comparing)}
          onClick={() => navigate({ compare: comparing ? undefined : "1" })}
        >
          Compare
        </button>
      </div>

      {params.mode === "logged" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex gap-1">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                className={tab(params.period === period)}
                onClick={() => navigate({ period })}
              >
                {period}
              </button>
            ))}
          </span>

          {(params.period === "day" || params.period === "week") && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                disabled={!prevAnchor}
                onClick={() => prevAnchor && navigate({ date: prevAnchor })}
                className="rounded border border-current/20 px-2 py-0.5 text-xs disabled:opacity-30"
              >
                ‹
              </button>
              <input
                type="date"
                value={params.date ?? ""}
                onChange={(e) => navigate({ date: e.target.value || undefined })}
                className={input}
              />
              <button
                type="button"
                disabled={!nextAnchor}
                onClick={() => nextAnchor && navigate({ date: nextAnchor })}
                className="rounded border border-current/20 px-2 py-0.5 text-xs disabled:opacity-30"
              >
                ›
              </button>
            </span>
          )}

          {params.period === "program" && (
            <select
              value={params.program ?? ""}
              onChange={(e) => navigate({ program: e.target.value || undefined })}
              className={input}
            >
              <option value="">current assignment</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          )}

          {params.period === "custom" && (
            <span className="flex items-center gap-1">
              <input type="date" value={params.from ?? ""} onChange={(e) => navigate({ from: e.target.value || undefined })} className={input} />
              <span className="opacity-40">→</span>
              <input type="date" value={params.to ?? ""} onChange={(e) => navigate({ to: e.target.value || undefined })} className={input} />
            </span>
          )}

          {comparing && (
            <span className="flex items-center gap-1 border-l border-current/10 pl-2">
              <span className="text-xs opacity-60">vs</span>
              {params.period === "custom" ? (
                <>
                  <input type="date" value={params.bFrom ?? ""} onChange={(e) => navigate({ bFrom: e.target.value || undefined })} className={input} />
                  <span className="opacity-40">→</span>
                  <input type="date" value={params.bTo ?? ""} onChange={(e) => navigate({ bTo: e.target.value || undefined })} className={input} />
                </>
              ) : params.period === "program" ? (
                <select
                  value={params.bProgram ?? ""}
                  onChange={(e) => navigate({ bProgram: e.target.value || undefined })}
                  className={input}
                >
                  <option value="">current assignment</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  value={params.bDate ?? ""}
                  onChange={(e) => navigate({ bDate: e.target.value || undefined })}
                  className={input}
                />
              )}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={params.program ?? programs[0]?.id ?? ""}
            onChange={(e) => navigate({ program: e.target.value })}
            className={input}
          >
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs">
            week
            <input
              type="number"
              min={1}
              value={params.week ?? "1"}
              onChange={(e) => navigate({ week: e.target.value || undefined })}
              className={`w-14 text-right font-mono ${input}`}
            />
          </label>

          {comparing && (
            <span className="flex items-center gap-1 border-l border-current/10 pl-2">
              <span className="text-xs opacity-60">vs</span>
              <select
                value={params.bProgram ?? programs[0]?.id ?? ""}
                onChange={(e) => navigate({ bProgram: e.target.value })}
                className={input}
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs">
                week
                <input
                  type="number"
                  min={1}
                  value={params.bWeek ?? "1"}
                  onChange={(e) => navigate({ bWeek: e.target.value || undefined })}
                  className={`w-14 text-right font-mono ${input}`}
                />
              </label>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
