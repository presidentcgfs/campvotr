import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrawSessionService } from '../draw-session-service';
import { PickService } from '../pick-service';
import { calculateCurrentTurn, type Participant } from '../turn-order';

// Mock the database and dependencies
const mockDb = {
  transaction: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  set: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn()
};

vi.mock('$lib/pbj', () => ({
  drizzleKey: 'drizzle'
}));

vi.mock('@pbinj/pbj', () => ({
  pbj: vi.fn(() => mockDb),
  pbjKey: vi.fn((key: string) => key)
}));

describe('Snake Draft Integration', () => {
  let drawSessionService: DrawSessionService;
  let pickService: PickService;

  beforeEach(() => {
    vi.clearAllMocks();
    drawSessionService = new DrawSessionService(mockDb as any);
    pickService = new PickService(drawSessionService, mockDb as any);
  });

  describe('Snake Turn Order Calculation', () => {
    const participants: Participant[] = [
      { id: 'participant-1', position: 1 },
      { id: 'participant-2', position: 2 },
      { id: 'participant-3', position: 3 },
      { id: 'participant-4', position: 4 }
    ];

    it('should calculate correct snake turn sequence for 4 participants', () => {
      // Test the complete snake pattern: 1,2,3,4 - 4,3,2,1 - 1,2,3,4 - 4,3,2,1
      const expectedSequence = [
        // Round 1: Forward order
        { roundNumber: 1, turnNumber: 1, participantId: 'participant-1' },
        { roundNumber: 1, turnNumber: 2, participantId: 'participant-2' },
        { roundNumber: 1, turnNumber: 3, participantId: 'participant-3' },
        { roundNumber: 1, turnNumber: 4, participantId: 'participant-4' },
        // Round 2: Reverse order
        { roundNumber: 2, turnNumber: 1, participantId: 'participant-4' },
        { roundNumber: 2, turnNumber: 2, participantId: 'participant-3' },
        { roundNumber: 2, turnNumber: 3, participantId: 'participant-2' },
        { roundNumber: 2, turnNumber: 4, participantId: 'participant-1' },
        // Round 3: Forward order again
        { roundNumber: 3, turnNumber: 1, participantId: 'participant-1' },
        { roundNumber: 3, turnNumber: 2, participantId: 'participant-2' },
        { roundNumber: 3, turnNumber: 3, participantId: 'participant-3' },
        { roundNumber: 3, turnNumber: 4, participantId: 'participant-4' },
        // Round 4: Reverse order again
        { roundNumber: 4, turnNumber: 1, participantId: 'participant-4' },
        { roundNumber: 4, turnNumber: 2, participantId: 'participant-3' },
        { roundNumber: 4, turnNumber: 3, participantId: 'participant-2' },
        { roundNumber: 4, turnNumber: 4, participantId: 'participant-1' }
      ];

      for (let i = 0; i < expectedSequence.length; i++) {
        const turn = calculateCurrentTurn('snake', participants, i);
        expect(turn).toEqual(expectedSequence[i]);
      }
    });

    it('should handle partial rounds correctly', () => {
      // Test that snake pattern works correctly when stopping mid-round
      
      // Pick 5: Should be Round 2, Turn 2 (reverse order: 4,3,2,1)
      const turn5 = calculateCurrentTurn('snake', participants, 5);
      expect(turn5).toEqual({
        roundNumber: 2,
        turnNumber: 2,
        participantId: 'participant-3'
      });

      // Pick 10: Should be Round 3, Turn 3 (forward order: 1,2,3,4)
      const turn10 = calculateCurrentTurn('snake', participants, 10);
      expect(turn10).toEqual({
        roundNumber: 3,
        turnNumber: 3,
        participantId: 'participant-3'
      });
    });

    it('should work with different participant counts', () => {
      const twoParticipants: Participant[] = [
        { id: 'p1', position: 1 },
        { id: 'p2', position: 2 }
      ];

      // 2 participants: p1,p2 - p2,p1 - p1,p2 - p2,p1
      expect(calculateCurrentTurn('snake', twoParticipants, 0)).toEqual({
        roundNumber: 1, turnNumber: 1, participantId: 'p1'
      });
      expect(calculateCurrentTurn('snake', twoParticipants, 1)).toEqual({
        roundNumber: 1, turnNumber: 2, participantId: 'p2'
      });
      expect(calculateCurrentTurn('snake', twoParticipants, 2)).toEqual({
        roundNumber: 2, turnNumber: 1, participantId: 'p2'
      });
      expect(calculateCurrentTurn('snake', twoParticipants, 3)).toEqual({
        roundNumber: 2, turnNumber: 2, participantId: 'p1'
      });
      expect(calculateCurrentTurn('snake', twoParticipants, 4)).toEqual({
        roundNumber: 3, turnNumber: 1, participantId: 'p1'
      });
    });
  });

  describe('DrawSessionService with Snake Strategy', () => {
    it('should compute correct snake turns', async () => {
      const mockSessionState = {
        session: {
          id: 'session-1',
          turnStrategy: 'snake',
          rounds: null
        },
        participants: [
          { id: 'p1', position: 1, userId: 'user-1' },
          { id: 'p2', position: 2, userId: 'user-2' },
          { id: 'p3', position: 3, userId: 'user-3' }
        ],
        picks: [] // No picks made yet
      };

      // Mock fetchSessionState
      vi.spyOn(drawSessionService, 'fetchSessionState').mockResolvedValue(mockSessionState as any);

      // First turn should be participant 1
      const turn1 = await drawSessionService.computeCurrentTurn('org-1', 'session-1');
      expect(turn1).toEqual({
        roundNumber: 1,
        turnNumber: 1,
        participantId: 'p1'
      });

      // Simulate 3 picks made (end of round 1)
      mockSessionState.picks = new Array(3).fill(null);
      
      // Fourth turn should be participant 3 (start of round 2, reverse order)
      const turn4 = await drawSessionService.computeCurrentTurn('org-1', 'session-1');
      expect(turn4).toEqual({
        roundNumber: 2,
        turnNumber: 1,
        participantId: 'p3'
      });

      // Simulate 5 picks made (middle of round 2)
      mockSessionState.picks = new Array(5).fill(null);
      
      // Sixth turn should be participant 1 (round 2, turn 3, reverse order)
      const turn6 = await drawSessionService.computeCurrentTurn('org-1', 'session-1');
      expect(turn6).toEqual({
        roundNumber: 2,
        turnNumber: 3,
        participantId: 'p1'
      });
    });
  });

  describe('Strategy Comparison', () => {
    const participants: Participant[] = [
      { id: 'p1', position: 1 },
      { id: 'p2', position: 2 },
      { id: 'p3', position: 3 }
    ];

    it('should show difference between fixed and snake strategies', () => {
      // Fixed strategy: always goes 1,2,3 - 1,2,3 - 1,2,3
      const fixedTurns = [
        calculateCurrentTurn('fixed', participants, 0),
        calculateCurrentTurn('fixed', participants, 1),
        calculateCurrentTurn('fixed', participants, 2),
        calculateCurrentTurn('fixed', participants, 3),
        calculateCurrentTurn('fixed', participants, 4),
        calculateCurrentTurn('fixed', participants, 5)
      ];

      // Snake strategy: goes 1,2,3 - 3,2,1 - 1,2,3
      const snakeTurns = [
        calculateCurrentTurn('snake', participants, 0),
        calculateCurrentTurn('snake', participants, 1),
        calculateCurrentTurn('snake', participants, 2),
        calculateCurrentTurn('snake', participants, 3),
        calculateCurrentTurn('snake', participants, 4),
        calculateCurrentTurn('snake', participants, 5)
      ];

      // Verify fixed pattern
      expect(fixedTurns.map(t => t?.participantId)).toEqual(['p1', 'p2', 'p3', 'p1', 'p2', 'p3']);

      // Verify snake pattern
      expect(snakeTurns.map(t => t?.participantId)).toEqual(['p1', 'p2', 'p3', 'p3', 'p2', 'p1']);
    });

    it('should demonstrate fairness of snake strategy', () => {
      // In snake strategy, each participant gets equal opportunities in different positions
      const participants4: Participant[] = [
        { id: 'p1', position: 1 },
        { id: 'p2', position: 2 },
        { id: 'p3', position: 3 },
        { id: 'p4', position: 4 }
      ];

      // Generate 2 complete rounds (8 picks)
      const turns = [];
      for (let i = 0; i < 8; i++) {
        turns.push(calculateCurrentTurn('snake', participants4, i));
      }

      const turnOrder = turns.map(t => t?.participantId);
      
      // Verify the snake pattern: 1,2,3,4 - 4,3,2,1
      expect(turnOrder).toEqual(['p1', 'p2', 'p3', 'p4', 'p4', 'p3', 'p2', 'p1']);

      // Each participant should get exactly 2 picks
      const pickCounts = turnOrder.reduce((acc, pid) => {
        acc[pid!] = (acc[pid!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(pickCounts).toEqual({
        'p1': 2,
        'p2': 2,
        'p3': 2,
        'p4': 2
      });

      // Verify position fairness: each participant gets to pick first and last
      expect(turnOrder[0]).toBe('p1'); // p1 picks first in round 1
      expect(turnOrder[4]).toBe('p4'); // p4 picks first in round 2
      expect(turnOrder[3]).toBe('p4'); // p4 picks last in round 1
      expect(turnOrder[7]).toBe('p1'); // p1 picks last in round 2
    });
  });
});
