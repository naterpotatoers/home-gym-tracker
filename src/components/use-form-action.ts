"use client";

import { startTransition, useActionState, useRef } from "react";
import type { FormResult } from "@/lib/form-result";

export type FormAction = (formData: FormData) => Promise<FormResult>;

/**
 * useActionState over a FormResult action, dispatched from onSubmit rather
 * than `<form action>`: React auto-resets a form after every action-prop
 * submission, which would wipe the user's input on a validation error. Here
 * the form resets only on success (and only when asked). `pending` disables
 * the submit button, so a double tap can't log the same entry twice.
 * Thrown errors (incl. redirects) propagate as before.
 */
export function useFormAction(
  action: FormAction,
  { resetOnSuccess = false, onSuccess }: { resetOnSuccess?: boolean; onSuccess?: () => void } = {},
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, dispatch, pending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const result = await action(formData);
      if (result) return result.error;
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.();
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
