"use client";

import { useState } from "react";
import { ProgressChart, type ChartPoint, type TrendSegment } from "@/components/progress-chart";
import { TrashIcon } from "@/components/icons";
import { Button, Field, IconButton, Input } from "@/components/ui";
import { createWeighIn, deleteWeighIn } from "@/lib/actions/weigh-ins";
import type { WeighIn } from "@/lib/types";

/**
 * Bodyweight logging + history for one person's card on the Users page.
 * Weight is tracked like a lift: dated rows in `weigh_ins`, charted over time
 * — never a mutable field on the profile.
 */
export function WeighInPanel({
  clientId,
  history,
  points,
  trend,
  today,
}: {
  clientId: string;
  /** Ascending by date; the panel shows the most recent few. */
  history: WeighIn[];
  points: ChartPoint[];
  trend: TrendSegment | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const recent = history.slice(-5).reverse();

  return (
    <div className="mt-4 border-t border-border pt-3">
      <form
        action={createWeighIn.bind(null, clientId)}
        className="flex flex-wrap items-end gap-3"
      >
        <Field label="Weigh-in date">
          <Input type="date" name="date" required defaultValue={today} />
        </Field>
        <Field label="Weight (lb)">
          <Input
            type="number"
            name="bodyweightLbs"
            required
            min={50}
            max={1000}
            step={0.5}
            align="right"
            placeholder="185"
            className="w-28"
          />
        </Field>
        <Button type="submit" size="sm">
          Log weigh-in
        </Button>
        {history.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "Hide history ▴" : `History (${history.length}) ▾`}
          </Button>
        )}
      </form>

      {open && history.length > 0 && (
        <div className="mt-3 space-y-3">
          <ProgressChart
            points={points}
            trend={trend}
            yUnit="lb"
            label="Bodyweight over time"
          />
          <ul className="divide-y divide-border text-sm">
            {recent.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-1">
                <span className="font-mono text-xs text-muted">{w.date}</span>
                <span className="font-mono">{w.bodyweightLbs} lb</span>
                <IconButton
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    if (confirm(`Delete the ${w.date} weigh-in (${w.bodyweightLbs} lb)?`)) {
                      deleteWeighIn(w.id);
                    }
                  }}
                  aria-label={`Delete weigh-in from ${w.date}`}
                  title="Delete weigh-in"
                >
                  <TrashIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
