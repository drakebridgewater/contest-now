import { Router } from 'express';
import { voteController } from '@/controllers/VoteController';

const router = Router();

// GET /api/voters - Get all voters
router.get('/', voteController.getAllVoters);

// PUT /api/voters/update-name - Update voter name
router.put('/update-name', voteController.updateVoterName);

// DELETE /api/voters/:voterName - Delete voter and all their votes
router.delete('/:voterName', voteController.deleteVoter);

export default router;