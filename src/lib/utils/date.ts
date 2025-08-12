export function formatDistanceToNow(date: Date): string {
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) {
		return 'just now';
	}

	const diffInMinutes = Math.floor(diffInSeconds / 60);
	if (diffInMinutes < 60) {
		return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'}`;
	}

	const diffInHours = Math.floor(diffInMinutes / 60);
	if (diffInHours < 24) {
		return `${diffInHours} hour${diffInHours === 1 ? '' : 's'}`;
	}

	const diffInDays = Math.floor(diffInHours / 24);
	if (diffInDays < 30) {
		return `${diffInDays} day${diffInDays === 1 ? '' : 's'}`;
	}

	const diffInMonths = Math.floor(diffInDays / 30);
	if (diffInMonths < 12) {
		return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'}`;
	}

	const diffInYears = Math.floor(diffInMonths / 12);
	return `${diffInYears} year${diffInYears === 1 ? '' : 's'}`;
}

export function formatDateTime(date: Date): string {
	return date.toLocaleString();
}

export function formatDate(date: Date): string {
	return date.toLocaleDateString();
}

export function formatTime(date: Date): string {
	return date.toLocaleTimeString();
}

const MINUTE = 60_000;

// Format date as YYYY-MM-DD local
export function formatISOLocal(d = new Date()) {
	return new Date(d.getTime() - d.getTimezoneOffset() * MINUTE).toISOString().slice(0, 16);
}
export function tomorrow() {
	return new Date(Date.now() + 24 * 60 * MINUTE);
}
