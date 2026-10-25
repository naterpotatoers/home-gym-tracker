/** What a form-facing server action returns to useActionState: null on
 *  success, a user-facing message on a validation failure. Unexpected
 *  failures (DB errors, bad ids) still throw to the error boundary. */
export type FormResult = { error: string } | null;
