import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Create one single pool for the entire application
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,                      // Neon Free Tier safe limit
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Wait up to 10s for a new connection
  keepAlive: true,              // Prevent Neon from killing idle sockets
});

const prismaAdapter = new PrismaPg(pool);
export default prismaAdapter;