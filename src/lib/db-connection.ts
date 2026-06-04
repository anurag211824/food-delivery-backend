import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Logger } from '@nestjs/common';

// Create one single pool for the entire application
const dbUrl = process.env.DATABASE_URL || '';
const hostMatch = dbUrl.match(/@([^:/]+)(?::(\d+))?/);
const dbHost = hostMatch ? hostMatch[1] : 'unknown';
const dbPort = hostMatch && hostMatch[2] ? parseInt(hostMatch[2], 10) : 5432;

const logger = new Logger('Database');
logger.log(`Connecting to ${dbHost}:${dbPort}`);

export const pool = new Pool({
  connectionString: dbUrl,
  port: dbPort,                 // Explicitly set port to fix "port: undefined" issues
  max: 15,                      // Neon Free Tier safe limit
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Wait up to 10s for a new connection
  keepAlive: true,              // Prevent Neon from killing idle sockets
});

const prismaAdapter = new PrismaPg(pool);
export default prismaAdapter;