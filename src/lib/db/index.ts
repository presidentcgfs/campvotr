import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from '$env/static/private';
import * as schema from './schema';

if (!DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

// Create the connection
const client = postgres(DATABASE_URL);
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from './schema';
