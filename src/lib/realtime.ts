import { writable } from 'svelte/store';
import type { VoteCounts, Vote } from './types';

export interface RealtimeVoteData {
	vote_counts: VoteCounts;
	user_vote: Vote | null;
	timestamp: string;
}

export class RealtimeVoteTracker {
	private eventSource: EventSource | null = null;
	private ballotId: string;

	public data = writable<RealtimeVoteData | null>(null);
	public connected = writable(false);
	public error = writable<string | null>(null);

	constructor(ballotId: string) {
		this.ballotId = ballotId;
	}

	connect() {
		if (this.eventSource) {
			this.disconnect();
		}

		try {
			// Cookie-based auth; no token in URL
			const url = `/api/ballots/${this.ballotId}/stream`;
			this.eventSource = new EventSource(url);

			this.eventSource.onopen = () => {
				this.connected.set(true);
				this.error.set(null);
			};

			this.eventSource.onmessage = (event) => {
				try {
					const data: RealtimeVoteData = JSON.parse(event.data);
					this.data.set(data);
				} catch (err) {
					console.error('Error parsing SSE data:', err);
					this.error.set('Error parsing real-time data');
				}
			};

			this.eventSource.onerror = (event) => {
				console.error('SSE error:', event);
				this.connected.set(false);
				this.error.set('Connection error');

				// Attempt to reconnect after 5 seconds
				setTimeout(() => {
					if (this.eventSource?.readyState === EventSource.CLOSED) {
						this.connect();
					}
				}, 5000);
			};
		} catch (err) {
			console.error('Error creating EventSource:', err);
			this.error.set('Failed to establish connection');
		}
	}

	disconnect() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.connected.set(false);
	}

	// Method to manually refresh data (fallback)
	async refreshData() {
		try {
			const response = await fetch(`/api/ballots/${this.ballotId}`);

			if (response.ok) {
				const result = await response.json();
				this.data.set({
					vote_counts: result.ballot.vote_counts,
					user_vote: result.ballot.user_vote,
					timestamp: new Date().toISOString()
				});
			}
		} catch (err) {
			console.error('Error refreshing data:', err);
			this.error.set('Failed to refresh data');
		}
	}
}
