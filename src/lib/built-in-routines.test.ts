import { describe, expect, it } from "vitest";
import {
  builtInDriftFromRows,
  builtInRoutineDrift,
  builtInRoutineRows,
  builtInRoutines,
} from "./built-in-routines";
import { seedSnapshot } from "./data/seed-snapshot";
import {
  routineExerciseToRow,
  routineToRow,
  rowToRoutine,
  rowToRoutineExercise,
} from "./db/mappers";

/** The built-ins as they come back from the DB: through both mappers. */
const roundTripped = () => ({
  routines: builtInRoutines.map((r) => rowToRoutine(routineToRow(r))),
  rows: builtInRoutineRows.map((row) => rowToRoutineExercise(routineExerciseToRow(row))),
});

describe("builtInRoutineDrift (drives the 'Update finishers' overwrite)", () => {
  it("the seed snapshot is the shipped version — no drift", () => {
    expect(builtInRoutineDrift(seedSnapshot())).toEqual({ missing: [], changed: [] });
  });

  it("a mapper round-trip is not a change (no false 'Update' prompt)", () => {
    const { routines, rows } = roundTripped();
    expect(builtInDriftFromRows(routines, rows)).toEqual({ missing: [], changed: [] });
  });

  it("row order in the fetch doesn't matter — sort_order does", () => {
    const { routines, rows } = roundTripped();
    expect(builtInDriftFromRows(routines, [...rows].reverse())).toEqual({ missing: [], changed: [] });
  });

  it("an edited row, name or notes is changed", () => {
    const { routines, rows } = roundTripped();
    const [first] = builtInRoutines;
    const editedRow = rows.map((row) =>
      row.routineId === first.id && row.order === 1 ? { ...row, sets: row.sets + 1 } : row,
    );
    expect(builtInDriftFromRows(routines, editedRow).changed.map((r) => r.id)).toEqual([first.id]);
    const renamed = routines.map((r) => (r.id === first.id ? { ...r, name: `${r.name}!` } : r));
    expect(builtInDriftFromRows(renamed, rows).changed.map((r) => r.id)).toEqual([first.id]);
    const dropped = rows.filter((row) => !(row.routineId === first.id && row.order === 1));
    expect(builtInDriftFromRows(routines, dropped).changed.map((r) => r.id)).toEqual([first.id]);
  });

  it("an absent routine is missing", () => {
    const { routines, rows } = roundTripped();
    const [first] = builtInRoutines;
    const drift = builtInDriftFromRows(
      routines.filter((r) => r.id !== first.id),
      rows.filter((row) => row.routineId !== first.id),
    );
    expect(drift).toEqual({ missing: [first], changed: [] });
  });
});
