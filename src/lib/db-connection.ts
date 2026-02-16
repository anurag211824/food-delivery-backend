import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Create one single pool for the entire application
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15, // Neon's Free Tier has a limit, 15 is safe
});

const prismaAdapter = new PrismaPg(pool);
export default prismaAdapter;