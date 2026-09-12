import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp } from './helpers';
import { DEMO_PASSWORD } from '../data/seed';
import { verifyAccessToken } from '../lib/jwt';

describe('auth: WhatsApp-OTP + password', () => {
  it('completes the OTP login flow and returns a role-bearing token', async () => {
    const { app } = await makeTestApp();
    const phone = '+5215500000001'; // seeded super_admin

    const reqRes = await request(app).post('/api/auth/otp/request').send({ phone });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.devCode).toBeDefined(); // fake driver, non-prod

    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone, code: reqRes.body.devCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.role).toBe('super_admin');

    const claims = verifyAccessToken(verifyRes.body.accessToken);
    expect(claims.role).toBe('super_admin');
  });

  it('rejects an invalid OTP code', async () => {
    const { app } = await makeTestApp();
    const phone = '+5215500000001';
    await request(app).post('/api/auth/otp/request').send({ phone });
    const res = await request(app).post('/api/auth/otp/verify').send({ phone, code: '000000' });
    expect(res.status).toBe(401);
  });

  it('logs in with a password', async () => {
    const { app } = await makeTestApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+5215500000004', password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('finance');
  });

  it('rejects a wrong password', async () => {
    const { app } = await makeTestApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+5215500000004', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('carries the role claim through refresh (11 Sep fix)', async () => {
    const { app } = await makeTestApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+5215500000005', password: DEMO_PASSWORD });
    expect(login.body.user.role).toBe('compliance');

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    // The refreshed access token must still carry the role — not drop it.
    const claims = verifyAccessToken(refreshed.body.accessToken);
    expect(claims.role).toBe('compliance');
  });

  it('rejects a garbage refresh token', async () => {
    const { app } = await makeTestApp();
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not-a-token' });
    expect(res.status).toBe(401);
  });
});
