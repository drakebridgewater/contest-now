import { Router } from 'express';
import { voteController } from '@/controllers/VoteController';

const router = Router();

// GET /api/votes - Get all votes (admin)
router.get('/', voteController.getAllVotes);

// POST /api/votes - Submit/update vote
router.post('/', voteController.submitVote);

// GET /api/votes/:voterName - Get votes for specific voter
router.get('/:voterName', voteController.getVotesByVoter);

export default router;