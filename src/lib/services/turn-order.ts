/**
 * Turn order calculation utilities for draw sessions
 * 
 * Supports different turn strategies:
 * - fixed: Sequential order (1,2,3,4 - 1,2,3,4 - ...)
 * - randomized: Random initial order, then fixed
 * - snake: Serpentine/alternating order (1,2,3,4 - 4,3,2,1 - 1,2,3,4 - ...)
 * - random: Random order each round
 * - round_robin: Sequential with rotation
 */

export type TurnStrategy = 'fixed' | 'randomized' | 'snake' | 'random' | 'round_robin';

export interface Participant {
  id: string;
  position: number; // 1-based position in initial order
}

export interface TurnOrderResult {
  roundNumber: number;
  turnNumber: number;
  participantId: string;
}

/**
 * Calculate the participant order for a specific round using snake (serpentine) strategy
 * 
 * Snake strategy alternates the order each round:
 * - Even rounds (0, 2, 4, ...): forward order [1, 2, 3, 4]
 * - Odd rounds (1, 3, 5, ...): reverse order [4, 3, 2, 1]
 * 
 * @param participants - Array of participants ordered by position
 * @param roundIndex - Zero-based round index (0 = first round)
 * @returns Array of participant IDs in turn order for that round
 */
export function calculateSnakeRoundOrder(
  participants: Participant[], 
  roundIndex: number
): string[] {
  if (participants.length === 0) return [];
  
  // Sort participants by position to ensure consistent ordering
  const sortedParticipants = [...participants].sort((a, b) => a.position - b.position);
  
  // Even rounds (0, 2, 4, ...): forward order
  // Odd rounds (1, 3, 5, ...): reverse order
  if (roundIndex % 2 === 0) {
    return sortedParticipants.map(p => p.id);
  } else {
    return sortedParticipants.reverse().map(p => p.id);
  }
}

/**
 * Generate all turns for a snake strategy session
 * 
 * @param participants - Array of participants ordered by position
 * @param totalRounds - Total number of rounds (null = unlimited)
 * @param totalSlots - Total available time slots to cap generation
 * @returns Array of turn order results
 */
export function generateSnakeTurns(
  participants: Participant[],
  totalRounds: number | null,
  totalSlots: number
): TurnOrderResult[] {
  if (participants.length === 0 || totalSlots <= 0) return [];
  
  const turns: TurnOrderResult[] = [];
  let roundIndex = 0;
  let totalTurns = 0;
  
  while (totalTurns < totalSlots) {
    // Check if we've reached the round limit
    if (totalRounds !== null && roundIndex >= totalRounds) {
      break;
    }
    
    const roundOrder = calculateSnakeRoundOrder(participants, roundIndex);
    const roundNumber = roundIndex + 1; // 1-based round number
    
    for (let turnIndex = 0; turnIndex < roundOrder.length && totalTurns < totalSlots; turnIndex++) {
      turns.push({
        roundNumber,
        turnNumber: turnIndex + 1, // 1-based turn number within round
        participantId: roundOrder[turnIndex]
      });
      totalTurns++;
    }
    
    roundIndex++;
  }
  
  return turns;
}

/**
 * Calculate the current turn for a snake strategy session
 * 
 * @param participants - Array of participants ordered by position
 * @param completedPicks - Number of picks already made
 * @returns Current turn information or null if no more turns
 */
export function calculateSnakeCurrentTurn(
  participants: Participant[],
  completedPicks: number
): TurnOrderResult | null {
  if (participants.length === 0) return null;
  
  const participantCount = participants.length;
  const roundIndex = Math.floor(completedPicks / participantCount);
  const turnIndex = completedPicks % participantCount;
  
  const roundOrder = calculateSnakeRoundOrder(participants, roundIndex);
  
  if (turnIndex >= roundOrder.length) return null;
  
  return {
    roundNumber: roundIndex + 1,
    turnNumber: turnIndex + 1,
    participantId: roundOrder[turnIndex]
  };
}

/**
 * Calculate turn order for any strategy
 * 
 * @param strategy - Turn strategy to use
 * @param participants - Array of participants
 * @param completedPicks - Number of picks already made
 * @param totalRounds - Total rounds (null = unlimited)
 * @param totalSlots - Total available slots
 * @returns Current turn information or null if no more turns
 */
export function calculateCurrentTurn(
  strategy: TurnStrategy,
  participants: Participant[],
  completedPicks: number,
  totalRounds: number | null = null,
  totalSlots: number = Infinity
): TurnOrderResult | null {
  if (participants.length === 0 || completedPicks >= totalSlots) return null;
  
  switch (strategy) {
    case 'snake':
      return calculateSnakeCurrentTurn(participants, completedPicks);
      
    case 'fixed':
    case 'randomized':
      // Fixed strategy: sequential order, participants already shuffled if randomized
      const participantCount = participants.length;
      const roundIndex = Math.floor(completedPicks / participantCount);
      const turnIndex = completedPicks % participantCount;
      
      // Check round limit
      if (totalRounds !== null && roundIndex >= totalRounds) return null;
      
      const sortedParticipants = [...participants].sort((a, b) => a.position - b.position);
      
      return {
        roundNumber: roundIndex + 1,
        turnNumber: turnIndex + 1,
        participantId: sortedParticipants[turnIndex].id
      };
      
    case 'random':
      // Random strategy would need additional logic to track per-round randomization
      // For now, fall back to fixed behavior
      return calculateCurrentTurn('fixed', participants, completedPicks, totalRounds, totalSlots);
      
    case 'round_robin':
      // Round robin with rotation - each round starts with next participant
      const rrParticipantCount = participants.length;
      const rrRoundIndex = Math.floor(completedPicks / rrParticipantCount);
      const rrTurnIndex = completedPicks % rrParticipantCount;
      
      // Check round limit
      if (totalRounds !== null && rrRoundIndex >= totalRounds) return null;
      
      const rrSortedParticipants = [...participants].sort((a, b) => a.position - b.position);
      // Rotate starting position based on round
      const startOffset = rrRoundIndex % rrParticipantCount;
      const participantIndex = (startOffset + rrTurnIndex) % rrParticipantCount;
      
      return {
        roundNumber: rrRoundIndex + 1,
        turnNumber: rrTurnIndex + 1,
        participantId: rrSortedParticipants[participantIndex].id
      };
      
    default:
      throw new Error(`Unsupported turn strategy: ${strategy}`);
  }
}

/**
 * Generate a complete turn sequence for any strategy
 * 
 * @param strategy - Turn strategy to use
 * @param participants - Array of participants
 * @param totalRounds - Total rounds (null = unlimited)
 * @param totalSlots - Total available slots
 * @returns Array of all turns in order
 */
export function generateAllTurns(
  strategy: TurnStrategy,
  participants: Participant[],
  totalRounds: number | null,
  totalSlots: number
): TurnOrderResult[] {
  const turns: TurnOrderResult[] = [];
  
  for (let i = 0; i < totalSlots; i++) {
    const turn = calculateCurrentTurn(strategy, participants, i, totalRounds, totalSlots);
    if (!turn) break;
    turns.push(turn);
  }
  
  return turns;
}
