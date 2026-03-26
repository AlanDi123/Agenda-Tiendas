import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { getFamilySnapshotByCode, saveFamilySnapshot } from '../services/familySnapshotService';
import { createError } from '../middleware/errorHandler';

const router = Router();

const syncSchema = z.object({
  familyCode: z.string().min(4).max(16),
  environment: z.any(),
  events: z.array(z.any()),
});

router.post('/sync', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.id || !user.email) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    const parsed = syncSchema.parse(req.body);

    await saveFamilySnapshot({
      ownerId: user.id,
      ownerEmail: user.email,
      familyCode: parsed.familyCode,
      payload: {
        environment: parsed.environment,
        events: parsed.events,
        syncedAt: new Date().toISOString(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/by-code/:familyCode', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const familyCode = req.params.familyCode;
    const snapshot = await getFamilySnapshotByCode(familyCode);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    next(error);
  }
});

export { router as familyRoutes };

