import { Router } from 'express';
import { entryController } from '@/controllers/EntryController';

const router = Router();

// GET /api/results - Get results with statistics
router.get('/', entryController.getResults);

export default router;