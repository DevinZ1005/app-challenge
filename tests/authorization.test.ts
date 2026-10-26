import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  requireAdmin,
  requireOrganizationAccess,
  requireProgramAccess,
  type Identity,
} from "../src/lib/authorization";

function account(role: Identity["role"]): Identity {
  return {
    id: "synthetic-user",
    email: "person@example.test",
    role,
    organizationIds: ["own-org"],
    programIds: ["own-program"],
  };
}

it("requires authentication for each authorization helper", () => {
  for (const action of [
    () => requireAdmin(null),
    () => requireOrganizationAccess(null, "own-org"),
    () => requireProgramAccess(undefined, "own-program"),
  ])
    expect(action).toThrow(expect.objectContaining({ status: 401 }));
});

it("allows administrators and denies provider or unaffiliated administrator actions", () => {
  expect(() => requireAdmin(account("admin"))).not.toThrow();
  for (const role of ["provider", "unaffiliated"] as const)
    expect(() => requireAdmin(account(role))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
});

it("requires both provider state and matching trusted organization/program scope", () => {
  const provider = account("provider");
  expect(() => requireOrganizationAccess(provider, "own-org")).not.toThrow();
  expect(() => requireProgramAccess(provider, "own-program")).not.toThrow();
  expect(() => requireOrganizationAccess(provider, "other-org")).toThrow(
    expect.objectContaining({ status: 403 }),
  );
  expect(() => requireProgramAccess(provider, "other-program")).toThrow(
    expect.objectContaining({ status: 403 }),
  );
  expect(() =>
    requireOrganizationAccess(account("unaffiliated"), "own-org"),
  ).toThrow(expect.objectContaining({ status: 403 }));
  expect(() =>
    requireProgramAccess(account("unaffiliated"), "own-program"),
  ).toThrow(expect.objectContaining({ status: 403 }));
  expect(() =>
    requireOrganizationAccess(account("admin"), "other-org"),
  ).not.toThrow();
  expect(() =>
    requireProgramAccess(account("admin"), "other-program"),
  ).not.toThrow();
});
