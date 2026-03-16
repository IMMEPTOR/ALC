import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config';
import { initSocket } from './socket';
import { startSimulator } from './services/simulator';

// Routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import sitesRoutes from './routes/sites';
import linesRoutes from './routes/lines';
import nodesRoutes from './routes/nodes';
import telemetryRoutes from './routes/telemetry';
import alertsRoutes from './routes/alerts';
import commandsRoutes from './routes/commands';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/lines', linesRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/commands', commandsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io
initSocket(httpServer);

// Connect to MongoDB and start
mongoose.connect(config.mongoUri)
  .then(() => {
    console.log('MongoDB connected');
    httpServer.listen(config.port, () => {
      console.log(`ALC Server running on port ${config.port}`);
      // Start telemetry simulator (generate data every 4 seconds)
      startSimulator(4000);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;
