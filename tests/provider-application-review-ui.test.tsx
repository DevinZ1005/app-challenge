// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ProviderApplicationReview } from "../src/components/provider-application-review";
import type { ApplicationDetails } from "../src/lib/provider-application-review";
import { en, es } from "../src/lib/i18n";
const language = vi.hoisted(() => ({ spanish: false }));
vi.mock("../src/components/context", () => ({
  useApp: () => ({
    t: language.spanish ? es : en,
    locale: language.spanish ? "es" : "en",
  }),
}));
let application: ApplicationDetails;
let fetcher: ReturnType<typeof vi.fn>;
let onDecision: ReturnType<typeof vi.fn<() => void>>;
beforeEach(() => {
  application = {
    id: "test-id",
    organizationName: "Synthetic Pantry",
    createdAt: "2025-01-01T12:00:00Z",
    status: "pending",
    reviewedAt: null,
    organizationAddress: "Example address",
    contactName: "Test Representative",
    contactEmail: "person@example.test",
    contactPhone: null,
    organizationWebsite: "https://example.test",
    description: "Synthetic food assistance service",
    reviewedBy: null,
    reviewNote: null,
    verification: null,
  };
  onDecision = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      application.status = body.decision;
      application.reviewedBy = "trusted-admin-id";
      application.reviewedAt = "2025-02-01T12:00:00Z";
      application.reviewNote = body.note;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () =>
        url.includes("?")
          ? { applications: [application], total: 1 }
          : { ...application },
    };
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  language.spanish = false;
});
function setup(email = "admin@example.test") {
  render(
    <ProviderApplicationReview adminEmail={email} onDecision={onDecision} />,
  );
}
async function open() {
  fireEvent.click(
    await screen.findByRole("button", {
      name: `${en.reviewOpen}: Synthetic Pantry`,
    }),
  );
  await screen.findByText(application.contactEmail);
}
it("shows full private details and requires confirmation before a final rejection", async () => {
  setup();
  await open();
  expect(screen.getByText(application.organizationAddress)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: en.reject }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(en.reviewNoAccess)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: en.cancel }));
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: en.reject }));
  fireEvent.change(screen.getByLabelText(en.reviewReason), {
    target: { value: "Affiliation could not be independently confirmed." },
  });
  fireEvent.click(screen.getByRole("button", { name: en.reviewConfirmReject }));
  await screen.findByText(en.reviewSaved);
  await screen.findByText(en.reviewFinal);
  expect(screen.queryByRole("button", { name: en.approve })).toBeNull();
  expect(screen.getByText("trusted-admin-id", { exact: false })).toBeTruthy();
  expect(onDecision).toHaveBeenCalledOnce();
});
it("requires official contact evidence before approval and sends only decision fields", async () => {
  setup();
  await open();
  fireEvent.click(screen.getByRole("button", { name: en.approve }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(screen.getByLabelText(en.reviewReason), {
    target: { value: "Confirmed affiliation with the organization by phone." },
  });
  fireEvent.submit(
    within(dialog)
      .getByRole("button", { name: en.reviewConfirmApprove })
      .closest("form")!,
  );
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    en.reviewInvalid,
  );
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
  fireEvent.change(screen.getByLabelText(en.reviewOfficialSource), {
    target: { value: "https://example.test/official" },
  });
  fireEvent.change(screen.getByLabelText(en.reviewOfficialContact), {
    target: { value: "+1 (718) 555-0100" },
  });
  fireEvent.change(screen.getByLabelText(en.reviewContactTime), {
    target: { value: "2025-01-01T12:00" },
  });
  fireEvent.click(screen.getByLabelText(en.reviewAttestation));
  fireEvent.click(
    screen.getByRole("button", { name: en.reviewConfirmApprove }),
  );
  await screen.findByText(en.reviewSaved);
  const body = JSON.parse(
    String(
      fetcher.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body,
    ),
  );
  expect(body).toMatchObject({
    decision: "approved",
    affiliationConfirmed: true,
    contactMethod: "phone",
    sourceUrl: "https://example.test/official",
  });
  expect(body).not.toHaveProperty("reviewedBy");
});
it("disables self-review and keeps existing decisions read only", async () => {
  setup("PERSON@example.test");
  await open();
  expect(screen.getByRole("button", { name: en.approve })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("button", { name: en.reject })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByText(en.reviewSelf)).toBeTruthy();
  application.status = "rejected";
  application.reviewedBy = "other-admin";
  application.reviewedAt = "2025-01-02T12:00:00Z";
  application.reviewNote = "Previously reviewed application.";
  fireEvent.click(screen.getByRole("button", { name: en.reviewRefresh }));
  await screen.findByText(en.reviewFinal);
  expect(screen.queryByRole("button", { name: en.approve })).toBeNull();
});
it("filters by status and reports fetch failures without claiming the queue is empty", async () => {
  setup();
  await screen.findByRole("button", {
    name: `${en.reviewOpen}: Synthetic Pantry`,
  });
  fireEvent.change(screen.getByLabelText(en.reviewStatusFilter), {
    target: { value: "rejected" },
  });
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/admin/provider-applications?status=rejected&page=1",
      expect.anything(),
    ),
  );
  fetcher.mockResolvedValue({ ok: false, status: 503 });
  fireEvent.click(screen.getByRole("button", { name: en.reviewRefresh }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    en.reviewUnavailable,
  );
  expect(screen.queryByText(en.reviewEmpty)).toBeNull();
});
it("preserves an entered decision on a concurrent-review conflict", async () => {
  setup();
  await open();
  fireEvent.click(screen.getByRole("button", { name: en.reject }));
  fireEvent.change(screen.getByLabelText(en.reviewReason), {
    target: { value: "A second administrator reviewed this first." },
  });
  fetcher.mockResolvedValueOnce({ ok: false, status: 409 });
  fireEvent.click(screen.getByRole("button", { name: en.reviewConfirmReject }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    en.reviewConflict,
  );
  expect(screen.getByLabelText(en.reviewReason)).toHaveProperty(
    "value",
    "A second administrator reviewed this first.",
  );
  expect(onDecision).not.toHaveBeenCalled();
});
it("renders Spanish review controls", async () => {
  language.spanish = true;
  setup();
  expect(
    screen.getByRole("heading", { name: es.reviewApplicationsTitle }),
  ).toBeTruthy();
  fireEvent.click(
    await screen.findByRole("button", {
      name: `${es.reviewOpen}: Synthetic Pantry`,
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: es.reject }));
  expect(
    screen.getByRole("dialog", { name: es.reviewRejectTitle }),
  ).toBeTruthy();
  expect(screen.getByLabelText(es.reviewReason)).toBeTruthy();
});
