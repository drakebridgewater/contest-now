import {
  AwardInputSchema,
  CategoryInputSchema,
  CriterionInputSchema,
  RenameVoterSchema,
  SettingsInputSchema,
  VoterName,
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
  updateAward,
  updateCategory,
  updateCriterion,
  updateSettings,
} from '../../services/contest.ts';
import { deleteEntry, type PhotoStorage } from '../../services/entries.ts';
import { computeResults } from '../../services/results.ts';
import { deleteVoter, listVoters, renameVoter } from '../../services/votes.ts';
import { parse } from '../errors.ts';

const IntId = z.coerce.number().int().positive();
const SlugParam = z.string().min(1).max(40);

/** Everything under /api/admin. The password check is applied by the caller. */
export function adminRoutes(db: Db, storage: PhotoStorage): Router {
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

  // voters
  router.get('/voters', async (_req, res) => {
    res.json(await listVoters(db));
  });
  router.put('/voters/:voterName', async (req, res) => {
    const voterName = parse(VoterName, req.params.voterName, 'voter name');
    const { newName } = parse(RenameVoterSchema, req.body);
    res.json(await renameVoter(db, voterName, newName));
  });
  router.delete('/voters/:voterName', async (req, res) => {
    const voterName = parse(VoterName, req.params.voterName, 'voter name');
    res.json(await deleteVoter(db, voterName));
  });

  return router;
}
