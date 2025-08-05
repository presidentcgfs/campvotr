import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';

export const GET: RequestHandler = async () => {
	try {
		// Test database connection
		await db.execute('SELECT 1');

		return json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			services: {
				database: 'connected',
				api: 'operational'
			}
		});
	} catch (error) {
		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				services: {
					database: 'disconnected',
					api: 'operational'
				},
				error: 'Database connection failed'
			},
			{ status: 503 }
		);
	}
};
