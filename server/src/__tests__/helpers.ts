import type { Express } from 'express';
import { createApp, buildContext } from '../app';
import { createDatabase, type Database } from '../data/store';
import { seed } from '../data/seed';
import { FakeWhatsAppAdapter } from '../ports/notifications';
import { FakeN1coAdapter } from '../ports/payments';
import { AuthService } from '../services/auth.service';
import { signAccessToken } from '../lib/jwt';
import type { Role } from '../domain/roles';

export interface TestHarness {
  app: Express;
  db: Database;
  notifications: FakeWhatsAppAdapter;
}

/** Build an isolated app instance with a freshly seeded in-memory DB and fake adapters. */
export async function makeTestApp(): Promise<TestHarness> {
  const db = createDatabase();
  await seed(db);
  const notifications = new FakeWhatsAppAdapter();
  const payments = new FakeN1coAdapter();
  const auth = new AuthService(db, notifications);
  const ctx = buildContext({ db, notifications, payments, auth });
  return { app: createApp(ctx), db, notifications };
}

/** Seed users have deterministic ids per role: usr_<role-ish>. */
const USER_ID_BY_ROLE: Record<Role, string> = {
  super_admin: 'usr_kunal',
  admin: 'usr_admin',
  ops: 'usr_ops',
  finance: 'usr_finance',
  compliance: 'usr_compliance',
  support: 'usr_support',
  read_only: 'usr_readonly',
};

export function bearerFor(role: Role): string {
  return `Bearer ${signAccessToken(USER_ID_BY_ROLE[role], role)}`;
}

export function userIdFor(role: Role): string {
  return USER_ID_BY_ROLE[role];
}
