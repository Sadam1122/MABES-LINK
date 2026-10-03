import {
  ExceptionStatus,
  HandoverStatus,
  OpportunityStage,
  ServiceCaseStatus,
} from "@prisma/client";

import { AppError } from "@/lib/errors";

const handoverTransitions: Record<HandoverStatus, HandoverStatus[]> = {
  DRAFT: [HandoverStatus.SUBMITTED],
  SUBMITTED: [HandoverStatus.ACCEPTED],
  ACCEPTED: [
    HandoverStatus.PROCESSING,
    HandoverStatus.ON_HOLD,
    HandoverStatus.ESCALATED,
  ],
  PROCESSING: [
    HandoverStatus.ON_HOLD,
    HandoverStatus.ESCALATED,
    HandoverStatus.READY,
  ],
  ON_HOLD: [HandoverStatus.PROCESSING, HandoverStatus.ESCALATED],
  ESCALATED: [HandoverStatus.PROCESSING, HandoverStatus.ON_HOLD],
  READY: [],
};

export function assertHandoverTransition(
  from: HandoverStatus,
  to: HandoverStatus,
) {
  if (!handoverTransitions[from].includes(to)) {
    throw new AppError(
      `Status handover tidak dapat berubah dari ${from} ke ${to}.`,
      422,
      "INVALID_TRANSITION",
    );
  }
}

const stageTransitions: Record<OpportunityStage, OpportunityStage[]> = {
  NEW: [OpportunityStage.NEED_CONFIRMED, OpportunityStage.CLOSED_LOST],
  NEED_CONFIRMED: [
    OpportunityStage.FOLLOW_UP,
    OpportunityStage.HANDOVER,
    OpportunityStage.CLOSED_LOST,
  ],
  FOLLOW_UP: [OpportunityStage.HANDOVER, OpportunityStage.CLOSED_LOST],
  HANDOVER: [OpportunityStage.PROCESSING],
  PROCESSING: [OpportunityStage.READY],
  READY: [],
  CLOSED_LOST: [],
};

export function assertProspectTransition(
  from: OpportunityStage,
  to: OpportunityStage,
) {
  if (from === to) return;
  if (!stageTransitions[from].includes(to)) {
    throw new AppError(
      `Tahap prospek tidak dapat berubah dari ${from} ke ${to}.`,
      422,
      "INVALID_TRANSITION",
    );
  }
}

export function assertReadyRequirements(openExceptionCount: number) {
  if (openExceptionCount > 0) {
    throw new AppError(
      "Selesaikan seluruh subkasus kendala sebelum menandai layanan siap.",
      422,
      "OPEN_EXCEPTIONS",
    );
  }
}

export function isOpenException(status: ExceptionStatus) {
  return status !== ExceptionStatus.RESOLVED;
}

const exceptionTransitions: Record<ExceptionStatus, ExceptionStatus[]> = {
  OPEN: [
    ExceptionStatus.IN_PROGRESS,
    ExceptionStatus.ESCALATED,
    ExceptionStatus.RESOLVED,
  ],
  IN_PROGRESS: [ExceptionStatus.ESCALATED, ExceptionStatus.RESOLVED],
  ESCALATED: [ExceptionStatus.IN_PROGRESS, ExceptionStatus.RESOLVED],
  RESOLVED: [],
};

export function assertExceptionTransition(
  from: ExceptionStatus,
  to: ExceptionStatus,
) {
  if (from === to) return;
  if (!exceptionTransitions[from].includes(to)) {
    throw new AppError(
      `Status subkasus tidak dapat berubah dari ${from} ke ${to}.`,
      422,
      "INVALID_TRANSITION",
    );
  }
}

const serviceTransitions: Record<ServiceCaseStatus, ServiceCaseStatus[]> = {
  CREATED: [ServiceCaseStatus.ASSIGNED, ServiceCaseStatus.CANCELLED],
  ASSIGNED: [ServiceCaseStatus.ACCEPTED, ServiceCaseStatus.CANCELLED],
  ACCEPTED: [
    ServiceCaseStatus.IN_PROGRESS,
    ServiceCaseStatus.WAITING_CUSTOMER,
    ServiceCaseStatus.WAITING_SYSTEM,
    ServiceCaseStatus.ESCALATED,
  ],
  IN_PROGRESS: [
    ServiceCaseStatus.WAITING_CUSTOMER,
    ServiceCaseStatus.WAITING_SYSTEM,
    ServiceCaseStatus.ESCALATED,
    ServiceCaseStatus.HANDLED,
  ],
  WAITING_CUSTOMER: [
    ServiceCaseStatus.IN_PROGRESS,
    ServiceCaseStatus.ESCALATED,
    ServiceCaseStatus.CANCELLED,
  ],
  WAITING_SYSTEM: [
    ServiceCaseStatus.IN_PROGRESS,
    ServiceCaseStatus.ESCALATED,
    ServiceCaseStatus.CANCELLED,
  ],
  ESCALATED: [ServiceCaseStatus.IN_PROGRESS, ServiceCaseStatus.HANDLED],
  HANDLED: [ServiceCaseStatus.VERIFIED, ServiceCaseStatus.REOPENED],
  VERIFIED: [ServiceCaseStatus.CLOSED, ServiceCaseStatus.REOPENED],
  CLOSED: [ServiceCaseStatus.REOPENED],
  REOPENED: [
    ServiceCaseStatus.IN_PROGRESS,
    ServiceCaseStatus.WAITING_CUSTOMER,
    ServiceCaseStatus.WAITING_SYSTEM,
    ServiceCaseStatus.ESCALATED,
  ],
  CANCELLED: [],
};

export function assertServiceCaseTransition(
  from: ServiceCaseStatus,
  to: ServiceCaseStatus,
) {
  if (from === to) return;
  if (!serviceTransitions[from].includes(to))
    throw new AppError(
      `Status pekerjaan tidak dapat berubah dari ${from} ke ${to}.`,
      422,
      "INVALID_TRANSITION",
    );
}
