import "server-only";
import { connection } from "next/server";
import { supabase } from "./client";

export const SEED_TABLES = [
  "routines",
  "routine_exercises",
  "programs",
  "program_days",
  "assignments",
  "sessions",
  "set_logs",
  "weigh_ins",
] as const;

export type TableStatus = {
  table: (typeof SEED_TABLES)[number];
  /** null when the table doesn't exist (migration not run). */
  count: number | null;
};

export async function tableStatuses(): Promise<TableStatus[]> {
  await connection(); // live counts — never prerender
  return Promise.all(
    SEED_TABLES.map(async (table) => {
      // A GET, not HEAD, on purpose: HEAD responses carry no error body, so a
      // missing table would be indistinguishable from an empty one. Select *
      // because two tables (routine_exercises, program_days) have composite
      // keys and no id column.
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .limit(1);
      if (error?.code === "PGRST205") return { table, count: null };
      if (error) throw new Error(`counting ${table}: ${error.message}`);
      return { table, count: count ?? 0 };
    }),
  );
}
