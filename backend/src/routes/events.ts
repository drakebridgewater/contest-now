import { Router } from 'express';
import { eventController } from '@/controllers/EventController';

const router = Router();

router.get('/', eventController.getAllEvents.bind(eventController));
router.get('/active', eventController.getActiveEvents.bind(eventController));
router.get('/:id', eventController.getEventById.bind(eventController));
router.post('/', eventController.createEvent.bind(eventController));
router.put('/:id', eventController.updateEvent.bind(eventController));
router.delete('/:id', eventController.deleteEvent.bind(eventController));

export default router;
