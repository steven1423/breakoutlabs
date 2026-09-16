import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DataBadge } from "@/components/badge";

afterEach(cleanup);

describe("DataBadge", () => {
  it("renders Live for live data", () => {
    render(<DataBadge status="live" />);
    expect(screen.getByText("Live").getAttribute("data-status")).toBe("live");
  });

  it("renders Seeded for synthetic data and never the word Live", () => {
    render(<DataBadge status="seeded" />);
    expect(screen.getByText("Seeded").getAttribute("data-status")).toBe("seeded");
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("shows the fallback reason only when given", () => {
    const { container } = render(<DataBadge status="seeded" reason="Not configured, showing seeded data" />);
    expect(screen.getByText("Not configured, showing seeded data")).toBeTruthy();
    cleanup();
    render(<DataBadge status="seeded" />);
    expect(container.textContent).not.toContain("Not configured");
    expect(screen.getByText("Seeded")).toBeTruthy();
  });
});
