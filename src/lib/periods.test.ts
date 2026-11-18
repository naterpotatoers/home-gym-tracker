import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  ageOnIso,
  currentProgramWeek,
  programEnded,
  isoDow,
  localDayLabel,
  localIso,
  mondayOf,
  inMondayWeek,
  relativeDayLabel,
  shortDayLabel,
  weekdayDateLabel,
  weekOfLabel,
} from "./periods";

describe("date helpers", () => {
  it("addDaysIso crosses month and year boundaries", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("mondayOf returns the Monday of the containing week", () => {
    expect(mondayOf("2026-08-02")).toBe("2026-07-27"); // a Sunday
    expect(mondayOf("2026-07-27")).toBe("2026-07-27"); // Monday is a fixed point
  });

  it("isoDow uses the schema's numbering", () => {
    expect(isoDow("2026-08-17")).toBe(1); // Monday
    expect(isoDow("2026-08-23")).toBe(7); // Sunday
  });

  it("localDayLabel is stable regardless of process zone", () => {
    expect(localDayLabel("2026-08-19")).toBe("Wednesday, August 19");
  });
});

describe("gym timezone (assertions hold under any process TZ)", () => {
  it("localIso converts instants to the gym's day, not the process day", () => {
    // PDT (UTC-7): a UTC evening is still the previous gym day until 7am UTC.
    expect(localIso(new Date("2026-08-19T02:00:00Z"))).toBe("2026-08-18"); // 7pm PDT
    expect(localIso(new Date("2026-08-19T06:59:00Z"))).toBe("2026-08-18"); // 11:59pm PDT
    expect(localIso(new Date("2026-08-19T07:00:00Z"))).toBe("2026-08-19"); // midnight PDT
    // PST (UTC-8) in winter.
    expect(localIso(new Date("2026-01-15T07:59:00Z"))).toBe("2026-01-14");
    expect(localIso(new Date("2026-01-15T08:00:00Z"))).toBe("2026-01-15");
  });

  it("ageOnIso handles birthday boundaries", () => {
    expect(ageOnIso("1990-08-19", "2026-08-18")).toBe(35);
    expect(ageOnIso("1990-08-19", "2026-08-19")).toBe(36);
    expect(ageOnIso("1992-02-29", "2026-02-28")).toBe(33);
    expect(ageOnIso("1992-02-29", "2026-03-01")).toBe(34);
  });
});

describe("relativeDayLabel", () => {
  it("buckets by days, weeks, months, years", () => {
    const today = "2026-10-24";
    expect(relativeDayLabel(today, today)).toBe("today");
    expect(relativeDayLabel("2026-10-25", today)).toBe("today");
    expect(relativeDayLabel("2026-10-23", today)).toBe("1d ago");
    expect(relativeDayLabel("2026-10-11", today)).toBe("13d ago");
    expect(relativeDayLabel("2026-10-10", today)).toBe("2 wk ago");
    expect(relativeDayLabel("2026-08-26", today)).toBe("8 wk ago");
    expect(relativeDayLabel("2026-08-25", today)).toBe("2 mo ago");
    expect(relativeDayLabel("2024-10-24", today)).toBe("2 yr ago");
  });

  it("shortDayLabel is the gym day, not shifted by the process zone", () => {
    expect(shortDayLabel("2026-10-23")).toBe("Oct 23");
    expect(shortDayLabel("2026-01-01")).toBe("Jan 1");
  });
});

describe("currentProgramWeek", () => {
  const assignment = { startDate: "2026-07-06" }; // a Monday
  const program = { weeks: 4 };

  it("is week 1 on the start date and through the first six days", () => {
    expect(currentProgramWeek(assignment, program, "2026-07-06")).toBe(1);
    expect(currentProgramWeek(assignment, program, "2026-07-12")).toBe(1);
  });

  it("rolls to week 2 exactly seven days in", () => {
    expect(currentProgramWeek(assignment, program, "2026-07-13")).toBe(2);
    expect(currentProgramWeek(assignment, program, "2026-07-19")).toBe(2);
  });

  it("clamps to week 1 before the start and the final week after the end", () => {
    expect(currentProgramWeek(assignment, program, "2026-06-01")).toBe(1);
    expect(currentProgramWeek(assignment, program, "2026-09-15")).toBe(4);
  });
});

describe("programEnded", () => {
  const assignment = { startDate: "2026-07-06" };
  const program = { weeks: 4 };
  it("runs through the last day of the final week", () => {
    expect(programEnded(assignment, program, "2026-07-06")).toBe(false);
    expect(programEnded(assignment, program, "2026-08-02")).toBe(false);
  });
  it("ends the day after", () => {
    expect(programEnded(assignment, program, "2026-08-03")).toBe(true);
    expect(programEnded(assignment, program, "2026-12-01")).toBe(true);
  });
});

describe("Monday-week helpers", () => {
  it("inMondayWeek: Monday through Sunday, nothing after", () => {
    expect(inMondayWeek("2026-11-16", "2026-11-16")).toBe(true);
    expect(inMondayWeek("2026-11-22", "2026-11-16")).toBe(true);
    expect(inMondayWeek("2026-11-23", "2026-11-16")).toBe(false);
    expect(inMondayWeek("2026-11-15", "2026-11-16")).toBe(false);
  });

  it("week and weekday labels add the year only outside today's", () => {
    expect(weekOfLabel("2026-11-02", "2026-11-17")).toBe("Week of Nov 2");
    expect(weekOfLabel("2025-12-29", "2026-11-17")).toBe("Week of Dec 29, 2025");
    expect(weekdayDateLabel("2026-11-07", "2026-11-17")).toBe("Sat Nov 7");
    expect(weekdayDateLabel("2025-11-07", "2026-11-17")).toBe("Fri Nov 7, 2025");
  });
});

describe("shortDayLabel", () => {
  it("drops the year unless it differs from today's", () => {
    expect(shortDayLabel("2026-10-23")).toBe("Oct 23");
    expect(shortDayLabel("2026-10-23", "2026-11-16")).toBe("Oct 23");
    expect(shortDayLabel("2025-10-23", "2026-11-16")).toBe("Oct 23, 2025");
  });
});
