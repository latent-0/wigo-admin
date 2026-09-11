import type { Database } from './store';
import type { AdminUser, Application, Deposit, DocumentRecord, NotificationRecord, Rider } from '../domain/types';
import type { Role } from '../domain/roles';
import { hashPassword } from '../lib/password';

/**
 * Deterministic seed used by the demo server, the smoke test, and unit tests.
 * Timestamps are fixed so list ordering and audit date-range tests are reproducible.
 * The default password is a dev credential only and is never a real secret.
 */
export const DEMO_PASSWORD = 'Wigo!Pilot2026';

const T = (iso: string) => `2026-09-${iso}`;

function base(id: string, createdDay: string) {
  return {
    id,
    createdAt: T(`${createdDay}T09:00:00.000Z`),
    updatedAt: T(`${createdDay}T09:00:00.000Z`),
    deletedAt: null as string | null,
  };
}

export async function seed(db: Database): Promise<void> {
  db.adminUsers.clear();
  db.riders.clear();
  db.applications.clear();
  db.documents.clear();
  db.deposits.clear();
  db.notifications.clear();
  db.audit.clear();

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admins: Array<[string, string, Role, string]> = [
    ['usr_kunal', 'Kunal Reddy', 'super_admin', '+5215500000001'],
    ['usr_admin', 'Ops Admin', 'admin', '+5215500000002'],
    ['usr_ops', 'Field Ops', 'ops', '+5215500000003'],
    ['usr_finance', 'Finance Lead', 'finance', '+5215500000004'],
    ['usr_compliance', 'Compliance Officer', 'compliance', '+5215500000005'],
    ['usr_support', 'Support Agent', 'support', '+5215500000006'],
    ['usr_readonly', 'Auditor (read-only)', 'read_only', '+5215500000007'],
  ];
  for (const [id, name, role, phone] of admins) {
    const user: AdminUser = {
      ...base(id, '05'),
      name,
      phone,
      email: `${id.replace('usr_', '')}@wigo.pilot`,
      role,
      passwordHash,
      active: true,
      lastLoginAt: null,
    };
    db.adminUsers.insert(user);
  }

  const riders: Array<[string, string, Rider['status'], string, number]> = [
    ['rdr_001', 'Diego Hernández', 'active', 'CDMX', 4200],
    ['rdr_002', 'María López', 'active', 'CDMX', 1500],
    ['rdr_003', 'Carlos Ramírez', 'pending', 'Guadalajara', 0],
    ['rdr_004', 'Ana Torres', 'active', 'Monterrey', 8800],
    ['rdr_005', 'Luis Gómez', 'suspended', 'CDMX', 300],
    ['rdr_006', 'Sofía Díaz', 'active', 'Puebla', 2600],
    ['rdr_007', 'Jorge Vargas', 'pending', 'CDMX', 0],
    ['rdr_008', 'Valeria Cruz', 'active', 'Guadalajara', 5100],
  ];
  let day = 6;
  for (const [id, name, status, city, wallet] of riders) {
    const rider: Rider = {
      ...base(id, String(day).padStart(2, '0')),
      name,
      phone: `+52155${id.slice(-4)}0000`,
      city,
      status,
      walletBalanceCents: wallet,
    };
    db.riders.insert(rider);
    day = day < 16 ? day + 1 : 16;
  }
  // A soft-deleted rider — must never appear in lists or KPI counts.
  db.riders.insert({
    ...base('rdr_deleted', '07'),
    name: 'Removed Rider',
    phone: '+5215500009999',
    city: 'CDMX',
    status: 'suspended',
    walletBalanceCents: 0,
    deletedAt: T('08T10:00:00.000Z'),
  });

  const apps: Array<Partial<Application> & { id: string; riderId: string; day: string }> = [
    { id: 'app_001', riderId: 'rdr_001', applicantName: 'Diego Hernández', kind: 'buy', status: 'approved', day: '08' },
    { id: 'app_002', riderId: 'rdr_002', applicantName: 'María López', kind: 'rent', status: 'in_review', day: '10', rentalPackage: 'weekly-basic', pickupLocation: 'CDMX Hub A', pickupAt: T('20T14:00:00.000Z') },
    { id: 'app_003', riderId: 'rdr_003', applicantName: 'Carlos Ramírez', kind: 'buy', status: 'submitted', day: '11' },
    { id: 'app_004', riderId: 'rdr_004', applicantName: 'Ana Torres', kind: 'rent', status: 'approved', day: '12', rentalPackage: 'monthly-pro', pickupLocation: 'MTY Hub 1', pickupAt: T('18T11:00:00.000Z') },
    { id: 'app_005', riderId: 'rdr_006', applicantName: 'Sofía Díaz', kind: 'rent', status: 'submitted', day: '13', rentalPackage: 'weekly-basic', pickupLocation: null, pickupAt: null },
    { id: 'app_006', riderId: 'rdr_007', applicantName: 'Jorge Vargas', kind: 'buy', status: 'rejected', day: '14' },
  ];
  for (const a of apps) {
    const app: Application = {
      ...base(a.id, a.day),
      riderId: a.riderId,
      applicantName: a.applicantName!,
      kind: a.kind!,
      status: a.status!,
      rentalPackage: a.rentalPackage ?? null,
      pickupLocation: a.pickupLocation ?? null,
      pickupAt: a.pickupAt ?? null,
    };
    db.applications.insert(app);
  }

  const docs: Array<[string, string, DocumentRecord['kind'], DocumentRecord['status']]> = [
    ['doc_001', 'rdr_003', 'id_front', 'pending'],
    ['doc_002', 'rdr_003', 'id_back', 'pending'],
    ['doc_003', 'rdr_007', 'license', 'pending'],
    ['doc_004', 'rdr_001', 'selfie', 'approved'],
  ];
  for (const [id, riderId, kind, status] of docs) {
    const doc: DocumentRecord = {
      ...base(id, '11'),
      riderId,
      kind,
      storageRef: `s3://wigo-kyc/${riderId}/${kind}.jpg`,
      status,
      reviewedBy: status === 'approved' ? 'usr_compliance' : null,
      reviewedAt: status === 'approved' ? T('11T12:00:00.000Z') : null,
      reasonCode: null,
      reasonNote: null,
    };
    db.documents.insert(doc);
  }

  const deposits: Array<[string, string, number, Deposit['status'], string]> = [
    ['dep_001', 'rdr_001', 5000, 'settled', 'n1co_seed_001'],
    ['dep_002', 'rdr_002', 2000, 'settled', 'n1co_seed_002'],
    ['dep_003', 'rdr_004', 10000, 'pending', 'n1co_seed_003'],
    ['dep_004', 'rdr_005', 1500, 'failed', 'n1co_seed_004'],
  ];
  for (const [id, riderId, amount, status, key] of deposits) {
    const dep: Deposit = {
      ...base(id, '12'),
      riderId,
      amountCents: amount,
      currency: 'MXN',
      status,
      idempotencyKey: key,
      providerRef: status === 'settled' ? `N1CO-${id}` : null,
    };
    db.deposits.insert(dep);
  }

  const notes: Array<[string, string, NotificationRecord['status']]> = [
    ['ntf_001', '+5215515510000', 'delivered'],
    ['ntf_002', '+5215515520000', 'sent'],
    ['ntf_003', '+5215515530000', 'failed'],
  ];
  for (const [id, to, status] of notes) {
    const note: NotificationRecord = {
      ...base(id, '15'),
      to,
      templateName: 'application_approved',
      params: { name: 'Rider', city: 'CDMX' },
      status,
      attempts: status === 'failed' ? 3 : 1,
      lastError: status === 'failed' ? 'recipient_unreachable' : null,
      providerMessageId: status === 'failed' ? null : `wamid.${id}`,
      deliveredAt: status === 'delivered' ? T('15T09:05:00.000Z') : null,
    };
    db.notifications.insert(note);
  }
}
