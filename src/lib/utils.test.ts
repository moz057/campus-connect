import { describe, it, expect } from "vitest";
import { csvCell, validateEvent } from "./utils";
const valid = {
  title: "Campus Meetup",
  description: "A welcoming campus experience.",
  venue: "Talamban",
  organization: "USC",
  capacity: 50,
  start_time: "2099-10-20T09:00:00+08:00",
  end_time: "2099-10-20T12:00:00+08:00",
  registration_deadline: "2099-10-19T23:00:00+08:00",
};
describe("event validation", () => {
  it("accepts a valid event", () => expect(validateEvent(valid)).toBeNull());
  it("rejects inverted event times", () =>
    expect(
      validateEvent({ ...valid, end_time: "2099-10-20T08:00:00+08:00" }),
    ).toContain("End time"));
  it("rejects late registration deadlines", () =>
    expect(
      validateEvent({
        ...valid,
        registration_deadline: "2099-10-21T08:00:00+08:00",
      }),
    ).toContain("Registration"));
  it("rejects fractional capacity", () =>
    expect(validateEvent({ ...valid, capacity: 1.5 })).toContain(
      "whole number",
    ));
});
describe("CSV safety", () => {
  it("escapes embedded quotes and newlines", () =>
    expect(csvCell('Alex "A"\nRivera')).toBe('"Alex ""A""\nRivera"'));
  it("neutralizes spreadsheet formulas", () =>
    expect(csvCell('=HYPERLINK("https://bad")')).toBe(
      '"\'=HYPERLINK(""https://bad"")"',
    ));
});
