import {
  ExceptionStatus,
  HandoverStatus,
  OpportunityStage,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  assertExceptionTransition,
  assertHandoverTransition,
  assertProspectTransition,
  assertReadyRequirements,
} from "@/lib/workflow";

describe("aturan workflow", () => {
  it("menerima transisi handover berurutan", () => {
    expect(() =>
      assertHandoverTransition(
        HandoverStatus.SUBMITTED,
        HandoverStatus.ACCEPTED,
      ),
    ).not.toThrow();
    expect(() =>
      assertHandoverTransition(HandoverStatus.PROCESSING, HandoverStatus.READY),
    ).not.toThrow();
  });

  it("menolak lompatan status yang tidak valid", () => {
    expect(() =>
      assertHandoverTransition(HandoverStatus.SUBMITTED, HandoverStatus.READY),
    ).toThrow(AppError);
    expect(() =>
      assertProspectTransition(OpportunityStage.NEW, OpportunityStage.READY),
    ).toThrow(AppError);
  });

  it("menolak siap selama masih ada kendala terbuka", () => {
    expect(() => assertReadyRequirements(1)).toThrowError(/subkasus kendala/i);
    expect(() => assertReadyRequirements(0)).not.toThrow();
  });

  it("subkasus yang selesai tidak dapat dibuka kembali", () => {
    expect(() =>
      assertExceptionTransition(
        ExceptionStatus.RESOLVED,
        ExceptionStatus.IN_PROGRESS,
      ),
    ).toThrowError(/tidak dapat berubah/i);
  });
});
