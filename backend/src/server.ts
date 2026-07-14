import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';

// Import routers
import ticketRouter from './routes/tickets';
import geminiRouter from './routes/gemini';
import forecastingRouter from './routes/forecasting';
import fixturesRouter from './routes/fixtures';
import visionRouter from './routes/vision';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8082;

// Enable CORS
app.use(cors());

// Configure body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Structured Logging Middleware (GCP Cloud Logging Compliant)
 * Anonymizes any PII before outputting logs.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Simple deep copy of body to censor PII
    const safeBody = JSON.parse(JSON.stringify(req.body || {}));
    const piiFields = ['phone', 'email', 'idScan', 'name', 'password', 'mobile'];
    
    const censor = (obj: any) => {
      for (const key in obj) {
        if (piiFields.includes(key)) {
          obj[key] = '[REDACTED_PII]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          censor(obj[key]);
        }
      }
    };
    censor(safeBody);

    console.log(JSON.stringify({
      severity: res.statusCode >= 400 ? 'ERROR' : 'INFO',
      message: `${req.method} ${req.originalUrl} completed in ${duration}ms`,
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        status: res.statusCode,
        userAgent: req.get('user-agent'),
        latency: `${duration / 1000}s`,
      },
      requestBody: Object.keys(safeBody).length ? safeBody : undefined,
    }));
  });
  next();
});

// Register api endpoints
app.use('/api/tickets', ticketRouter);
app.use('/api/gemini', geminiRouter);
app.use('/api/forecasting', forecastingRouter);
app.use('/api/fixtures', fixturesRouter);
app.use('/api/vision', visionRouter);

// Health Check Endpoint for Cloud Run / GCLB
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date() });
});

// Serve static frontend assets
const frontendPath = path.join(__dirname, '../../public');
app.use(express.static(frontendPath));

// Route all other GET requests to the React SPA index.html (fallback)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({
    severity: 'ERROR',
    message: err.message,
    stack: err.stack,
  }));
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(JSON.stringify({
      severity: 'INFO',
      message: `Smart Stadiums Backend running on port ${PORT}`,
    }));
  });
}

export { app };
