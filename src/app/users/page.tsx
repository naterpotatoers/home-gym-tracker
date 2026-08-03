import { Button, Card, Field, Input, PageShell, Select } from "@/components/ui";
import { createClient, updateClient } from "@/lib/actions/clients";
import { CLIENT_COLORS } from "@/lib/data/clients";
import { loadGymData } from "@/lib/db/snapshot";
import { clientSummaries } from "@/lib/queries";
import type { Client } from "@/lib/types";

/** CSS-only swatch picker: sr-only radios, peer-checked ring on the dot. */
function ColorPicker({ name, selected }: { name: string; selected: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted">Card color</span>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer" title="No color">
          <input
            type="radio"
            name={name}
            value=""
            defaultChecked={selected === null}
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
              defaultChecked={selected === color.hex}
              className="peer sr-only"
            />
            <span
              className="block size-9 rounded-full border-2 border-transparent peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-accent/60"
              style={{ backgroundColor: color.hex }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ProfileFields({ client }: { client?: Client }) {
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
          <option value="beginner">beginner</option>
          <option value="intermediate">intermediate</option>
          <option value="advanced">advanced</option>
        </Select>
      </Field>
      <Field label="Goal">
        <Select name="goal" defaultValue={client?.goal ?? "general-fitness"}>
          <option value="general-fitness">general fitness</option>
          <option value="strength">strength</option>
          <option value="hypertrophy">hypertrophy</option>
          <option value="fat-loss">fat loss</option>
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

export default async function UsersPage() {
  const data = await loadGymData();
  const summaries = clientSummaries(data);

  return (
    <PageShell>
      {data.clientsSource === "seed" && (
        <p className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          The clients table doesn&apos;t exist yet — run{" "}
          <code className="font-mono">supabase/migrations/002_clients.sql</code> in the
          Supabase SQL editor. Until then this page is read-only.
        </p>
      )}
      <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      <p className="mt-2 text-sm text-muted">
        Everyone who trains here. The card color outlines their card on the
        group board. Bodyweight comes from weigh-ins, so it isn&apos;t edited here.
      </p>

      <div className="mt-8 space-y-4">
        {summaries.map(({ client, age, bodyweightLbs, sessionCount, lastSessionDate }) => (
          <Card key={client.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {client.color && (
                <span
                  className="size-3.5 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
              )}
              <h2 className="text-lg font-semibold">{client.firstName}</h2>
              {client.isTrainer && (
                <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">trainer</span>
              )}
              <span className="ml-auto text-xs text-muted">
                {age} yrs{bodyweightLbs !== null && ` · ${bodyweightLbs} lb`} ·{" "}
                {sessionCount} sessions{lastSessionDate && ` · last ${lastSessionDate}`}
              </span>
            </div>
            <form action={updateClient.bind(null, client.id)} className="space-y-3">
              <ProfileFields client={client} />
              <Button type="submit" variant="primary" size="sm">
                Save {client.firstName}
              </Button>
            </form>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Add a person</h2>
        <form action={createClient} className="space-y-3">
          <ProfileFields />
          <Button type="submit" variant="primary">
            Add person
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
