import fs from 'fs';
import path from 'path';
import { entryModel } from '@/models/Entry';
import { CreateEntryRequest, EntryWithPhoto, EntryResult } from '@/types';
import { config } from '@/config';
import { ValidationError, InternalServerError } from '@/utils/errors';
import logger from '@/utils/logger';

export class EntryService {
  public async getAllEntries(contestId?: string): Promise<EntryWithPhoto[]> {
    return entryModel.findAll(contestId);
  }

  public async createEntry(entryData: CreateEntryRequest): Promise<EntryWithPhoto> {
    // Extract base64 image data
    const matches = entryData.photo.match(/^data:image\/([a-zA-Z]*);base64,([^"]*)/);
    if (!matches || matches.length < 3) {
      throw new ValidationError('Invalid image format');
    }

    const imageType = matches[1];
    const base64Data = matches[2];

    if (!imageType || !base64Data) {
      throw new ValidationError('Invalid image data');
    }
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${imageType}`;
    const filepath = path.join(config.server.uploadsDir, filename);

    try {
      // Write image file
      await fs.promises.writeFile(filepath, base64Data, 'base64');
      logger.info(`Image saved: ${filename}`);

      // Create entry in database
      return await entryModel.create(entryData, filename);
    } catch (error) {
      // Clean up file if database operation failed
      try {
        if (fs.existsSync(filepath)) {
          await fs.promises.unlink(filepath);
        }
      } catch (cleanupError) {
        logger.error('Failed to clean up image file:', cleanupError);
      }

      logger.error('Error creating entry:', error);
      throw new InternalServerError('Failed to create entry');
    }
  }

  public async deleteEntry(id: number): Promise<void> {
    const entry = await entryModel.delete(id);

    // Delete the associated photo file
    const photoPath = path.join(config.server.uploadsDir, entry.photo_path);
    try {
      if (fs.existsSync(photoPath)) {
        await fs.promises.unlink(photoPath);
        logger.info(`Deleted photo file: ${entry.photo_path}`);
      }
    } catch (error) {
      logger.error('Error deleting photo file:', error);
      // Don't throw error for file deletion failure
    }
  }

  public async getResults(contestId?: string): Promise<EntryResult[]> {
    return entryModel.getResults(contestId);
  }
}

export const entryService = new EntryService();
export default entryService;