import { Checkbox, Field, Input, Select } from "@/components/ui";
import { PATTERN_LABELS, PATTERN_ORDER } from "@/lib/exercise-catalog";

/** The static-shape basics for createExercise's FormData — name, pattern,
 *  metric, compound. Scores and variants are authored in the editor after. */
export function AddExerciseFields() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="col-span-2 sm:col-span-1">
        <Field label="Name">
          <Input type="text" name="name" required placeholder="Inverted Row" />
        </Field>
      </div>
      <Field label="Pattern">
        <Select name="pattern" defaultValue="isolation">
          {PATTERN_ORDER.map((pattern) => (
            <option key={pattern} value={pattern}>
              {PATTERN_LABELS[pattern]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Measured by">
        <Select name="metricType" defaultValue="reps">
          <option value="reps">Reps</option>
          <option value="time">Time</option>
          <option value="distance">Distance</option>
        </Select>
      </Field>
      <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm sm:col-span-3">
        <Checkbox name="isCompound" />
        Compound (multi-joint) movement
      </label>
    </div>
  );
}
