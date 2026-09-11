import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import type { AccessTokenClaims, RefreshTokenClaims } from '../domain/types';
import type { Role } from '../domain/roles';
import { isRole } from '../domain/roles';

export function signAccessToken(sub: string, role: Role): string {
  const claims: AccessTokenClaims = { sub, role, type: 'access' };
  return jwt.sign(claims, config.jwt.accessSecret, {
    expiresIn: `${config.jwt.accessTtlMinutes}m`,
  });
}

export function signRefreshToken(sub: string, role: Role): string {
  const claims: RefreshTokenClaims = { sub, role, type: 'refresh' };
  return jwt.sign(claims, config.jwt.refreshSecret, {
    expiresIn: `${config.jwt.refreshTtlDays}d`,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const { sub, role, type } = parseClaims(jwt.verify(token, config.jwt.accessSecret));
  if (type !== 'access') throw new Error('Expected an access token');
  return { sub, role, type: 'access' };
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const { sub, role, type } = parseClaims(jwt.verify(token, config.jwt.refreshSecret));
  if (type !== 'refresh') throw new Error('Expected a refresh token');
  return { sub, role, type: 'refresh' };
}

function parseClaims(decoded: string | jwt.JwtPayload): { sub: string; role: Role; type: string } {
  if (typeof decoded === 'string') throw new Error('Malformed token');
  const { sub, role, type } = decoded as Record<string, unknown>;
  if (typeof sub !== 'string' || !isRole(role) || typeof type !== 'string') {
    throw new Error('Malformed token claims');
  }
  return { sub, role, type };
}
