import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";

afterEach(cleanup);

describe("404", () => {
  it("says what to try and links back to Ops", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Nothing at this address" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Ops" }).getAttribute("href")).toBe("/ops?as=support");
  });
});
