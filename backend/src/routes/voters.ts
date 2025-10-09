import { Router } from 'express';
import { voteController } from '@/controllers/VoteController';

const router = Router();

// GET /api/voters - Get all voters
router.get('/', voteController.getAllVoters);

// DELETE /api/voters/:voterName - Delete voter and all their votes
router.delete('/:voterName', voteController.deleteVoter);

export default router;