// Client-side mirror of the server DTOs. Kept in sync by hand (the two packages build
// independently to keep the build graph simple).

export type Role = 'super_admin' | 'admin' | 'ops' | 'finance' | 'compliance' | 'support' | 'read_only';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  phone: string;
  email?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface Kpis {
  riders: { total: number; active: number; suspended: number; pending: number };
  applications: { total: number; submitted: number; in_review: number; approved: number; rejected: number };
  deposits: { activeCount: number; settledCount: number; pendingCount: number; failedCount: number; totalSettledCents: number };
  documents: { pending: number };
  notifications: { failed: number };
  walletBalanceCents: number;
}

export type RiderStatus = 'active' | 'suspended' | 'pending';
export interface Rider {
  id: string;
  name: string;
  phone: string;
  city: string;
  status: RiderStatus;
  walletBalanceCents: number;
  createdAt: string;
}

export type ApplicationKind = 'buy' | 'rent';
export type ApplicationStatus = 'submitted' | 'in_review' | 'approved' | 'rejected';
export interface Application {
  id: string;
  applicantName: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  rentalPackage: string | null;
  pickupLocation: string | null;
  pickupAt: string | null;
  createdAt: string;
}

export type DocumentStatus = 'pending' | 'approved' | 'rejected';
export interface DocumentRecord {
  id: string;
  riderId: string;
  kind: 'id_front' | 'id_back' | 'license' | 'selfie';
  storageRef: string;
  status: DocumentStatus;
  reasonCode: string | null;
  reasonNote: string | null;
  createdAt: string;
}

export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed';
export interface NotificationRecord {
  id: string;
  to: string;
  templateName: string;
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  createdAt: string;
}

export interface TemplateDef {
  name: string;
  params: string[];
  body: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorRole: Role;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ExperimentAssignment {
  experiment: string;
  variant: string;
}
