import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables before creating pool
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const initDatabase = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS contact (
      id SERIAL PRIMARY KEY,
      phone_number VARCHAR(20),
      email VARCHAR(255),
      linked_id INTEGER REFERENCES contact(id),
      link_precedence VARCHAR(10) NOT NULL CHECK (link_precedence IN ('primary', 'secondary')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contact_email ON contact(email) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_contact_phone ON contact(phone_number) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_contact_linked_id ON contact(linked_id) WHERE deleted_at IS NULL;
  `;
  
  await query(createTableQuery);
  console.log('Database initialized successfully');
};

export default pool;
