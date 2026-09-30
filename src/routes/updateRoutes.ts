import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../auth/singleUserAuth';
import { getUpdateStatus } from '../services/updateService';

export const updateRouter = Router();

updateRouter.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status = await getUpdateStatus(req.query.refresh === '1');
    res.json(status);
  } catch (error: any) {
    res.status(503).json({ error: `Vérification des mises à jour impossible : ${error.message}` });
  }
});
