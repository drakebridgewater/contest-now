import { Router } from 'express';
import { rankingVoteController } from '@/controllers/RankingVoteController';

const router = Router();

// GET /api/ranking-votes - Get all ranking votes (admin)
router.get('/', rankingVoteController.getAllVotes);

// POST /api/ranking-votes - Submit/update ranking vote
router.post('/', rankingVoteController.submitVote);

// GET /api/ranking-votes/:voterName - Get ranking votes for specific voter
router.get('/:voterName', rankingVoteController.getByVoter);

// DELETE /api/ranking-votes/:voterName/:entryId - Delete a specific ranking vote
router.delete('/:voterName/:entryId', rankingVoteController.deleteVote);

export default router;

