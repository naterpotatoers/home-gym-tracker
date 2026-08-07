"use client";

import { Field, Input, Select } from "@/components/ui";
import { CLIENT_COLORS } from "@/lib/data/clients";
import type { Client } from "@/lib/types";
import { useState } from "react";

/** CSS-only swatch picker with optional custom hex entry. */
function ColorPicker({ name, selected }: { name: string; selected: string | null }) {
  const isCustom = selected !== null && !CLIENT_COLORS.some((c) => c.hex === selected);
  const [custom, setCustom] = useState(isCustom ? selected : "#ffffff");
  const [useCustom, setUseCustom] = useState(isCustom);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted">Card color</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer" title="No color">
          <input
            type="radio"
            name={name}
            value=""
            defaultChecked={selected === null}
            onChange={() => setUseCustom(false)}
            className="peer sr-only"
          />
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-border-strong text-xs text-muted peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-accent/60">
            ✕
          </span>
        </label>
        {CLIENT_COLORS.map((color) => (
          <label key={color.id} className="cursor-pointer" title={color.id}>
            <input
              type="radio"
              name={name}
              value={color.hex}
              defaultChecked={!isCustom && selected === color.hex}
              onChange={() => setUseCustom(false)}
              className="peer sr-only"
            />
            <span
              className="block size-9 rounded-full border-2 border-transparent peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-accent/60"
              style={{ backgroundColor: color.hex }}
            />
          </label>
        ))}
        {/* Custom color entry */}
        <label className="cursor-pointer" title="Custom color">
          <input
            type="radio"
            name={name}
            value={useCustom ? custom : ""}
            checked={useCustom}
            onChange={() => setUseCustom(true)}
            className="peer sr-only"
          />
          <span
            className="flex size-9 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-xs text-muted peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-accent/60"
            style={useCustom ? { backgroundColor: custom } : undefined}
          >
            {!useCustom && "+"}
          </span>
        </label>
        {useCustom && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
              }}
              className="size-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <input
              type="text"
              value={custom}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setCustom(v);
              }}
              maxLength={7}
              className="w-24 rounded border border-border bg-surface-input px-2 py-1 font-mono text-sm"
            />
            {/* Hidden radio carries the custom value for form submission */}
            <input type="radio" name={name} value={custom} checked readOnly className="sr-only" />
          </div>
        )}
      </div>
    </div>
  );
}

/** The profile form body — shared by edit-person (with `client`) and
 *  add-person (without). Server-compatible: plain inputs, no state. */
export function ProfileFields({ client }: { client?: Client }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field label="First name">
        <Input type="text" name="firstName" required defaultValue={client?.firstName ?? ""} />
      </Field>
      <Field label="Date of birth">
        <Input type="date" name="dateOfBirth" required defaultValue={client?.dateOfBirth ?? ""} />
      </Field>
      <Field label="Height (in)">
        <Input
          type="number"
          name="heightInches"
          required
          min={24}
          max={96}
          align="right"
          defaultValue={client?.heightInches ?? ""}
          className="w-24"
        />
      </Field>
      <Field label="Experience">
        <Select name="experienceLevel" defaultValue={client?.experienceLevel ?? "beginner"}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </Select>
      </Field>
      <Field label="Goal">
        <Select name="goal" defaultValue={client?.goal ?? "general-fitness"}>
          <option value="general-fitness">General fitness</option>
          <option value="strength">Strength</option>
          <option value="hypertrophy">Hypertrophy</option>
          <option value="fat-loss">Fat loss</option>
        </Select>
      </Field>
      <Field label="Notes">
        <Input type="text" name="notes" defaultValue={client?.notes ?? ""} placeholder="—" />
      </Field>
      <div className="col-span-2 sm:col-span-3">
        <ColorPicker
          name="color"
          selected={client ? client.color : CLIENT_COLORS[0].hex}
        />
      </div>
    </div>
  );
}
