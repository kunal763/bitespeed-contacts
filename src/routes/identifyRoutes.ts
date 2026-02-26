import { Router, Request, Response } from 'express';
import { IdentityService } from '../services/identityService';

const router = Router();
const identityService = new IdentityService();

router.post('/identify', async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body;
    
    const result = await identityService.identify({ email, phoneNumber });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /identify:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
