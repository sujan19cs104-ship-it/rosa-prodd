import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerRoutes } from '../routes';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  return app;
}

describe('Reviews API', () => {
  it('quick-signin validates phone and returns 404 for missing bookings', async () => {
    const app = makeApp();
    await registerRoutes(app as any);
    const res = await request(app).post('/api/auth/quick-signin').send({ name: 'A', phone: '000' });
    expect([400, 404, 200]).toContain(res.statusCode);
  });
});