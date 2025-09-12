import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../../../../routes/api/users/lookup-by-email/+server';
import type { RequestEvent } from '@sveltejs/kit';
import { userServiceKey } from '$lib/services/user-service';

// Mock dependencies
const mockUserService = {
	findMemberByEmail: vi.fn()
};

const mockResolve = vi.fn((key: any) => {
	if (key === userServiceKey) return mockUserService;
	throw new Error(`Unknown service: ${String(key)}`);
});

vi.mock('$lib/services/middleware', () => ({
	withAuth: vi.fn((event, handler) => handler(event, { id: 'user-1', email: 'test@example.com' }))
}));

describe('/api/users/lookup-by-email', () => {
	let mockEvent: Partial<RequestEvent>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEvent = {
			request: {
				url: 'http://localhost:5174/api/users/lookup-by-email?email=member@example.com'
			} as any,
			locals: {
				resolve: mockResolve,
				organizationContext: {
					organization: { id: 'org-1' }
				}
			} as any
		};
	});

	describe('GET', () => {
		it('should return user ID when member is found', async () => {
			mockUserService.findMemberByEmail.mockResolvedValue({
				userId: 'user-123',
				displayName: 'John Doe'
			});

			const response = await GET(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result).toEqual({
				userId: 'user-123',
				displayName: 'John Doe',
				email: 'member@example.com'
			});
			expect(mockUserService.findMemberByEmail).toHaveBeenCalledWith('org-1', 'member@example.com');
		});

		it('should return 404 when member is not found', async () => {
			mockUserService.findMemberByEmail.mockResolvedValue(null);

			const response = await GET(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(404);
			expect(result.error).toBe('User not found in organization');
		});

		it('should return 400 when email parameter is missing', async () => {
			mockEvent.request!.url = 'http://localhost:5174/api/users/lookup-by-email';

			const response = await GET(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toBe('Email parameter is required');
		});

		it('should return 400 when email format is invalid', async () => {
			mockEvent.request!.url =
				'http://localhost:5174/api/users/lookup-by-email?email=invalid-email';

			const response = await GET(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toBe('Invalid email format');
		});

		it('should return 400 when organization context is missing', async () => {
			mockEvent.locals!.organizationContext = null;

			const response = await GET(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toBe('Organization context not found');
		});

		it('should handle service errors gracefully', async () => {
			mockUserService.findMemberByEmail.mockRejectedValue(new Error('Database error'));

			const response = await GET(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(500);
			expect(result.error).toBe('Internal server error');
		});
	});
});
