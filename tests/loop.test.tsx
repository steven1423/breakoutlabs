import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LOOP_STAGES, Loop } from "@/components/loop";
import LandingPage from "@/app/(marketing)/page";

afterEach(cleanup);

describe("the loop", () => {
  it("draws six arcs with their stage labels, and the ring closes back on Test", () => {
    const { container } = render(<Loop />);
    expect(container.querySelectorAll(".loop-arc")).toHaveLength(LOOP_STAGES.length);
    for (const stage of LOOP_STAGES) expect(screen.getByText(stage)).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/back to test/);
  });

  it("starts hidden only when animating; the static version is fully drawn", () => {
    const animated = render(<Loop />).container.querySelector<SVGPathElement>(".loop-arc")!;
    expect(Number(animated.style.strokeDashoffset)).toBeGreaterThan(0);
    cleanup();
    const still = render(<Loop animate={false} />).container.querySelector<SVGPathElement>(".loop-arc")!;
    expect(Number(still.style.strokeDashoffset)).toBe(0);
  });

  it("the landing page carries the three thesis lines and the Enter link", () => {
    render(<LandingPage />);
    expect(screen.getByText("The retest is the asset.")).toBeTruthy();
    expect(screen.getByText("Every leak in the loop is data that never existed.")).toBeTruthy();
    expect(screen.getByText("This is the system that closes it.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Enter BreakoutOS" }).getAttribute("href")).toBe("/ops?as=support");
  });
});
