"use client";

import Link from "next/link";
import { BodyFigure } from "@/components/body-figure";
import { ModalityChip } from "@/components/modality-chip";
import { Button, FOCUS_RING } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import type { ExerciseCatalog } from "@/lib/exercise-catalog";
import { modalityById } from "@/lib/data/modalities";
import { exerciseInfo } from "@/lib/exercise-info";
import type { ExerciseId, ModalityId, MuscleId } from "@/lib/types";

/**
 * "Explain exercise": what it works (a small muscle map plus names), up to
 * three cues, the variant's and the routine row's notes, and a demo link.
 */
export function ExerciseInfoSheet({
  catalog,
  exerciseId,
  modalityId,
  rowNote,
  onClose,
}: {
  catalog: ExerciseCatalog;
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  /** The routine row's own note, when opened from a prescription. */
  rowNote?: string;
  onClose: () => void;
}) {
  const info = exerciseInfo(catalog, exerciseId, modalityId);
  const scores = new Map(info?.scores ?? []);
  // How hard it works each muscle, as accent strength — not the heat
  // ramp, whose red end would read as "bad" for a light stabilizer.
  const fill = (muscleId: MuscleId) => {
    const score = scores.get(muscleId);
    return score ? `color-mix(in oklab, var(--color-accent) ${20 + score * 8}%, transparent)` : null;
  };
  // Labelled, so a routine note that echoes a cue reads as this routine's
  // instruction rather than a repeat.
  const notes = [
    { label: modalityById.get(modalityId)?.name ?? "This variant", text: info?.variantNotes.trim() },
    { label: "This routine", text: rowNote?.trim() },
  ].filter((n): n is { label: string; text: string } => !!n.text);

  return (
    <Dialog label={`About ${info?.name ?? "this exercise"}`} placement="sheet" onClose={onClose}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight">{info?.name ?? exerciseId}</h2>
          <ModalityChip modalityId={modalityId} />
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {info && info.scores.length > 0 ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex shrink-0 gap-1">
            {(["front", "back"] as const).map((view) => (
              <BodyFigure key={view} view={view} fill={fill} label={`${info.name} muscles`} className="w-16 sm:w-20" />
            ))}
          </div>
          <dl className="min-w-0 space-y-1.5 text-sm">
            {info.primary.length > 0 && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Works</dt>
                <dd className="font-semibold">{info.primary.join(", ")}</dd>
              </div>
            )}
            {info.secondary.length > 0 && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Also</dt>
                <dd>{info.secondary.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No muscle scores — conditioning or mobility work.</p>
      )}

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-accent-text">Cues</h3>
      {info && info.cues.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {info.cues.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">
          No cues yet —{" "}
          <Link href={`/exercises?exercise=${exerciseId}`} className="text-accent-text underline-offset-2 hover:underline">
            add some in the Library
          </Link>
          .
        </p>
      )}

      {notes.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          {notes.map((note) => (
            <p key={note.label}>
              <span className="font-semibold">{note.label}:</span> <span className="text-muted">{note.text}</span>
            </p>
          ))}
        </div>
      )}

      {info && (
        <a
          href={info.demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-4 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-accent-text hover:bg-current/5 ${FOCUS_RING}`}
        >
          Watch a demo ↗
        </a>
      )}
    </Dialog>
  );
}
