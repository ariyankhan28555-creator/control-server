import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

dotenv.config();

const {
  HOST,
  IS_PRODUCTION,
  MAX_BODY_BYTES,
  NODE_ENV,
  PORT,
  PUBLIC_DIR,
  TRUST_PROXY
} = await import('./config/config.js');
const { getApiKey, getPublicConfig } = await import('./config/settings.js');
const { setSecretCollector, errorHandler, notFoundHandler } = await import('./middleware/errorHandler.js');
const { generalLimiter, chatLimiter, searchLimiter, ttsLimiter } = await import('./middleware/rateLimiter.js');
const { default: healthRouter } = await import('./routes/health.js');
const { default: configRouter } = await import('./routes/config.js');
const { default: chatRouter } = await import('./routes/chat.js');
const { default: searchRouter } = await import('./routes/search.js');
const { default: ttsRouter } = await import('./routes/tts.js');
const { default: systemRouter, setManagedServer, pushLog } = await import('./routes/system.js');
const { default: controlAuth } = await import('./middleware/controlAuth.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
function captureConsole(original, level) {
  return (...args) => {
    const line = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    pushLog(`${level} ${line}`);
    original(...args);
  };
}
console.log = captureConsole(originalConsoleLog, 'LOG');
console.error = captureConsole(originalConsoleError, 'ERROR');

setSecretCollector(() => [
  getApiKey('groq'),
  getApiKey('gemini'),
  getApiKey('deepseek'),
  getApiKey('openrouter'),
  getApiKey('tavily'),
  getApiKey('elevenlabs')
]);

export function createApp() {
  const app = express();

  if (TRUST_PROXY) app.set('trust proxy', TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' }
    })
  );

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length) {
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || corsOrigins.includes(origin)) return callback(null, true);
          return callback(new Error('Origin not allowed by CORS'));
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-control-token', 'Authorization'],
        maxAge: 86400
      })
    );
  }

  app.use(express.json({ limit: MAX_BODY_BYTES }));

  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on('finish', () => {
      console.log(
        `[http] ${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms`
      );
    });
    next();
  });

  app.use('/api/health', healthRouter);
  app.use('/healthz', healthRouter);
  app.use('/api/system', controlAuth, systemRouter);
  app.use('/api/config', generalLimiter, configRouter);
  app.use('/api/chat', chatLimiter, chatRouter);
  app.use('/api/search', searchLimiter, searchRouter);
  app.use('/api/tts', ttsLimiter, ttsRouter);

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ['html'],
      etag: true,
      maxAge: IS_PRODUCTION ? '1h' : 0,
      setHeaders: (response, filePath) => {
        if (filePath.endsWith('index.html')) response.setHeader('Cache-Control', 'no-cache');
      }
    })
  );

  app.get(/^\/(?!api\/|healthz).*/, (request, response, next) => {
    if (request.method !== 'GET') return next();
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(path.join(PUBLIC_DIR, 'index.html'), (error) => {
      if (error) next(error);
    });
  });

  app.use('/api', notFoundHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function startServer() {
  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    setManagedServer(server);
    const config = getPublicConfig();
    console.log(`Bypass AI Pro running in ${NODE_ENV} mode`);
    console.log(`Local:   http://localhost:${PORT}`);
    console.log(`Network: http://${HOST}:${PORT}`);
    console.log(`Providers with keys: ${Object.entries(config.keys).filter(([, value]) => value).map(([key]) => key).join(', ') || 'none'}`);
    if (!config.keys.groq && !config.keys.gemini && !config.keys.deepseek && !config.keys.openrouter) {
      console.warn('No AI provider key configured yet. Open Settings in the app or set one in .env.');
    }
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) startServer();
