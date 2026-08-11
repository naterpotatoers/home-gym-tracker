"use client";

import { unstable_rethrow } from "next/navigation";
import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { Button, ErrorText, Note } from "@/components/ui";
import { createExercise } from "@/lib/actions/exercises";
import { nameKey } from "@/lib/names";
import { errorMessage } from "@/lib/format";
import { AddExerciseFields } from "./add-exercise-fields";

/** A name/alias roster of the current catalog — all the form needs for its
 *  "similar exercises" hint; never the full exercise objects. */
export type ExerciseNameEntry = {
  name: string;
  aliases: readonly string[];
};

/**
 * Client wrapper around the add-exercise fields so a duplicate name comes
 * back as an inline message (the server action throws) instead of the crash
 * page. Also hints at similar existing names while typing — advisory only;
 * only an exact name/alias match actually blocks, since "Squat Jump"
 * legitimately contains "Squat".
 */
export function AddExerciseForm({ existing }: { existing: ExerciseNameEntry[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const typedKey = nameKey(name);
  const similar: string[] = [];
  if (typedKey.length >= 3) {
    for (const entry of existing) {
      const matched = [entry.name, ...entry.aliases].find((known) => {
        const key = nameKey(known);
        return key.includes(typedKey) || typedKey.includes(key);
      });
      if (matched === undefined) continue;
      similar.push(
        matched === entry.name ? entry.name : `${entry.name} (a.k.a. ${matched})`,
      );
      if (similar.length >= 3) break;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createExercise(new FormData(event.currentTarget));
    } catch (e) {
      unstable_rethrow(e);
      setBusy(false);
      setError(errorMessage(e, "Couldn't add the exercise."));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <AddExerciseFields onNameChange={setName} />
      {similar.length > 0 && (
        <p className="text-xs text-muted">Similar: {similar.join(", ")}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          <PlusIcon size={16} /> {busy ? "Adding…" : "Add exercise"}
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <Note>
        Basics first — muscle roles and equipment variants are authored on the
        next screen. An exercise with no variant can&apos;t be picked in a
        routine yet.
      </Note>
    </form>
  );
}
