import {
  AddGuestsSchema,
  AwardInputSchema,
  CategoryInputSchema,
  CriterionInputSchema,
  RenameVoterSchema,
  SendInvitesSchema,
  SettingsInputSchema,
} from '@contest/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/client.ts';
import {
  createAward,
  createCategory,
  createCriterion,
  deleteAward,
  deleteCategory,
  deleteCriterion,
  getContestConfig,
  getSettings,
  updateAward,
  updateCategory,
  updateCriterion,
  updateSettings,
} from '../../services/contest.ts';
import { deleteEntry, type PhotoStorage } from '../../services/entries.ts';
import { computeResults } from '../../services/results.ts';
import {
  addGuests,
  createInviteLink,
  deleteGuest,
  listGuests,
  renameGuest,
  sendInvites,
} from '../../services/guests.ts';
import type { Mailer } from '../../services/mailer.ts';
import { parse } from '../errors.ts';

const IntId = z.coerce.number().int().positive();
const SlugParam = z.string().min(1).max(40);
const GuestId = z.string().min(1).max(64);

/** Everything under /api/admin. The password check is applied by the caller. */
export function adminRoutes(
  db: Db,
  storage: PhotoStorage,
  mail: { mailer: Mailer; publicUrl: string },
): Router {
  const router = Router();

  router.post('/login', (_req, res) => {
    res.status(204).end();
  });

  router.get('/config', async (_req, res) => {
    res.json(await getContestConfig(db, { includeInactive: true }));
  });

  router.get('/results', async (_req, res) => {
    res.json(await computeResults(db, storage));
  });

  router.put('/settings', async (req, res) => {
    res.json(await updateSettings(db, parse(SettingsInputSchema, req.body)));
  });

  // categories
  router.post('/categories', async (req, res) => {
    res.status(201).json(await createCategory(db, parse(CategoryInputSchema, req.body)));
  });
  router.put('/categories/:id', async (req, res) => {
    const id = parse(SlugParam, req.params.id, 'category id');
    res.json(await updateCategory(db, id, parse(CategoryInputSchema, req.body)));
  });
  router.delete('/categories/:id', async (req, res) => {
    await deleteCategory(db, parse(SlugParam, req.params.id, 'category id'));
    res.status(204).end();
  });

  // criteria
  router.post('/criteria', async (req, res) => {
    res.status(201).json(await createCriterion(db, parse(CriterionInputSchema, req.body)));
  });
  router.put('/criteria/:id', async (req, res) => {
    const id = parse(IntId, req.params.id, 'criterion id');
    res.json(await updateCriterion(db, id, parse(CriterionInputSchema.partial(), req.body)));
  });
  router.delete('/criteria/:id', async (req, res) => {
    await deleteCriterion(db, parse(IntId, req.params.id, 'criterion id'));
    res.status(204).end();
  });

  // awards
  router.post('/awards', async (req, res) => {
    res.status(201).json(await createAward(db, parse(AwardInputSchema, req.body)));
  });
  router.put('/awards/:id', async (req, res) => {
    const id = parse(SlugParam, req.params.id, 'award id');
    res.json(await updateAward(db, id, parse(AwardInputSchema, req.body)));
  });
  router.delete('/awards/:id', async (req, res) => {
    await deleteAward(db, parse(SlugParam, req.params.id, 'award id'));
    res.status(204).end();
  });

  // entries
  router.delete('/entries/:id', async (req, res) => {
    await deleteEntry(db, parse(IntId, req.params.id, 'entry id'), storage);
    res.status(204).end();
  });

  // guests & RSVPs
  router.get('/guests', async (_req, res) => {
    res.json(await listGuests(db));
  });
  router.post('/guests', async (req, res) => {
    res.status(201).json(await addGuests(db, parse(AddGuestsSchema, req.body).guests));
  });
  router.put('/guests/:id', async (req, res) => {
    const id = parse(GuestId, req.params.id, 'guest id');
    const { newName } = parse(RenameVoterSchema, req.body);
    await renameGuest(db, id, newName);
    res.status(204).end();
  });
  router.delete('/guests/:id', async (req, res) => {
    res.json(await deleteGuest(db, parse(GuestId, req.params.id, 'guest id')));
  });
  router.post('/guests/:id/invite-link', async (req, res) => {
    const id = parse(GuestId, req.params.id, 'guest id');
    res.json(await createInviteLink(db, mail.publicUrl, id));
  });
  router.post('/guests/invite', async (req, res) => {
    const selector = parse(SendInvitesSchema, req.body);
    const { eventName } = await getSettings(db);
    res.json(await sendInvites(db, mail.mailer, mail.publicUrl, eventName, selector));
  });
  router.get('/mail-status', (_req, res) => {
    res.json({ configured: mail.mailer.configured });
  });

  return router;
}
