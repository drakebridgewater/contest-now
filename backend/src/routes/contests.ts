import { Router } from 'express';
import { contestController } from '@/controllers/ContestController';

const router = Router();

router.get('/', contestController.getAllContests.bind(contestController));
router.get('/active', contestController.getActiveContests.bind(contestController));
router.get('/event/:eventId', contestController.getContestsByEventId.bind(contestController));
router.get('/:id', contestController.getContestById.bind(contestController));
router.post('/', contestController.createContest.bind(contestController));
router.put('/:id', contestController.updateContest.bind(contestController));
router.delete('/:id', contestController.deleteContest.bind(contestController));

export default router;
