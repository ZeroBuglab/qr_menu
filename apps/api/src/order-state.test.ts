import { describe, expect, it } from "vitest";
import { canTransition } from "./order-state.js";

describe("order state machine", () => {
  it("allows the operational happy path", () => {
    expect(canTransition("NEW", "COOKING")).toBe(true);
    expect(canTransition("COOKING", "READY")).toBe(true);
    expect(canTransition("READY", "DELIVERING")).toBe(true);
    expect(canTransition("DELIVERING", "COMPLETED")).toBe(true);
  });

  it("rejects skipping an operational state", () => {
    expect(canTransition("NEW", "READY")).toBe(false);
    expect(canTransition("COMPLETED", "COOKING")).toBe(false);
  });

  it("allows cancellation only before completion", () => {
    expect(canTransition("COOKING", "CANCELLED")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });
});
