import type { RequestHandler } from './$types';
import { BallotService } from '$lib/db/queries';
import { getUser, supabaseServer } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	// Prefer SSR cookie-based user; fallback to legacy header or query param token
	let user = (event as any).locals?.user ?? (await getUser(event));
	if (!user) {
		const accessToken = event.url.searchParams.get('access_token');
		if (accessToken) {
			const {
				data: { user: u }
			} = await supabaseServer.auth.getUser(accessToken);
			if (u) user = u as any;
		}
	}
	if (!user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { id: ballotId } = event.params;

	// Check if ballot exists and user is eligible
	const ballot = await BallotService.getBallot(ballotId, user.id);
	if (!ballot) {
		return new Response('Ballot not found or access denied', { status: 404 });
	}

	const stream = new ReadableStream({
		start(controller) {
			// Send initial data
			const sendUpdate = async () => {
				try {
					const voteCounts = await BallotService.getVoteCounts(ballotId);
					const userVote = await BallotService.getUserVote(ballotId, user.id);

					const data = JSON.stringify({
						vote_counts: voteCounts,
						user_vote: userVote,
						timestamp: new Date().toISOString()
					});

					controller.enqueue(`data: ${data}\n\n`);
				} catch (error) {
					console.error('Error sending SSE update:', error);
				}
			};

			// Send initial update
			sendUpdate();

			// Set up periodic updates (every 5 seconds)
			const interval = setInterval(sendUpdate, 5000);

			// Clean up on close
			return () => {
				clearInterval(interval);
			};
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Cache-Control'
		}
	});
};
