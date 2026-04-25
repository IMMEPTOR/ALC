import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config';
import { initSocket } from './socket';
import { startSimulator } from './services/simulator';
import { initCommandQueue } from './queue';
import { startWorker } from './queue/worker';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { mongoSanitize } from './middleware/sanitize';
import { apiRateLimit } from './middleware/rateLimit';
import logger from './logger';
import { initEventBus } from './events/eventBus';
import { startEventWorker } from './events/handlers';
import { rebuildReadModel } from './readmodels/nodeReadModel';

// Routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import sitesRoutes from './routes/sites';
import linesRoutes from './routes/lines';
import nodesRoutes from './routes/nodes';
import telemetryRoutes from './routes/telemetry';
import alertsRoutes from './routes/alerts';
import commandsRoutes from './routes/commands';
import logsRoutes from './routes/logs';
import metricsRoutes from './routes/metrics';

// CQRS + BFF
import cqrsRoutes from './cqrs';
import mobileBff from './bff/mobileBff';
import webBff from './bff/webBff';
import desktopBff from './bff/desktopBff';

const app = express();
const httpServer = createServer(app);

// 6.3.3 — helmet sets X-XSS-Protection, X-Content-Type-Options, CSP, etc.
app.use(helmet());

// 6.3.4 — CORS whitelist (no `*`). Origins are configured via CORS_ORIGINS env var.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server, mobile native
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// 6.3.2 — strip $-prefixed and dotted keys from inputs (NoSQL injection protection)
app.use(mongoSanitize);

// General API rate limit (login has stricter limit applied at the route level)
app.use('/api', apiRateLimit);

app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/lines', linesRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/commands', commandsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/metrics', metricsRoutes);

// CQRS endpoints (separated commands/queries, raw MongoDB for reads)
app.use('/api/cqrs', cqrsRoutes);

// BFF endpoints — separate per-client, with different DTOs and aggregation
app.use('/api/bff/mobile', mobileBff);
app.use('/api/bff/web', webBff);
app.use('/api/bff/desktop', desktopBff);


app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.use(errorHandler);


initSocket(httpServer);

mongoose.connect(config.mongoUri)
  .then(() => {
    logger.info('MongoDB connected');


    initCommandQueue();
    startWorker();
    initEventBus();
    startEventWorker();
    logger.info('Redis queue and worker initialized');

    // Build the denormalized read model from the write model on startup
    rebuildReadModel().catch(err => logger.error('Read model rebuild failed', { error: err.message }));

    httpServer.listen(config.port, () => {
      logger.info(`ALC Server running on port ${config.port}`);
      // генерация симуляций каждые 4 сек
      startSimulator(4000);
    });
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;
