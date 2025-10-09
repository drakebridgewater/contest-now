import { Router } from 'express';
import healthRoutes from './health';
import entryRoutes from './entries';
import voteRoutes from './votes';
import voterRoutes from './voters';
import resultRoutes from './results';

const router = Router();

router.use('/health', healthRoutes);
router.use('/entries', entryRoutes);
router.use('/votes', voteRoutes);
router.use('/voters', voterRoutes);
router.use('/results', resultRoutes);

export default router;