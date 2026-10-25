// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WelcomeLogin } from "../src/components/welcome-login";
vi.mock("../src/components/context", () => ({
  useApp: () => ({ locale: "en" }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("moves from email to a code and shows a generic failure without exposing server messages", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: false, status: 401 });
  vi.stubGlobal("fetch", fetch);
  render(<WelcomeLogin demo={false} enabled={true} />);
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "person@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  const code = await screen.findByLabelText("6-digit code");
  expect(fetch.mock.calls[0][0]).toBe("/api/household/code");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    email: "person@example.com",
  });
  fireEvent.change(code, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "invalid or expired",
    ),
  );
  expect(fetch.mock.calls[1][0]).toBe("/api/household/verify");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    email: "person@example.com",
    code: "123456",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Change email or request a new code" }),
  );
  expect(screen.queryByLabelText("6-digit code")).toBeNull();
});
it("keeps unconfigured live login disabled and does not offer a demo fallback", () => {
  render(<WelcomeLogin demo={false} enabled={false} />);
  expect(
    (screen.getByLabelText("Email address") as HTMLInputElement).disabled,
  ).toBe(true);
  expect(screen.queryByRole("button", { name: /Try the demo/ })).toBeNull();
});
