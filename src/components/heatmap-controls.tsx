"use client";

import { useRouter } from "next/navigation";
import { chipClass, IconButton, Input, Select } from "@/components/ui";
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
  people,
  prevAnchor,
  nextAnchor,
}: {
  params: HeatmapParams;
  programs: { id: string; name: string; weeks: number }[];
  people: { id: string; firstName: string }[];
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


  return (
    <div className="mt-6 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex gap-1">
          <button type="button" className={chipClass(params.mode === "logged")} onClick={() => navigate({ mode: "logged" })}>
            Logged
          </button>
          <button type="button" className={chipClass(params.mode === "prescribed")} onClick={() => navigate({ mode: "prescribed" })}>
            Prescribed
          </button>
        </span>

        {params.mode === "logged" && (
          <Select
            value={params.client}
            onChange={(e) => navigate({ client: e.target.value })}
          >
            {people.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName}
              </option>
            ))}
          </Select>
        )}

        <button
          type="button"
          className={chipClass(comparing)}
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
                className={chipClass(params.period === period)}
                onClick={() => navigate({ period })}
              >
                {period}
              </button>
            ))}
          </span>

          {(params.period === "day" || params.period === "week") && (
            <span className="flex items-center gap-1">
              <IconButton
                disabled={!prevAnchor}
                onClick={() => prevAnchor && navigate({ date: prevAnchor })}
                aria-label="Previous"
              >
                ‹
              </IconButton>
              <Input
                type="date"
                value={params.date ?? ""}
                onChange={(e) => navigate({ date: e.target.value || undefined })}
              />
              <IconButton
                disabled={!nextAnchor}
                onClick={() => nextAnchor && navigate({ date: nextAnchor })}
                aria-label="Next"
              >
                ›
              </IconButton>
            </span>
          )}

          {params.period === "program" && (
            <Select
              value={params.program ?? ""}
              onChange={(e) => navigate({ program: e.target.value || undefined })}
            >
              <option value="">current assignment</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </Select>
          )}

          {params.period === "custom" && (
            <span className="flex items-center gap-1">
              <Input type="date" value={params.from ?? ""} onChange={(e) => navigate({ from: e.target.value || undefined })} />
              <span className="text-muted">→</span>
              <Input type="date" value={params.to ?? ""} onChange={(e) => navigate({ to: e.target.value || undefined })} />
            </span>
          )}

          {comparing && (
            <span className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:border-l sm:border-border sm:pl-2">
              <span className="text-xs text-muted">vs</span>
              {params.period === "custom" ? (
                <>
                  <Input type="date" value={params.bFrom ?? ""} onChange={(e) => navigate({ bFrom: e.target.value || undefined })} />
                  <span className="text-muted">→</span>
                  <Input type="date" value={params.bTo ?? ""} onChange={(e) => navigate({ bTo: e.target.value || undefined })} />
                </>
              ) : params.period === "program" ? (
                <Select
                  value={params.bProgram ?? ""}
                  onChange={(e) => navigate({ bProgram: e.target.value || undefined })}
                >
                  <option value="">current assignment</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type="date"
                  value={params.bDate ?? ""}
                  onChange={(e) => navigate({ bDate: e.target.value || undefined })}
                />
              )}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={params.program ?? programs[0]?.id ?? ""}
            onChange={(e) => navigate({ program: e.target.value })}
          >
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1 text-xs">
            week
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              align="right"
              value={params.week ?? "1"}
              onChange={(e) => navigate({ week: e.target.value || undefined })}
              className="w-16"
            />
          </label>

          {comparing && (
            <span className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:border-l sm:border-border sm:pl-2">
              <span className="text-xs text-muted">vs</span>
              <Select
                value={params.bProgram ?? programs[0]?.id ?? ""}
                onChange={(e) => navigate({ bProgram: e.target.value })}
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-1 text-xs">
                week
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  align="right"
                  value={params.bWeek ?? "1"}
                  onChange={(e) => navigate({ bWeek: e.target.value || undefined })}
                  className="w-16"
                />
              </label>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
