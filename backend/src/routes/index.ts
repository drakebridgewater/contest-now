import { Router } from 'express';
import healthRoutes from './health';
import eventRoutes from './events';
import contestRoutes from './contests';
import entryRoutes from './entries';
import voteRoutes from './votes';
import rankingVoteRoutes from './rankingVotes';
import voterRoutes from './voters';
import resultRoutes from './results';

const router = Router();

router.use('/health', healthRoutes);
router.use('/events', eventRoutes);
router.use('/contests', contestRoutes);
router.use('/entries', entryRoutes);
router.use('/votes', voteRoutes);
router.use('/ranking-votes', rankingVoteRoutes);
router.use('/voters', voterRoutes);
router.use('/results', resultRoutes);

export default router;