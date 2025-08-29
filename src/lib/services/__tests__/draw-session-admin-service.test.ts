import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrawSessionAdminService } from '../draw-session-admin-service';
import type { RecurrenceMulti } from '$lib/components/recurrence/recurrence-utils';

// Mock the database and dependencies
const mockDb = {
	transaction: vi.fn(),
	select: vi.fn(),
	insert: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	values: vi.fn(),
	returning: vi.fn()
};

const mockTransaction = {
	insert: vi.fn(),
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	values: vi.fn(),
	returning: vi.fn()
};

vi.mock('$lib/pbj', () => ({
	drizzleKey: 'drizzle'
}));

vi.mock('@pbinj/pbj', () => ({
	pbj: vi.fn(() => mockDb),
	pbjKey: vi.fn((key: string) => key)
}));

vi.mock('$lib/components/recurrence/recurrence-utils', () => ({
	validateRecurrenceMulti: vi.fn(),
	generateTimeSlotsMulti: vi.fn(() => [
		{
			start: new Date('2024-01-01T09:00:00Z'),
			end: new Date('2024-01-01T10:00:00Z'),
			windowIndex: 0
		},
		{
			start: new Date('2024-01-03T09:00:00Z'),
			end: new Date('2024-01-03T10:00:00Z'),
			windowIndex: 0
		}
	])
}));

describe('DrawSessionAdminService', () => {
	let service: DrawSessionAdminService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new DrawSessionAdminService(mockDb as any);
	});

	describe('createDrawSession', () => {
		const validInput = {
			name: 'Test Session',
			turnStrategy: 'random' as const,
			startDate: '2024-01-01',
			endDate: '2024-01-31',
			participants: ['test@example.com', 'admin@example.com:admin'],
			schedules: [
				{
					fieldIds: ['field-1', 'field-2'],
					recurrence: {
						frequency: 'weekly',
						interval: 1,
						weekdays: ['MO', 'WE', 'FR'],
						startDate: new Date('2024-01-01T00:00:00Z').toTemporalInstant(),
						endCondition: { type: 'afterCount', count: 4 },
						timeWindows: [{ start: '09:00', end: '10:00' }],
						timezone: 'UTC'
					} as RecurrenceMulti,
					rules: [
						{
							rruleString:
								'DTSTART;TZID=UTC:20240101T090000\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=4',
							durationMinutes: 60
						}
					]
				}
			]
		};

		it('should validate input correctly', async () => {
			// Mock successful field validation
			mockDb.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ id: 'field-1' }, { id: 'field-2' }])
				})
			});

			// Mock successful transaction
			mockDb.transaction.mockImplementation(async (callback) => {
				const mockSession = {
					id: 'session-1',
					organizationId: 'org-1',
					name: 'Test Session',
					turnStrategy: 'random',
					startDate: '2024-01-01',
					endDate: '2024-01-31',
					createdAt: new Date()
				};

				mockTransaction.insert.mockReturnValue({
					values: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockSession])
					})
				});

				return callback(mockTransaction);
			});

			const result = await service.createDrawSession(validInput, 'org-1', 'user-1');

			expect(result).toMatchObject({
				id: 'session-1',
				orgId: 'org-1',
				name: 'Test Session',
				turnStrategy: 'random',
				participantsCount: 2,
				schedulesCount: 1
			});
		});

		it('should reject invalid name', async () => {
			const invalidInput = { ...validInput, name: '' };

			await expect(service.createDrawSession(invalidInput, 'org-1', 'user-1')).rejects.toThrow(
				'Name must be between 1 and 120 characters'
			);
		});

		it('should reject invalid turn strategy', async () => {
			const invalidInput = { ...validInput, turnStrategy: 'invalid' as any };

			await expect(service.createDrawSession(invalidInput, 'org-1', 'user-1')).rejects.toThrow(
				'Invalid turn strategy'
			);
		});

		it('should accept snake turn strategy', async () => {
			const snakeInput = { ...validInput, turnStrategy: 'snake' as const };

			// Mock successful field validation
			mockDb.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ id: 'field-1' }, { id: 'field-2' }])
				})
			});

			// Mock successful transaction
			mockDb.transaction.mockImplementation(async (callback) => {
				const mockSession = {
					id: 'session-1',
					organizationId: 'org-1',
					name: 'Test Session',
					turnStrategy: 'snake',
					startDate: '2024-01-01',
					endDate: '2024-01-31',
					createdAt: new Date()
				};

				mockTransaction.insert.mockReturnValue({
					values: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockSession])
					})
				});

				return callback(mockTransaction);
			});

			const result = await service.createDrawSession(snakeInput, 'org-1', 'user-1');

			expect(result.turnStrategy).toBe('snake');
		});

		it('should reject invalid date range', async () => {
			const invalidInput = { ...validInput, startDate: '2024-01-31', endDate: '2024-01-01' };

			await expect(service.createDrawSession(invalidInput, 'org-1', 'user-1')).rejects.toThrow(
				'End date must be >= start date'
			);
		});

		it('should reject too many participants', async () => {
			const participants = Array.from({ length: 201 }, (_, i) => `user${i}@example.com`);
			const invalidInput = { ...validInput, participants };

			await expect(service.createDrawSession(invalidInput, 'org-1', 'user-1')).rejects.toThrow(
				'Maximum 200 participants allowed'
			);
		});

		it('should reject empty schedules', async () => {
			const invalidInput = { ...validInput, schedules: [] };

			await expect(service.createDrawSession(invalidInput, 'org-1', 'user-1')).rejects.toThrow(
				'At least one schedule is required'
			);
		});
	});

	describe('parseParticipants', () => {
		it('should parse email-only participants', () => {
			const result = (service as any).parseParticipants(['test@example.com', 'admin@example.com']);

			expect(result).toEqual([
				{ email: 'test@example.com', role: 'member' },
				{ email: 'admin@example.com', role: 'member' }
			]);
		});

		it('should parse email:role participants', () => {
			const result = (service as any).parseParticipants([
				'test@example.com:admin',
				'user@example.com:member'
			]);

			expect(result).toEqual([
				{ email: 'test@example.com', role: 'admin' },
				{ email: 'user@example.com', role: 'member' }
			]);
		});

		it('should handle mixed formats', () => {
			const result = (service as any).parseParticipants([
				'test@example.com',
				'admin@example.com:admin'
			]);

			expect(result).toEqual([
				{ email: 'test@example.com', role: 'member' },
				{ email: 'admin@example.com', role: 'admin' }
			]);
		});
	});
});
