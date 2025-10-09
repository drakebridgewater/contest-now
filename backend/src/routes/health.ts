import { Router } from 'express';
import { healthController } from '@/controllers/HealthController';

const router = Router();

// GET /api/health - Health check
router.get('/', healthController.getHealth);

export default router;