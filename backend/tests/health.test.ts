import request from 'supertest';
import server from '../src/server';

describe('Health Endpoint', () => {
  afterAll(() => {
    server.close();
  });

  it('should return health status', async () => {
    const response = await request(server)
      .get('/api/health')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        status: 'ok',
        message: 'Contest API is running',
        database: expect.any(String),
        timestamp: expect.any(String),
      }),
    });
  });

  it('should return health status at root health endpoint', async () => {
    const response = await request(server)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        status: 'ok',
        message: 'Contest API is running',
        database: expect.any(String),
        timestamp: expect.any(String),
      }),
    });
  });
});