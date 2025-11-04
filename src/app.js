const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const client = require('prom-client');

const app = express();

// ============================================
// PROMETHEUS SETUP - NEW
// ============================================

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom Metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);

// Metrics middleware - MUST BE BEFORE OTHER MIDDLEWARE
app.use((req, res, next) => {
  const start = Date.now();
  
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
    
    activeConnections.dec();
  });
  
  next();
});

// ============================================
// EXISTING MIDDLEWARE
// ============================================

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Environment variables
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// ============================================
// EXISTING ROUTES
// ============================================

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Node.js app!',
    version: APP_VERSION,
    environment: ENVIRONMENT,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (req, res) => {
  // Mock data
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'GitOps User', email: 'git@ops.com' },
    { id: 4, name: 'Docker User', email: 'docker@ops.com' }
  ];
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required'
    });
  }

  const newUser = {
    id: Date.now(),
    name,
    email
  };

  res.status(201).json(newUser);
});

// ============================================
// METRICS ENDPOINT
// ============================================

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.send(metrics);
});

// ============================================
// EXISTING ERROR HANDLERS
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

module.exports = app;