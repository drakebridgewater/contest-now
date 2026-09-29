import {
  CreateEntryFieldsSchema,
  couldBePhotoPart,
  PHOTO_INPUT_FORMAT_LIST,
  PHOTO_MAX_BYTES,
  UpsertBallotSchema,
  UpsertVoteSchema,
} from '@contest/shared';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Auth } from '../../auth.ts';
import type { Db } from '../../db/client.ts';
import { getContestConfig } from '../../services/contest.ts';
import { createEntry, listEntries, type PhotoStorage } from '../../services/entries.ts';
import { deleteBallot, getVoterState, upsertBallot, upsertVote } from '../../services/votes.ts';
import { badRequest, parse, unsupportedMedia } from '../errors.ts';
import { guestOf, requireGuest } from '../middleware/guestAuth.ts';

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

export function publicRoutes(db: Db, auth: Auth, storage: PhotoStorage): Router {
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
      guestId: body.guestId === '' ? undefined : body.guestId,
    });
    const entry = await createEntry(db, fields, req.file.buffer, storage);
    res.status(201).json(entry);
  });

  router.get('/me/state', requireGuest(auth, 'vote'), async (_req, res) => {
    res.json(await getVoterState(db, guestOf(res).id));
  });

  router.put('/votes/:entryId', requireGuest(auth, 'vote'), async (req, res) => {
    const entryId = parse(EntryId, req.params.entryId, 'entry id');
    const input = parse(UpsertVoteSchema, req.body);
    res.json(await upsertVote(db, entryId, guestOf(res).id, input));
  });

  router.put('/award-ballots/:awardId', requireGuest(auth, 'vote'), async (req, res) => {
    const awardId = parse(AwardId, req.params.awardId, 'award id');
    const input = parse(UpsertBallotSchema, req.body);
    res.json(await upsertBallot(db, awardId, guestOf(res).id, input));
  });

  router.delete('/award-ballots/:awardId', requireGuest(auth, 'vote'), async (req, res) => {
    const awardId = parse(AwardId, req.params.awardId, 'award id');
    await deleteBallot(db, awardId, guestOf(res).id);
    res.status(204).end();
  });

  return router;
}
