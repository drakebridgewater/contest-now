import { Request, Response } from 'express';
import { entryService } from '@/services/EntryService';
import { validateEntry, validateEntryId } from '@/utils/validation';
import { ApiResponse } from '@/types';
import { asyncHandler } from '@/middleware/errorHandler';

export class EntryController {
  public getEntries = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const entries = await entryService.getAllEntries();

    const response: ApiResponse = {
      success: true,
      data: entries,
    };

    res.json(response);
  });

  public createEntry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = validateEntry(req.body);
    const entry = await entryService.createEntry(validatedData);

    const response: ApiResponse = {
      success: true,
      data: entry,
      message: 'Entry created successfully',
    };

    res.status(201).json(response);
  });

  public deleteEntry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const entryId = validateEntryId(req.params.id);
    await entryService.deleteEntry(entryId);

    const response: ApiResponse = {
      success: true,
      message: 'Entry and associated votes deleted successfully',
    };

    res.json(response);
  });

  public getResults = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const results = await entryService.getResults();

    const response: ApiResponse = {
      success: true,
      data: results,
    };

    res.json(response);
  });
}

export const entryController = new EntryController();
export default entryController;