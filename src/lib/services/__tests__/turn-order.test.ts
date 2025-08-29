import { describe, it, expect } from 'vitest';
import {
  calculateSnakeRoundOrder,
  generateSnakeTurns,
  calculateSnakeCurrentTurn,
  calculateCurrentTurn,
  generateAllTurns,
  type Participant
} from '../turn-order';

describe('Turn Order Utilities', () => {
  const participants4: Participant[] = [
    { id: 'p1', position: 1 },
    { id: 'p2', position: 2 },
    { id: 'p3', position: 3 },
    { id: 'p4', position: 4 }
  ];

  const participants2: Participant[] = [
    { id: 'p1', position: 1 },
    { id: 'p2', position: 2 }
  ];

  const participants1: Participant[] = [
    { id: 'p1', position: 1 }
  ];

  describe('calculateSnakeRoundOrder', () => {
    it('should return forward order for even rounds (0, 2, 4, ...)', () => {
      expect(calculateSnakeRoundOrder(participants4, 0)).toEqual(['p1', 'p2', 'p3', 'p4']);
      expect(calculateSnakeRoundOrder(participants4, 2)).toEqual(['p1', 'p2', 'p3', 'p4']);
      expect(calculateSnakeRoundOrder(participants4, 4)).toEqual(['p1', 'p2', 'p3', 'p4']);
    });

    it('should return reverse order for odd rounds (1, 3, 5, ...)', () => {
      expect(calculateSnakeRoundOrder(participants4, 1)).toEqual(['p4', 'p3', 'p2', 'p1']);
      expect(calculateSnakeRoundOrder(participants4, 3)).toEqual(['p4', 'p3', 'p2', 'p1']);
      expect(calculateSnakeRoundOrder(participants4, 5)).toEqual(['p4', 'p3', 'p2', 'p1']);
    });

    it('should work with 2 participants', () => {
      expect(calculateSnakeRoundOrder(participants2, 0)).toEqual(['p1', 'p2']);
      expect(calculateSnakeRoundOrder(participants2, 1)).toEqual(['p2', 'p1']);
      expect(calculateSnakeRoundOrder(participants2, 2)).toEqual(['p1', 'p2']);
    });

    it('should work with 1 participant', () => {
      expect(calculateSnakeRoundOrder(participants1, 0)).toEqual(['p1']);
      expect(calculateSnakeRoundOrder(participants1, 1)).toEqual(['p1']);
      expect(calculateSnakeRoundOrder(participants1, 2)).toEqual(['p1']);
    });

    it('should handle empty participants array', () => {
      expect(calculateSnakeRoundOrder([], 0)).toEqual([]);
    });

    it('should sort participants by position', () => {
      const unsortedParticipants = [
        { id: 'p3', position: 3 },
        { id: 'p1', position: 1 },
        { id: 'p2', position: 2 }
      ];
      expect(calculateSnakeRoundOrder(unsortedParticipants, 0)).toEqual(['p1', 'p2', 'p3']);
      expect(calculateSnakeRoundOrder(unsortedParticipants, 1)).toEqual(['p3', 'p2', 'p1']);
    });
  });

  describe('generateSnakeTurns', () => {
    it('should generate correct snake pattern for 4 participants, 2 rounds', () => {
      const turns = generateSnakeTurns(participants4, 2, 8);
      
      expect(turns).toHaveLength(8);
      
      // Round 1: 1,2,3,4
      expect(turns[0]).toEqual({ roundNumber: 1, turnNumber: 1, participantId: 'p1' });
      expect(turns[1]).toEqual({ roundNumber: 1, turnNumber: 2, participantId: 'p2' });
      expect(turns[2]).toEqual({ roundNumber: 1, turnNumber: 3, participantId: 'p3' });
      expect(turns[3]).toEqual({ roundNumber: 1, turnNumber: 4, participantId: 'p4' });
      
      // Round 2: 4,3,2,1
      expect(turns[4]).toEqual({ roundNumber: 2, turnNumber: 1, participantId: 'p4' });
      expect(turns[5]).toEqual({ roundNumber: 2, turnNumber: 2, participantId: 'p3' });
      expect(turns[6]).toEqual({ roundNumber: 2, turnNumber: 3, participantId: 'p2' });
      expect(turns[7]).toEqual({ roundNumber: 2, turnNumber: 4, participantId: 'p1' });
    });

    it('should respect slot limit', () => {
      const turns = generateSnakeTurns(participants4, null, 6);
      expect(turns).toHaveLength(6);
      
      // Should stop at 6 slots even though round 2 isn't complete
      expect(turns[5]).toEqual({ roundNumber: 2, turnNumber: 2, participantId: 'p3' });
    });

    it('should respect round limit', () => {
      const turns = generateSnakeTurns(participants4, 1, 10);
      expect(turns).toHaveLength(4); // Only 1 round = 4 turns
      
      expect(turns[0]).toEqual({ roundNumber: 1, turnNumber: 1, participantId: 'p1' });
      expect(turns[3]).toEqual({ roundNumber: 1, turnNumber: 4, participantId: 'p4' });
    });

    it('should handle unlimited rounds with slot cap', () => {
      const turns = generateSnakeTurns(participants2, null, 5);
      expect(turns).toHaveLength(5);
      
      // Round 1: p1, p2
      // Round 2: p2, p1  
      // Round 3: p1 (stopped at 5)
      expect(turns[4]).toEqual({ roundNumber: 3, turnNumber: 1, participantId: 'p1' });
    });

    it('should return empty array for no participants or no slots', () => {
      expect(generateSnakeTurns([], 2, 8)).toEqual([]);
      expect(generateSnakeTurns(participants4, 2, 0)).toEqual([]);
    });
  });

  describe('calculateSnakeCurrentTurn', () => {
    it('should calculate correct turn for various pick counts', () => {
      // Pick 0: Round 1, Turn 1, p1
      expect(calculateSnakeCurrentTurn(participants4, 0)).toEqual({
        roundNumber: 1, turnNumber: 1, participantId: 'p1'
      });
      
      // Pick 3: Round 1, Turn 4, p4
      expect(calculateSnakeCurrentTurn(participants4, 3)).toEqual({
        roundNumber: 1, turnNumber: 4, participantId: 'p4'
      });
      
      // Pick 4: Round 2, Turn 1, p4 (reverse order)
      expect(calculateSnakeCurrentTurn(participants4, 4)).toEqual({
        roundNumber: 2, turnNumber: 1, participantId: 'p4'
      });
      
      // Pick 7: Round 2, Turn 4, p1 (reverse order)
      expect(calculateSnakeCurrentTurn(participants4, 7)).toEqual({
        roundNumber: 2, turnNumber: 4, participantId: 'p1'
      });
      
      // Pick 8: Round 3, Turn 1, p1 (forward order again)
      expect(calculateSnakeCurrentTurn(participants4, 8)).toEqual({
        roundNumber: 3, turnNumber: 1, participantId: 'p1'
      });
    });

    it('should handle single participant', () => {
      expect(calculateSnakeCurrentTurn(participants1, 0)).toEqual({
        roundNumber: 1, turnNumber: 1, participantId: 'p1'
      });
      expect(calculateSnakeCurrentTurn(participants1, 5)).toEqual({
        roundNumber: 6, turnNumber: 1, participantId: 'p1'
      });
    });

    it('should return null for empty participants', () => {
      expect(calculateSnakeCurrentTurn([], 0)).toBeNull();
    });
  });

  describe('calculateCurrentTurn - all strategies', () => {
    it('should handle snake strategy', () => {
      const turn = calculateCurrentTurn('snake', participants4, 4);
      expect(turn).toEqual({
        roundNumber: 2, turnNumber: 1, participantId: 'p4'
      });
    });

    it('should handle fixed strategy', () => {
      const turn = calculateCurrentTurn('fixed', participants4, 4);
      expect(turn).toEqual({
        roundNumber: 2, turnNumber: 1, participantId: 'p1'
      });
    });

    it('should handle round_robin strategy', () => {
      // Round robin rotates starting position each round
      const turn1 = calculateCurrentTurn('round_robin', participants4, 0); // Round 1 starts with p1
      expect(turn1?.participantId).toBe('p1');
      
      const turn2 = calculateCurrentTurn('round_robin', participants4, 4); // Round 2 starts with p2
      expect(turn2?.participantId).toBe('p2');
    });

    it('should respect round limits', () => {
      const turn = calculateCurrentTurn('snake', participants4, 0, 0); // 0 rounds allowed
      expect(turn).toBeNull();
    });

    it('should respect slot limits', () => {
      const turn = calculateCurrentTurn('snake', participants4, 5, null, 5); // Only 5 slots available
      expect(turn).toBeNull();
    });

    it('should throw for unsupported strategy', () => {
      expect(() => {
        calculateCurrentTurn('unsupported' as any, participants4, 0);
      }).toThrow('Unsupported turn strategy: unsupported');
    });
  });

  describe('generateAllTurns', () => {
    it('should generate complete snake sequence', () => {
      const turns = generateAllTurns('snake', participants2, 2, 4);
      
      expect(turns).toEqual([
        { roundNumber: 1, turnNumber: 1, participantId: 'p1' },
        { roundNumber: 1, turnNumber: 2, participantId: 'p2' },
        { roundNumber: 2, turnNumber: 1, participantId: 'p2' },
        { roundNumber: 2, turnNumber: 2, participantId: 'p1' }
      ]);
    });

    it('should generate complete fixed sequence', () => {
      const turns = generateAllTurns('fixed', participants2, 2, 4);
      
      expect(turns).toEqual([
        { roundNumber: 1, turnNumber: 1, participantId: 'p1' },
        { roundNumber: 1, turnNumber: 2, participantId: 'p2' },
        { roundNumber: 2, turnNumber: 1, participantId: 'p1' },
        { roundNumber: 2, turnNumber: 2, participantId: 'p2' }
      ]);
    });

    it('should stop at slot limit', () => {
      const turns = generateAllTurns('snake', participants4, null, 3);
      expect(turns).toHaveLength(3);
    });

    it('should stop at round limit', () => {
      const turns = generateAllTurns('snake', participants4, 1, 10);
      expect(turns).toHaveLength(4); // 1 round × 4 participants
    });
  });
});
