import { z } from 'zod';

export const ANNOUNCEMENT_MAX = 200;

/** How long an announcement stays live, in minutes. After that it never pops up. */
export const ANNOUNCEMENT_DURATIONS = [5, 15, 30, 60] as const;
export const ANNOUNCEMENT_DEFAULT_DURATION = 15;

export const CreateAnnouncementSchema = z.object({
  message: z.string().trim().min(1).max(ANNOUNCEMENT_MAX),
  durationMinutes: z.literal(ANNOUNCEMENT_DURATIONS).default(ANNOUNCEMENT_DEFAULT_DURATION),
});
export type CreateAnnouncement = z.input<typeof CreateAnnouncementSchema>;

/** A pop-up message from the host to everyone on the site. */
export interface Announcement {
  id: number;
  message: string;
  createdAt: string;
  expiresAt: string;
}
