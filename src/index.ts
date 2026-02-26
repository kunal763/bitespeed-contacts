import express from 'express';
import dotenv from 'dotenv';
import { initDatabase } from './db';
import identifyRoutes from './routes/identifyRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/', identifyRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const startServer = async () => {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
