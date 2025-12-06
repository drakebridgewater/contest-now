import { eventModel } from '@/models/Event';
import { Event, CreateEventRequest } from '@/types';

export class EventService {
  public async getAllEvents(): Promise<Event[]> {
    return eventModel.findAll();
  }

  public async getActiveEvents(): Promise<Event[]> {
    return eventModel.findActive();
  }

  public async getEventById(id: number): Promise<Event> {
    return eventModel.findById(id);
  }

  public async createEvent(eventData: CreateEventRequest): Promise<Event> {
    return eventModel.create(eventData);
  }

  public async updateEvent(id: number, eventData: Partial<CreateEventRequest>): Promise<Event> {
    return eventModel.update(id, eventData);
  }

  public async deleteEvent(id: number): Promise<void> {
    return eventModel.delete(id);
  }
}

export const eventService = new EventService();
export default eventService;
