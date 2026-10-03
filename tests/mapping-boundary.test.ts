import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canManageUsers, prospectScope } from "@/lib/authorization";
import {
  isWithinManggaBesarBoundary,
  MANGGA_BESAR_BOUNDARY,
  MANGGA_BESAR_BOUNDARY_SOURCE,
} from "@/lib/mangga-besar-boundary";
import type { Actor } from "@/lib/session";

describe("batas Mangga Besar dan cakupan ADMIN", () => {
  it("membedakan titik di dalam, di luar, dan tepat pada batas", () => {
    expect(isWithinManggaBesarBoundary(-6.1445, 106.818)).toBe(true);
    expect(isWithinManggaBesarBoundary(-6.15, 106.827)).toBe(false);
    expect(
      isWithinManggaBesarBoundary(
        MANGGA_BESAR_BOUNDARY[0][0],
        MANGGA_BESAR_BOUNDARY[0][1],
      ),
    ).toBe(true);
  });

  it("mencantumkan sumber GIS Pemprov DKI", () => {
    const source = new URL(MANGGA_BESAR_BOUNDARY_SOURCE);
    expect(source.protocol).toBe("https:");
    expect(source.hostname).toBe("gis-dpmptsp.jakarta.go.id");
  });

  it("memberi ADMIN cakupan lintas cabang tanpa membuka data test", () => {
    const admin: Actor = {
      id: "admin-test",
      name: "Admin",
      email: "admin@example.invalid",
      role: Role.ADMIN,
      branchId: null,
    };
    expect(canManageUsers(admin)).toBe(true);
    expect(prospectScope(admin)).toEqual({ isTest: false });
  });
});
