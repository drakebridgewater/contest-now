import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';

import { config } from '@/config';
import logger from '@/utils/logger';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import routes from '@/routes';
import { database } from '@/models/database';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));


// CORS
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
if (!fs.existsSync(config.server.uploadsDir)) {
  fs.mkdirSync(config.server.uploadsDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(config.server.uploadsDir));

// API routes
app.use('/api', routes);

// Health check route (also available at root for load balancers)
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      message: 'Contest API is running',
      database: database.isDbReady() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await database.close();
    logger.info('Database connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info('🚀 Contest API Server is running!');
  logger.info(`📍 Local: http://localhost:${config.server.port}`);
  logger.info(`📍 Network: http://${config.server.host}:${config.server.port}`);
  logger.info(`📍 Environment: ${config.server.nodeEnv}`);
  logger.info('🔗 API Endpoints:');
  logger.info('  GET  /api/health - Health check');
  logger.info('  GET  /api/entries - Get all entries');
  logger.info('  POST /api/entries - Submit new entry');
  logger.info('  DELETE /api/entries/:id - Delete entry');
  logger.info('  GET  /api/votes/:voterName - Get votes for a voter');
  logger.info('  POST /api/votes - Submit/update a vote');
  logger.info('  GET  /api/votes - Get all votes');
  logger.info('  GET  /api/voters - Get all voters');
  logger.info('  DELETE /api/voters/:voterName - Delete voter');
  logger.info('  GET  /api/results - Get results with statistics');
});

export default server;
