"use client";

import { useState } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PlateSlider } from "@/components/plate-slider";
import {
  Button,
  chipClass,
  ErrorText,
  Field,
  IconButton,
  Input,
  NumberInput,
  Select,
} from "@/components/ui";
import { createFood, deleteFoodLog, logFood } from "@/lib/actions/nutrition";
import { foodCategories, foodCategoryById } from "@/lib/data/food-categories";
import { errorMessage } from "@/lib/format";
import {
  dayTotals,
  foodNameKey,
  fractionLabel,
  searchFoods,
  type RecentFood,
} from "@/lib/nutrition";
import { addDaysIso } from "@/lib/periods";
import type { ClientId, Food, FoodCategoryId, FoodLog } from "@/lib/types";

/**
 * The Tracking tab's nutrition section. Fast paths first: one tap on a
 * Recent chip relogs a food at its last plate fraction; the search box finds
 * catalog foods for the plate slider; creating a NEW food only appears
 * behind a search with no exact match, with similar names listed right there
 * — that friction is deliberate, it keeps near-duplicates out of the catalog.
 */
export function NutritionLog({
  clientId,
  today,
  foods,
  recents,
  logs,
}: {
  clientId: ClientId;
  today: string;
  foods: readonly Food[];
  recents: RecentFood[];
  /** All of this client's food logs; filtered by the selected day here. */
  logs: readonly FoodLog[];
}) {
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ food: Food; fraction: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<FoodCategoryId>("lean_protein");
  const [kcal, setKcal] = useState<number | null>(null);
  const [proteinG, setProteinG] = useState<number | null>(null);
  const [carbsG, setCarbsG] = useState<number | null>(null);
  const [fatG, setFatG] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLogs = logs.filter((l) => l.date === date);
  const totals = dayTotals(dayLogs);
  const results = searchFoods(foods, search);
  const hasExactMatch = results.some((f) => foodNameKey(f.name) === foodNameKey(search));
  const categoryDefaults = foodCategoryById.get(category)!;
  const foodName = (id: string) => foods.find((f) => f.id === id)?.name ?? id;

  async function act(fn: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  const log = (food: Food, fraction: number) =>
    act(async () => {
      await logFood(clientId, food.id, date, fraction);
      setSelected(null);
      setSearch("");
    }, "Logging failed.");

  const create = () =>
    act(async () => {
      const food = await createFood({
        name: search,
        category,
        plateKcal: kcal,
        plateProteinG: proteinG,
        plateCarbsG: carbsG,
        plateFatG: fatG,
      });
      setCreating(false);
      setKcal(null);
      setProteinG(null);
      setCarbsG(null);
      setFatG(null);
      // Straight onto the plate — creating a food is always in service of
      // logging it right now.
      setSelected({ food, fraction: 0.5 });
    }, "Creating food failed.");

  return (
    <div className="space-y-4">
      {/* Day picker */}
      <div className="flex items-center gap-2">
        <IconButton
          size="sm"
          aria-label="Previous day"
          onClick={() => setDate(addDaysIso(date, -1))}
        >
          ‹
        </IconButton>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          size="sm"
          className="w-40"
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
          <Button size="sm" variant="ghost" onClick={() => setDate(today)}>
            Today
          </Button>
        )}
      </div>

      {/* One-tap relog */}
      {recents.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
            Recent — tap to relog
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {recents.map(({ food, lastFraction }) => (
              <button
                key={food.id}
                type="button"
                disabled={busy}
                onClick={() => log(food, lastFraction)}
                className={chipClass(false, "min-h-11 px-3 text-xs disabled:opacity-50")}
              >
                {food.name}
                <span className="font-mono text-[10px] text-muted">
                  {fractionLabel(lastFraction)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search the catalog */}
      <div>
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCreating(false);
          }}
          placeholder="Search foods…"
          className="w-full"
        />
        {search.trim() && !selected && (
          <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-border">
            {results.slice(0, 10).map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ food, fraction: 0.5 })}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-current/5"
                >
                  {food.name}
                  <span className="ml-auto text-xs text-muted">
                    {foodCategoryById.get(food.category)?.label}
                  </span>
                </button>
              </li>
            ))}
            {!hasExactMatch && !creating && (
              <li className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold text-accent-text hover:bg-current/5"
                >
                  + Add “{search.trim()}” as a new food
                </button>
              </li>
            )}
          </ul>
        )}

        {/* New-food form — only reachable through a search with no exact
            match; the similar results above double as "did you mean". */}
        {creating && search.trim() && (
          <div className="mt-2 space-y-3 rounded-lg bg-background px-3 py-3">
            <p className="text-xs text-muted">
              New food: <strong className="text-foreground">{search.trim()}</strong>.
              Pick the closest category — its typical full-plate values fill any
              field you leave blank.
            </p>
            <Field label="Category">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as FoodCategoryId)}
              >
                {foodCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-3">
              <Field label="kcal / plate">
                <NumberInput
                  value={kcal}
                  onChange={setKcal}
                  min={0}
                  placeholder={String(categoryDefaults.plateKcal)}
                  className="w-24"
                />
              </Field>
              <Field label="Protein g">
                <NumberInput
                  value={proteinG}
                  onChange={setProteinG}
                  min={0}
                  placeholder={String(categoryDefaults.plateProteinG)}
                  className="w-20"
                />
              </Field>
              <Field label="Carbs g">
                <NumberInput
                  value={carbsG}
                  onChange={setCarbsG}
                  min={0}
                  placeholder={String(categoryDefaults.plateCarbsG)}
                  className="w-20"
                />
              </Field>
              <Field label="Fat g">
                <NumberInput
                  value={fatG}
                  onChange={setFatG}
                  min={0}
                  placeholder={String(categoryDefaults.plateFatG)}
                  className="w-20"
                />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" disabled={busy} onClick={create}>
                Create &amp; put on plate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* The plate */}
      {selected && (
        <div className="rounded-lg bg-background px-3 py-3">
          <p className="mb-1 text-sm font-semibold">{selected.food.name}</p>
          <PlateSlider
            food={selected.food}
            fraction={selected.fraction}
            onChange={(fraction) => setSelected({ ...selected, fraction })}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => log(selected.food, selected.fraction)}
            >
              Log it
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      {/* The day so far */}
      <div>
        <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
          {date === today ? "Today" : date}
        </h3>
        {dayLogs.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-border border-t border-border text-sm">
              {dayLogs.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-1">
                  <span className="min-w-0 truncate">{foodName(l.foodId)}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {fractionLabel(l.plateFraction)}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-xs">
                    {Math.round(l.kcal)} kcal
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {Math.round(l.proteinG)}P/{Math.round(l.carbsG)}C/{Math.round(l.fatG)}F
                  </span>
                  <ConfirmDeleteButton
                    action={() => deleteFoodLog(l.id)}
                    confirmText={`Remove ${foodName(l.foodId)} (${fractionLabel(l.plateFraction)})?`}
                    ariaLabel={`Remove ${foodName(l.foodId)}`}
                    className="shrink-0"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-border-strong pt-2 font-mono text-sm">
              <span className="font-semibold">{Math.round(totals.kcal)} kcal</span>
              <span className="text-muted"> · </span>
              {Math.round(totals.proteinG)}P / {Math.round(totals.carbsG)}C /{" "}
              {Math.round(totals.fatG)}F
            </p>
          </>
        )}
      </div>
    </div>
  );
}
