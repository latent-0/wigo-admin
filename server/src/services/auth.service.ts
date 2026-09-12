import type { Database } from '../data/store';
import type { NotificationsPort } from '../ports/notifications';
import { config } from '../config/env';
import { sha256, nowIso } from '../lib/ids';
import { verifyPassword } from '../lib/password';
import { signAccessToken, signRefreshToken } from '../lib/jwt';
import { badRequest, tooManyRequests, unauthorized } from '../lib/errors';
import type { AdminUser } from '../domain/types';
import type { Role } from '../domain/roles';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

interface OtpEntry {
  phone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

/**
 * Auth service: WhatsApp-OTP + password login (replacing the vendor's insecure Email-OTP,
 * per the PRD). OTP codes are stored hashed with a short TTL and an attempt cap. Tokens
 * carry the role claim, which is preserved across refresh (the 11 Sep fix).
 */
export class AuthService {
  private otps = new Map<string, OtpEntry>();

  constructor(
    private readonly db: Database,
    private readonly notifications: NotificationsPort,
  ) {}

  private findActiveUserByPhone(phone: string): AdminUser | undefined {
    return this.db.adminUsers.find((u) => u.phone === phone && u.active);
  }

  private static generateCode(): string {
    // 6-digit numeric code.
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /**
   * Request an OTP. Always responds the same way whether or not the phone maps to a
   * known admin, to avoid leaking which numbers are provisioned. Sends via WhatsApp.
   * Returns `devCode` ONLY on the fake driver in non-production, so smoke tests and
   * staging demos can complete the flow without a live WhatsApp number.
   */
  async requestOtp(phone: string): Promise<{ expiresAt: string; devCode?: string }> {
    const now = Date.now();
    const prior = this.otps.get(phone);
    if (prior && now - prior.lastSentAt < RESEND_COOLDOWN_MS) {
      throw tooManyRequests('Please wait before requesting another code');
    }

    const code = AuthService.generateCode();
    const entry: OtpEntry = {
      phone,
      codeHash: sha256(`${phone}:${code}`),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    };
    this.otps.set(phone, entry);

    // Only actually send if the phone maps to an admin; otherwise silently no-op.
    const user = this.findActiveUserByPhone(phone);
    if (user) {
      try {
        await this.notifications.sendTemplate(phone, 'otp_login', { code });
      } catch {
        // Swallow provider errors here so we don't reveal delivery status; the user can
        // retry after the cooldown. A real deployment would alert on repeated failures.
      }
    }

    const result: { expiresAt: string; devCode?: string } = {
      expiresAt: new Date(entry.expiresAt).toISOString(),
    };
    if (config.whatsapp.driver === 'fake' && !config.isProd) {
      result.devCode = code;
    }
    return result;
  }

  /** Verify an OTP and issue tokens. */
  async verifyOtp(phone: string, code: string): Promise<AuthTokens> {
    const entry = this.otps.get(phone);
    if (!entry) throw unauthorized('No active code for this number');
    if (Date.now() > entry.expiresAt) {
      this.otps.delete(phone);
      throw unauthorized('Code expired');
    }
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      this.otps.delete(phone);
      throw tooManyRequests('Too many attempts');
    }
    entry.attempts += 1;
    if (entry.codeHash !== sha256(`${phone}:${code}`)) {
      throw unauthorized('Invalid code');
    }
    this.otps.delete(phone);

    const user = this.findActiveUserByPhone(phone);
    if (!user) throw unauthorized('No account for this number');
    return this.issueForUser(user.id);
  }

  /** Password login (second supported factor per the PRD). */
  async loginWithPassword(phone: string, password: string): Promise<AuthTokens> {
    const user = this.findActiveUserByPhone(phone);
    // Always run a hash comparison to keep timing uniform for unknown numbers.
    const ok = await verifyPassword(password, user?.passwordHash ?? '');
    if (!user || !ok) throw unauthorized('Invalid credentials');
    return this.issueForUser(user.id);
  }

  /** Rotate tokens. Re-reads the user so a role change or deactivation takes effect. */
  async refresh(userId: string): Promise<AuthTokens> {
    const user = this.db.adminUsers.get(userId);
    if (!user || !user.active) throw unauthorized('Account is not active');
    return this.issueForUser(user.id);
  }

  private issueForUser(userId: string): AuthTokens {
    const user = this.db.adminUsers.get(userId);
    if (!user) throw unauthorized('Account not found');
    this.db.adminUsers.update(user.id, { lastLoginAt: nowIso() });
    return {
      accessToken: signAccessToken(user.id, user.role),
      refreshToken: signRefreshToken(user.id, user.role),
      user: { id: user.id, name: user.name, role: user.role, phone: user.phone },
    };
  }

  /** Test/util: expose whether a phone currently has a pending OTP. */
  hasPendingOtp(phone: string): boolean {
    return this.otps.has(phone);
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; role: Role; phone: string };
}

export function assertPhone(phone: unknown): string {
  if (typeof phone !== 'string' || !/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw badRequest('phone must be E.164, e.g. +5215500000001');
  }
  return phone;
}
