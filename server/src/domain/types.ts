import type { Role } from './roles';

/** Every persisted record carries soft-delete + audit timestamps. */
export interface BaseEntity {
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt: string | null; // soft delete — KPI/list queries must exclude non-null
}

export interface AdminUser extends BaseEntity {
  name: string;
  phone: string; // E.164, the WhatsApp-OTP identity
  email: string | null;
  role: Role;
  passwordHash: string; // bcrypt; never serialized to the client
  active: boolean;
  lastLoginAt: string | null;
}

export type RiderStatus = 'active' | 'suspended' | 'pending';

export interface Rider extends BaseEntity {
  name: string;
  phone: string;
  city: string;
  status: RiderStatus;
  walletBalanceCents: number;
}

export type ApplicationKind = 'buy' | 'rent';
export type ApplicationStatus = 'submitted' | 'in_review' | 'approved' | 'rejected';

export interface Application extends BaseEntity {
  riderId: string;
  applicantName: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  // Rent-flow fields added by the backend on 10 Sep. Null for Buy applications —
  // list sorting must be null-safe (the 13 Sep bug: sort on pickupAt broke on null).
  rentalPackage: string | null;
  pickupLocation: string | null;
  pickupAt: string | null;
}

export type DocumentStatus = 'pending' | 'approved' | 'rejected';

/** Reason codes for the Document Review Queue (approve/reject with reason codes). */
export const REJECT_REASON_CODES = ['blurry', 'expired', 'name_mismatch', 'wrong_document', 'other'] as const;
export type RejectReasonCode = (typeof REJECT_REASON_CODES)[number];

export interface DocumentRecord extends BaseEntity {
  riderId: string;
  kind: 'id_front' | 'id_back' | 'license' | 'selfie';
  storageRef: string; // reference returned by the upload pipeline, never a raw blob
  status: DocumentStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reasonCode: RejectReasonCode | null;
  reasonNote: string | null;
}

export type PaymentStatus = 'pending' | 'settled' | 'failed';

export interface Deposit extends BaseEntity {
  riderId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey: string;
  providerRef: string | null; // N1CO reference
}

export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export interface NotificationRecord extends BaseEntity {
  to: string; // E.164
  templateName: string;
  params: Record<string, string>;
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  deliveredAt: string | null;
}

export interface AuditEntry {
  id: string;
  at: string; // ISO 8601, stored as timestamp for range queries
  actorId: string;
  actorRole: Role;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
}

/** JWT payload. The role claim MUST survive refresh (the 11 Sep bug fix). */
export interface AccessTokenClaims {
  sub: string;
  role: Role;
  type: 'access';
}

export interface RefreshTokenClaims {
  sub: string;
  role: Role;
  type: 'refresh';
}
