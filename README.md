# HanGo API - Node.js + Hono + PostgreSQL

Backend API for HanGo Korean learning app.

## Tech Stack

- **Framework**: Hono (fast, lightweight web framework)
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Language**: TypeScript
- **Deployment**: Railway

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `OPENAI_API_KEY`: OpenAI API key for AI chat features
- `PORT`: Server port (default: 8787)

### 3. Database setup

Run the schema on your PostgreSQL database:

```bash
psql $DATABASE_URL < schema.sql
```

Or copy the contents of `schema.sql` and run it in your database client.

### 4. Run development server

```bash
npm run dev
```

Server will start on `http://localhost:8787`

## Deployment to Railway

### 1. Create Railway project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 2. Add PostgreSQL

In Railway dashboard:
1. Click "New" → "Database" → "PostgreSQL"
2. Wait for provisioning
3. Copy the `DATABASE_URL` from the database service

### 3. Set environment variables

```bash
railway variables set JWT_SECRET=your-secret-key
railway variables set OPENAI_API_KEY=sk-your-key
```

### 4. Deploy

```bash
# Link to Railway project
railway link

# Deploy
railway up
```

### 5. Run database migration

After first deployment:

```bash
# Connect to Railway shell
railway run

# Run schema
psql $DATABASE_URL < schema.sql
```

Or use Railway's database query interface to run `schema.sql`.

### 6. Get deployment URL

```bash
railway domain
```

Your API will be available at the provided URL.

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user

### Vocabulary
- `GET /vocabulary/session` - Get learning session (10 words)
- `POST /vocabulary/answer` - Submit answer
- `GET /vocabulary/progress` - Get user progress
- `GET /vocabulary/search?q=...` - Search vocabulary
- `GET /vocabulary/all` - Get all vocabulary

### AI Chat
- `POST /ai/chat` - Send message to AI friend
- `GET /ai/friends` - Get available AI friends
- `POST /ai/translate` - Translate text to Korean

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server

## Project Structure

```
src/
├── db.ts              # PostgreSQL connection pool
├── index.ts           # Hono app setup and routes
├── server.ts          # Node.js server entry point
├── types/
│   └── index.ts       # TypeScript type definitions
├── utils/
│   ├── jwt.ts         # JWT utilities
│   └── password.ts    # Password hashing
└── routes/
    ├── auth.ts        # Authentication routes
    ├── vocabulary.ts  # Vocabulary routes
    └── ai-chat.ts     # AI chat routes
```

## Development Notes

- Uses ESM modules (`type: "module"` in package.json)
- All imports must include `.js` extension
- TypeScript compiles to JavaScript in `dist/` folder
- PostgreSQL uses `$1, $2, ...` placeholder syntax
- Railway automatically sets `DATABASE_URL` for PostgreSQL service

## Migration from Cloudflare Workers

This backend was migrated from Cloudflare Workers to Railway:

**Changes:**
- D1 (SQLite) → PostgreSQL
- Cloudflare Workers bindings → Environment variables
- `?` placeholders → `$1, $2, ...` placeholders
- `datetime('now')` → `NOW()`
- Added Node.js server entry point

**Benefits:**
- No OpenAI region restrictions
- More mature PostgreSQL features
- Easier local development
- Better TypeScript support
