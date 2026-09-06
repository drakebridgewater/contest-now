import {
  CreateEntryFieldsSchema,
  couldBePhotoPart,
  PHOTO_INPUT_FORMAT_LIST,
  PHOTO_MAX_BYTES,
  UpsertBallotSchema,
  UpsertVoteSchema,
  VoterName,
} from '@contest/shared';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import { getContestConfig } from '../../services/contest.ts';
import { createEntry, listEntries, type PhotoStorage } from '../../services/entries.ts';
import { deleteBallot, getVoterState, upsertBallot, upsertVote } from '../../services/votes.ts';
import { badRequest, parse, unsupportedMedia } from '../errors.ts';

const EntryId = z.coerce.number().int().positive();
const AwardId = z.string().min(1);

/** Accepts `allergens` as repeated form fields, a single value, or a JSON array string. */
function normalizeAllergens(raw: unknown): unknown {
  if (raw === undefined || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    if (raw.trim().startsWith('[')) {
      try {
        return JSON.parse(raw);
      } catch {
        throw badRequest('allergens must be a JSON array');
      }
    }
    return [raw];
  }
  return raw;
}

export function publicRoutes(db: Db, storage: PhotoStorage): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 20 },
    // Only a bandwidth filter: it turns away a part that says it is a PDF or a
    // video before reading it, and lets everything else through. What the file
    // actually is gets decided from its bytes in storePhoto, because the type a
    // browser puts on the part is just its guess from the file extension.
    fileFilter: (_req, file, cb) => {
      if (couldBePhotoPart(file.mimetype)) cb(null, true);
      else cb(unsupportedMedia(`Please upload a photo: ${PHOTO_INPUT_FORMAT_LIST}.`));
    },
  });

  router.get('/contest', async (_req, res) => {
    res.json(await getContestConfig(db));
  });

  router.get('/entries', async (_req, res) => {
    res.json(await listEntries(db, storage));
  });

  router.post('/entries', upload.single('photo'), async (req, res) => {
    if (!req.file) throw badRequest('A photo is required');
    const body = req.body as Record<string, unknown>;
    const fields = parse(CreateEntryFieldsSchema, {
      ...body,
      allergens: normalizeAllergens(body.allergens),
    });
    const entry = await createEntry(db, fields, req.file.buffer, storage);
    res.status(201).json(entry);
  });

  router.get('/voters/:voterName', async (req, res) => {
    const voterName = parse(VoterName, req.params.voterName, 'voter name');
    res.json(await getVoterState(db, voterName));
  });

  router.put('/votes/:entryId', async (req, res) => {
    const entryId = parse(EntryId, req.params.entryId, 'entry id');
    const input = parse(UpsertVoteSchema, req.body);
    res.json(await upsertVote(db, entryId, input));
  });

  router.put('/award-ballots/:awardId', async (req, res) => {
    const awardId = parse(AwardId, req.params.awardId, 'award id');
    const input = parse(UpsertBallotSchema, req.body);
    res.json(await upsertBallot(db, awardId, input));
  });

  router.delete('/award-ballots/:awardId/:voterName', async (req, res) => {
    const awardId = parse(AwardId, req.params.awardId, 'award id');
    const voterName = parse(VoterName, req.params.voterName, 'voter name');
    await deleteBallot(db, awardId, voterName);
    res.status(204).end();
  });

  return router;
}
