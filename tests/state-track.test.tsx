import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_MARKS, StateTrack } from "@/components/state-track";
import { KIT_STATES, type KitState } from "@/lib/state-machine/transitions";

afterEach(cleanup);

const counts = Object.fromEntries(KIT_STATES.map((s) => [s, 0])) as Record<KitState, number>;

describe("the kit rail", () => {
  it("renders one mark per kit, garnet for stuck ones, and caps with an overflow label", () => {
    const { container } = render(<StateTrack counts={{ ...counts, shipped: 30, results_locked: 3 }} marks={{ results_locked: { stuck: 2 }, shipped: { stuck: 1 } }} />);
    expect(container.querySelectorAll(".rail-mark")).toHaveLength(MAX_MARKS + 3);
    expect(container.querySelectorAll(".rail-mark.bg-accent")).toHaveLength(3);
    expect(screen.getByText(`+${30 - MAX_MARKS}`)).toBeTruthy();
    expect(screen.getByText("2 stuck")).toBeTruthy();
  });

  it("draws no marks when none are supplied, so the kit page stays a plain track", () => {
    const { container } = render(<StateTrack counts={{ ...counts, ordered: 5 }} activeState="ordered" />);
    expect(container.querySelectorAll(".rail-mark")).toHaveLength(0);
    expect(screen.getByText("5")).toBeTruthy();
  });
});
