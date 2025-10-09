import { Router } from 'express';
import { entryController } from '@/controllers/EntryController';

const router = Router();

// GET /api/entries - Get all entries
router.get('/', entryController.getEntries);

// POST /api/entries - Create new entry
router.post('/', entryController.createEntry);

// DELETE /api/entries/:id - Delete entry
router.delete('/:id', entryController.deleteEntry);

export default router;