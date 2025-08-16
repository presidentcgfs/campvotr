import type { RequestHandler } from './$types';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { getUser, supabaseServer } from '$lib/services/auth';

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

	// Get BallotService instance through dependency injection
	const ballotService = event.locals.resolve(ballotServiceKey);

	// Check if ballot exists and user is eligible
	const ballot = await ballotService.getBallot(ballotId, user.id);
	if (!ballot) {
		return new Response('Ballot not found or access denied', { status: 404 });
	}

	const encoder = new TextEncoder();
	let interval: ReturnType<typeof setInterval>;
	let closed = false;
	const stream = new ReadableStream({
		start(controller) {
			const sendUpdate = async () => {
				try {
					if (closed) return;
					const voteCounts = await ballotService.getVoteCounts(ballotId);
					const userVote = await ballotService.getUserVote(ballotId, user.id);
					const data = JSON.stringify({
						vote_counts: voteCounts,
						user_vote: userVote,
						timestamp: new Date().toISOString()
					});
					controller.enqueue(encoder.encode(`data: ${data}\n\n`));
				} catch (error) {
					if (!closed) {
						console.error('Error sending SSE update:', error);
					}
				}
			};
			// Send initial update
			sendUpdate();
			// Set up periodic updates (every 5 seconds)
			interval = setInterval(sendUpdate, 5000);
			// Clean up on client abort
			event.request.signal.addEventListener('abort', () => {
				closed = true;
				clearInterval(interval);
				try {
					controller.close();
				} catch {}
			});
		},
		cancel() {
			closed = true;
			clearInterval(interval);
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
