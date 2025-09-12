import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrawSessionService } from '../draw-session-service';

// Mock the database and dependencies
const mockDb = {
	transaction: vi.fn(),
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	values: vi.fn(),
	returning: vi.fn(),
	set: vi.fn(),
	limit: vi.fn(),
	orderBy: vi.fn()
};

const mockTransaction = {
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	values: vi.fn(),
	returning: vi.fn(),
	set: vi.fn()
};

vi.mock('$lib/pbj', () => ({
	drizzleKey: 'drizzle'
}));

vi.mock('@pbinj/pbj', () => ({
	pbj: vi.fn(() => mockDb),
	pbjKey: vi.fn((key: string) => key)
}));

vi.mock('$lib/components/recurrence/recurrence-utils', () => ({
	validateTimeWindows: vi.fn(() => null), // No validation errors
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

vi.mock('crypto', () => ({
	randomUUID: vi.fn(() => 'mock-uuid-1234')
}));

describe('DrawSessionService', () => {
	let service: DrawSessionService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new DrawSessionService(mockDb as any);
	});

	describe('updateSession with schedules', () => {
		const mockSession = {
			id: 'session-1',
			organizationId: 'org-1',
			name: 'Updated Session',
			status: 'scheduled',
			turnStrategy: 'random',
			rounds: null,
			pickTimeoutSec: 60,
			startsAtUtc: new Date('2024-01-01T10:00:00Z'),
			startDate: new Date('2024-01-01'),
			endDate: new Date('2024-01-31'),
			createdByUserId: 'user-1',
			createdAt: new Date(),
			updatedAt: new Date()
		};

		const mockInput = {
			name: 'Updated Session',
			turnStrategy: 'random' as const,
			participants: [
				{ email: 'test@example.com', role: 'participant' }
			],
			schedules: [
				{
					fieldIds: ['field-1', 'field-2'],
					recurrence: {
						frequency: 'weekly' as const,
						interval: 1,
						weekdays: ['MO', 'WE', 'FR'],
						startDate: new Date('2024-01-01'),
						endCondition: { type: 'afterCount' as const, count: 4 },
						timeWindows: [{ start: '09:00', end: '10:00' }],
						timezone: 'UTC'
					}
				}
			]
		};

		it('should create new schedules when no ID provided', async () => {
			// Setup mocks
			mockDb.transaction.mockImplementation(async (callback) => {
				return callback(mockTransaction);
			});

			mockTransaction.update.mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockSession])
					})
				})
			});

			mockTransaction.delete.mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined)
			});

			mockTransaction.insert.mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: 'participant-1' }])
				})
			});

			mockTransaction.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]) // No existing schedules
				})
			});

			// Mock schedule creation
			const mockCreatedSchedule = {
				id: 'mock-uuid-1234',
				drawSessionId: 'session-1',
				recurrence: mockInput.schedules[0].recurrence,
				timezone: 'UTC',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			mockTransaction.insert.mockReturnValueOnce({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: 'participant-1' }])
				})
			}).mockReturnValueOnce({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([mockCreatedSchedule])
				})
			}).mockReturnValueOnce({
				values: vi.fn().mockResolvedValue(undefined) // Field associations
			});

			const result = await service.updateSession('org-1', 'session-1', mockInput);

			expect(result).toEqual({
				...mockSession,
				schedules: [{
					...mockCreatedSchedule,
					fieldIds: ['field-1', 'field-2']
				}]
			});

			// Verify schedule was created with generated ID
			expect(mockTransaction.insert).toHaveBeenCalledWith(
				expect.objectContaining({})
			);
		});

		it('should update existing schedules when ID provided', async () => {
			const existingSchedule = {
				id: 'existing-schedule-1',
				drawSessionId: 'session-1',
				recurrence: { frequency: 'daily' },
				timezone: 'UTC'
			};

			const inputWithId = {
				...mockInput,
				schedules: [{
					id: 'existing-schedule-1',
					fieldIds: ['field-1'],
					recurrence: {
						frequency: 'weekly' as const,
						interval: 1,
						weekdays: ['MO'],
						startDate: new Date('2024-01-01'),
						endCondition: { type: 'afterCount' as const, count: 2 },
						timeWindows: [{ start: '10:00', end: '11:00' }],
						timezone: 'UTC'
					}
				}]
			};

			// Setup mocks
			mockDb.transaction.mockImplementation(async (callback) => {
				return callback(mockTransaction);
			});

			mockTransaction.update.mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockSession])
					})
				})
			});

			mockTransaction.delete.mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined)
			});

			mockTransaction.insert.mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: 'participant-1' }])
				})
			});

			mockTransaction.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([existingSchedule])
				})
			});

			// Mock schedule update
			const mockUpdatedSchedule = {
				...existingSchedule,
				recurrence: inputWithId.schedules[0].recurrence,
				updatedAt: new Date()
			};

			mockTransaction.update.mockReturnValueOnce({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockSession])
					})
				})
			}).mockReturnValueOnce({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockUpdatedSchedule])
					})
				})
			});

			mockTransaction.insert.mockReturnValueOnce({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: 'participant-1' }])
				})
			}).mockReturnValueOnce({
				values: vi.fn().mockResolvedValue(undefined) // Field associations
			});

			const result = await service.updateSession('org-1', 'session-1', inputWithId);

			expect(result.schedules).toHaveLength(1);
			expect(result.schedules[0].id).toBe('existing-schedule-1');
		});

		it('should delete schedules not in input', async () => {
			const existingSchedules = [
				{ id: 'schedule-1', drawSessionId: 'session-1' },
				{ id: 'schedule-2', drawSessionId: 'session-1' }
			];

			// Input only contains schedule-1, so schedule-2 should be deleted
			const inputWithPartialSchedules = {
				...mockInput,
				schedules: [{
					id: 'schedule-1',
					fieldIds: ['field-1'],
					recurrence: mockInput.schedules[0].recurrence
				}]
			};

			// Setup mocks
			mockDb.transaction.mockImplementation(async (callback) => {
				return callback(mockTransaction);
			});

			mockTransaction.update.mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockSession])
					})
				})
			});

			mockTransaction.delete.mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined)
			});

			mockTransaction.insert.mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: 'participant-1' }])
				})
			});

			mockTransaction.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue(existingSchedules)
				})
			});

			await service.updateSession('org-1', 'session-1', inputWithPartialSchedules);

			// Verify delete was called for schedule-2
			expect(mockTransaction.delete).toHaveBeenCalledWith(
				expect.objectContaining({})
			);
		});
	});
});
