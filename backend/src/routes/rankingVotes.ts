import { Router } from 'express';
import { rankingVoteController } from '@/controllers/RankingVoteController';

const router = Router();

// GET /api/ranking-votes - Get all ranking votes (admin)
router.get('/', rankingVoteController.getAllVotes);

// POST /api/ranking-votes - Submit/update ranking vote
router.post('/', rankingVoteController.submitVote);

// POST /api/ranking-votes/submit-all - Submit all rankings (replaces all existing)
// MUST come before /:voterName route to avoid route conflicts
router.post('/submit-all', rankingVoteController.submitAllRankings);

// DELETE /api/ranking-votes/voter/:voterName - Delete all rankings for a voter
router.delete('/voter/:voterName', rankingVoteController.deleteAllForVoter);

// GET /api/ranking-votes/:voterName - Get ranking votes for specific voter
router.get('/:voterName', rankingVoteController.getByVoter);

// DELETE /api/ranking-votes/:voterName/:entryId - Delete a specific ranking vote
router.delete('/:voterName/:entryId', rankingVoteController.deleteVote);

export default router;

