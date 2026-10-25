"use client";

import { useState } from "react";
import { NutritionLog } from "@/components/nutrition-log";
import { Button, Card, IconButton, Input } from "@/components/ui";
import type { FormResult } from "@/lib/form-result";
import type { RecentFood } from "@/lib/nutrition";
import { addDaysIso } from "@/lib/periods";
import type { ClientId, Food, FoodLog } from "@/lib/types";
import { WeighInForm } from "./forms";

/**
 * The Log tab: one day picker at the top drives both the body-weight line
 * and the food log, so "log for Tuesday" is one choice, not two. Key it by
 * client at the call site so the day and any half-built plate reset on a
 * person switch.
 */
export function LogPane({
  clientId,
  today,
  weighInAction,
  weighIns,
  nutrition,
  children,
}: {
  clientId: ClientId;
  today: string;
  weighInAction: (formData: FormData) => Promise<FormResult>;
  /** This client's weigh-ins (plain data) — for the per-day "logged" hint. */
  weighIns: { date: string; bodyweightLbs: number }[];
  /** null while the nutrition tables don't exist yet. */
  nutrition: { foods: Food[]; recents: RecentFood[]; logs: FoodLog[] } | null;
  /** Server-rendered extras under the log (weigh-in history). */
  children?: React.ReactNode;
}) {
  const [date, setDate] = useState(today);
  const logged = weighIns.filter((w) => w.date === date).map((w) => w.bodyweightLbs);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          size="sm"
          aria-label="Previous day"
          onClick={() => setDate(addDaysIso(date, -1))}
        >
          ‹
        </IconButton>
        <Input
          type="date"
          aria-label="Day"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-44"
        />
        <IconButton
          size="sm"
          aria-label="Next day"
          onClick={() => setDate(addDaysIso(date, 1))}
          disabled={date >= today}
        >
          ›
        </IconButton>
        {date !== today && (
          <Button variant="ghost" onClick={() => setDate(today)}>
            Today
          </Button>
        )}
      </div>

      <Card>
        <WeighInForm action={weighInAction} date={date} logged={logged} />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Food</h2>
        {nutrition === null ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
            The nutrition tables don&apos;t exist yet — run{" "}
            <code className="font-mono">supabase/schema.sql</code> in the Supabase
            SQL editor once, then reload.
          </p>
        ) : (
          <NutritionLog
            key={clientId}
            clientId={clientId}
            date={date}
            today={today}
            foods={nutrition.foods}
            recents={nutrition.recents}
            logs={nutrition.logs}
          />
        )}
      </Card>

      {children}
    </div>
  );
}
