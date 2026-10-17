// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppContext } from "../src/components/context";
import { Questionnaire } from "../src/components/questionnaire";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
it("preserves form answers and provides an accessible ZIP field", () => {
  render(
    <AppContext>
      <Questionnaire />
    </AppContext>,
  );
  const field = screen.getByLabelText("ZIP code") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "10467" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: /Back/ }));
  expect((screen.getByLabelText("ZIP code") as HTMLInputElement).value).toBe(
    "10467",
  );
});
