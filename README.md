# Bitespeed Identity Reconciliation Service

A web service that identifies and tracks customer identity across multiple purchases by linking contact information (email and phone numbers).

## Features

- Links customer contacts based on shared email or phone number
- Maintains primary and secondary contact relationships
- Automatically merges separate contact chains when they're discovered to be the same person
- RESTful API with `/identify` endpoint

## Tech Stack

- Node.js with TypeScript
- Express.js
- PostgreSQL
- Deployed on Render.com

## API Endpoint

### POST /identify

Identifies and consolidates customer contact information.

**Request Body:**
```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123456", "789012"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Local Development

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database

### Setup

1. Clone the repository:
```bash
git clone https://github.com/kunal763/bitespeed-contacts.git
cd bitespeed-contacts
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your database credentials:
```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/bitespeed
```

4. Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Production Build

```bash
npm run build
npm start
```

## Testing the API

### Example 1: New Contact
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"lorraine@hillvalley.edu","phoneNumber":"123456"}'
```

### Example 2: Linking Contacts
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"mcfly@hillvalley.edu","phoneNumber":"123456"}'
```

### Example 3: Merging Primary Contacts
```bash
# First create two separate primaries
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"george@hillvalley.edu","phoneNumber":"919191"}'

curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"biffsucks@hillvalley.edu","phoneNumber":"717171"}'

# Then link them
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"george@hillvalley.edu","phoneNumber":"717171"}'
```

## Database Schema

```sql
CREATE TABLE contact (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  linked_id INTEGER REFERENCES contact(id),
  link_precedence VARCHAR(10) CHECK (link_precedence IN ('primary', 'secondary')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

## Algorithm Overview

1. **No Match**: Create new primary contact
2. **Single Match**: Check if new info exists; create secondary if needed
3. **Multiple Primaries**: Merge by making older one primary, others secondary
4. **Response**: Consolidate all linked contacts under oldest primary


