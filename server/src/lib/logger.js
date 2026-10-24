import pino from 'pino';

// Structured logging. Never log passwords, tokens, secrets, or full payloads
// containing payment credentials.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.token', '*.secret', '*.passwordHash'],
    censor: '[redacted]',
  },
});
