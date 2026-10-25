"use client";

import { startTransition, useActionState, useRef } from "react";
import { PlusIcon, SaveIcon } from "@/components/icons";
import { Button, ErrorText, Input } from "@/components/ui";
import type { FormResult } from "@/lib/form-result";
import type { Client } from "@/lib/types";
import { ProfileFields } from "./profile-fields";

type FormAction = (formData: FormData) => Promise<FormResult>;

/**
 * useActionState over a FormResult action, dispatched from onSubmit rather
 * than `<form action>`: React auto-resets a form after every action-prop
 * submission, which would wipe the user's input on a validation error. Here
 * the form resets only on success (and only when asked). `pending` disables
 * the submit button, so a double tap can't log the same weigh-in twice.
 * Thrown errors (incl. redirects) propagate as before.
 */
function useFormAction(action: FormAction, resetOnSuccess: boolean) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const result = await action(formData);
      if (result) return result.error;
      if (resetOnSuccess) formRef.current?.reset();
      return null;
    },
    null,
  );
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { formRef, error, pending, onSubmit };
}

/** Add-person and edit-profile form. `extra` sits at the end of the button
 *  row (the edit view's delete button). */
export function ProfileForm({
  action,
  client,
  submitLabel,
  extra,
}: {
  action: FormAction;
  client?: Client;
  submitLabel: string;
  extra?: React.ReactNode;
}) {
  const { formRef, error, pending, onSubmit } = useFormAction(action, false);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <ProfileFields client={client} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {client ? <SaveIcon size={16} /> : <PlusIcon size={16} />}
          {pending ? "Saving…" : submitLabel}
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
        {extra}
      </div>
    </form>
  );
}

/** The Log tab's one-line body-weight entry. The date comes from the tab's
 *  shared day picker, so it rides along as a hidden field. */
export function WeighInForm({
  action,
  date,
  logged,
}: {
  action: FormAction;
  date: string;
  /** Entries already on this date, for the "already logged" hint. */
  logged: number[];
}) {
  const { formRef, error, pending, onSubmit } = useFormAction(action, true);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="date" value={date} />
      <label htmlFor="bodyweightLbs" className="text-sm font-semibold">
        Body weight
      </label>
      <Input
        id="bodyweightLbs"
        type="number"
        name="bodyweightLbs"
        required
        min={50}
        max={1000}
        step={0.5}
        align="right"
        placeholder="185"
        inputMode="decimal"
        className="w-24"
      />
      <span className="text-sm text-muted">lb</span>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Logging…" : "Log"}
      </Button>
      {logged.length > 0 && (
        <span className="font-mono text-xs text-muted">
          logged: {logged.map((w) => `${w} lb`).join(", ")}
        </span>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  );
}
