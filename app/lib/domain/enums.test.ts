import { describe, it, expect } from "vitest";
import {
  planSatisfies,
  roleSatisfies,
  trustSatisfies,
  isAutonomous,
} from "./enums";

describe("plan ordering", () => {
  it("higher tiers satisfy lower requirements", () => {
    expect(planSatisfies("PRO", "GROWTH")).toBe(true);
    expect(planSatisfies("GROWTH", "GROWTH")).toBe(true);
    expect(planSatisfies("FREE", "GROWTH")).toBe(false);
    expect(planSatisfies("ENTERPRISE", "SCALE")).toBe(true);
  });
});

describe("role ordering", () => {
  it("respects RBAC authority", () => {
    expect(roleSatisfies("OWNER", "OPERATOR")).toBe(true);
    expect(roleSatisfies("OPERATOR", "OPERATOR")).toBe(true);
    expect(roleSatisfies("VIEWER", "OPERATOR")).toBe(false);
    expect(roleSatisfies("ANALYST", "VIEWER")).toBe(true);
  });
});

describe("trust ladder", () => {
  it("orders autonomy correctly", () => {
    expect(trustSatisfies("AUTO_REVERSIBLE", "APPROVE")).toBe(true);
    expect(trustSatisfies("SUGGEST", "APPROVE")).toBe(false);
    expect(trustSatisfies("AUTO_GUARDED", "AUTO_GUARDED")).toBe(true);
  });

  it("treats only AUTO levels as autonomous", () => {
    expect(isAutonomous("SUGGEST")).toBe(false);
    expect(isAutonomous("APPROVE")).toBe(false);
    expect(isAutonomous("AUTO_REVERSIBLE")).toBe(true);
    expect(isAutonomous("AUTO_GUARDED")).toBe(true);
  });
});
