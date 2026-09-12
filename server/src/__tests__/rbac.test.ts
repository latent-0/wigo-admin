import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, bearerFor } from './helpers';

describe('RBAC route enforcement (10 Sep gap, closed 11 Sep)', () => {
  it('blocks a read_only role from writing rider status with 403', async () => {
    const { app } = await makeTestApp();
    const res = await request(app)
      .patch('/api/riders/rdr_001')
      .set('Authorization', bearerFor('read_only'))
      .send({ status: 'suspended' });
    expect(res.status).toBe(403);
  });

  it('allows an ops role to write rider status', async () => {
    const { app } = await makeTestApp();
    const res = await request(app)
      .patch('/api/riders/rdr_001')
      .set('Authorization', bearerFor('ops'))
      .send({ status: 'suspended' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
  });

  it('requires authentication (401 without a token)', async () => {
    const { app } = await makeTestApp();
    const res = await request(app).get('/api/kpis');
    expect(res.status).toBe(401);
  });

  it('blocks support from reviewing documents (support is read-only there)', async () => {
    const { app } = await makeTestApp();
    const res = await request(app)
      .post('/api/documents/doc_001/approve')
      .set('Authorization', bearerFor('support'));
    expect(res.status).toBe(403);
  });

  it('lets compliance review documents', async () => {
    const { app } = await makeTestApp();
    const res = await request(app)
      .post('/api/documents/doc_001/approve')
      .set('Authorization', bearerFor('compliance'));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('blocks finance from sending notifications', async () => {
    const { app } = await makeTestApp();
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', bearerFor('finance'))
      .send({ to: '+5215515590000', templateName: 'application_approved', params: { name: 'A', city: 'CDMX' } });
    expect(res.status).toBe(403);
  });
});
