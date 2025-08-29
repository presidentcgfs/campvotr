import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from '../+server';
import type { RequestEvent } from '@sveltejs/kit';

// Mock dependencies
const mockOrgService = {
	requireOrgMembershipForSlug: vi.fn(),
	requireOrgMembershipForId: vi.fn()
};

const mockDrawSessionService = {
	createDrawSession: vi.fn()
};

const mockResolve = vi.fn((key: string) => {
	if (key === 'organizationService') return mockOrgService;
	if (key === 'drawSessionAdminService') return mockDrawSessionService;
	throw new Error(`Unknown service: ${key}`);
});

vi.mock('$lib/services/middleware', () => ({
	withAuth: vi.fn((event, handler) => handler(event, { id: 'user-1', email: 'test@example.com' }))
}));

describe('/api/admin/draw-sessions', () => {
	let mockEvent: Partial<RequestEvent>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEvent = {
			request: {
				headers: new Headers(),
				url: 'http://localhost:5174/api/admin/draw-sessions',
				json: vi.fn()
			} as any,
			locals: {
				resolve: mockResolve,
				organizationContext: {
					organization: { id: 'org-1' }
				}
			} as any
		};
	});

	describe('POST', () => {
		const validPayload = {
			name: 'Test Session',
			turnStrategy: 'random',
			startDate: '2024-01-01',
			endDate: '2024-01-31',
			participants: ['test@example.com'],
			schedules: [
				{
					fieldIds: ['field-1'],
					recurrence: {
						frequency: 'weekly',
						interval: 1,
						weekdays: ['MO'],
						startDate: '2024-01-01T00:00:00.000Z',
						endCondition: { type: 'afterCount', count: 4 },
						timeWindows: [{ start: '09:00', end: '10:00' }],
						timezone: 'UTC'
					},
					rules: [
						{
							rruleString:
								'DTSTART;TZID=UTC:20240101T090000\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=4',
							durationMinutes: 60
						}
					]
				}
			]
		};

		it('should create draw session successfully', async () => {
			// Mock successful org resolution
			mockOrgService.requireOrgMembershipForId.mockResolvedValue({
				organization: { id: 'org-1' }
			});

			// Mock successful draw session creation
			mockDrawSessionService.createDrawSession.mockResolvedValue({
				id: 'session-1',
				orgId: 'org-1',
				name: 'Test Session',
				turnStrategy: 'random',
				startDate: '2024-01-01',
				endDate: '2024-01-31',
				participantsCount: 1,
				schedulesCount: 1,
				schedules: [{ id: 'schedule-1', fieldIds: ['field-1'], rulesCount: 1 }],
				createdAt: new Date()
			});

			// Mock request body
			(mockEvent.request!.json as any).mockResolvedValue(validPayload);

			const response = await POST(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(201);
			expect(result).toMatchObject({
				id: 'session-1',
				orgId: 'org-1',
				name: 'Test Session',
				participantsCount: 1,
				schedulesCount: 1
			});
		});

		it('should return 400 for invalid payload', async () => {
			const invalidPayload = { ...validPayload, name: '' };
			(mockEvent.request!.json as any).mockResolvedValue(invalidPayload);

			const response = await POST(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toBe('Validation error');
		});

		it('should accept snake turn strategy', async () => {
			const snakePayload = { ...validPayload, turnStrategy: 'snake' };

			// Mock successful org resolution
			mockOrgService.requireOrgMembershipForId.mockResolvedValue({
				organization: { id: 'org-1' }
			});

			// Mock successful draw session creation with snake strategy
			mockDrawSessionService.createDrawSession.mockResolvedValue({
				id: 'session-1',
				orgId: 'org-1',
				name: 'Test Session',
				turnStrategy: 'snake',
				startDate: '2024-01-01',
				endDate: '2024-01-31',
				participantsCount: 1,
				schedulesCount: 1,
				schedules: [{ id: 'schedule-1', fieldIds: ['field-1'], rulesCount: 1 }],
				createdAt: new Date()
			});

			(mockEvent.request!.json as any).mockResolvedValue(snakePayload);

			const response = await POST(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(201);
			expect(result.turnStrategy).toBe('snake');
			expect(mockDrawSessionService.createDrawSession).toHaveBeenCalledWith(
				expect.objectContaining({ turnStrategy: 'snake' }),
				'org-1',
				'user-1'
			);
		});

		it('should reject invalid turn strategy', async () => {
			const invalidPayload = { ...validPayload, turnStrategy: 'invalid' };
			(mockEvent.request!.json as any).mockResolvedValue(invalidPayload);

			const response = await POST(mockEvent as RequestEvent);
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toBe('Validation error');
		});

		it('should resolve organization from X-ORG-SLUG header', async () => {
			mockEvent.request!.headers.set('X-ORG-SLUG', 'test-org');
			mockOrgService.requireOrgMembershipForSlug.mockResolvedValue({
				organization: { id: 'org-1' }
			});
			mockDrawSessionService.createDrawSession.mockResolvedValue({
				id: 'session-1',
				orgId: 'org-1',
				name: 'Test Session',
				turnStrategy: 'random',
				startDate: '2024-01-01',
				endDate: '2024-01-31',
				participantsCount: 1,
				schedulesCount: 1,
				schedules: [],
				createdAt: new Date()
			});
			(mockEvent.request!.json as any).mockResolvedValue(validPayload);

			await POST(mockEvent as RequestEvent);

			expect(mockOrgService.requireOrgMembershipForSlug).toHaveBeenCalledWith(
				mockEvent,
				'test-org'
			);
		});

		it('should resolve organization from query parameter', async () => {
			mockEvent.request!.url = 'http://localhost:5174/api/admin/draw-sessions?org=test-org';
			mockEvent.locals!.organizationContext = null;

			mockOrgService.requireOrgMembershipForSlug.mockResolvedValue({
				organization: { id: 'org-1' }
			});
			mockDrawSessionService.createDrawSession.mockResolvedValue({
				id: 'session-1',
				orgId: 'org-1',
				name: 'Test Session',
				turnStrategy: 'random',
				startDate: '2024-01-01',
				endDate: '2024-01-31',
				participantsCount: 1,
				schedulesCount: 1,
				schedules: [],
				createdAt: new Date()
			});
			(mockEvent.request!.json as any).mockResolvedValue(validPayload);

			await POST(mockEvent as RequestEvent);

			expect(mockOrgService.requireOrgMembershipForSlug).toHaveBeenCalledWith(
				mockEvent,
				'test-org'
			);
		});
	});

	describe('GET', () => {
		it('should return 405 Method Not Allowed', async () => {
			const response = await GET();

			expect(response.status).toBe(405);
			expect(response.headers.get('Allow')).toBe('POST');
		});
	});
});
