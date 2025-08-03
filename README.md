# CampVotr - Democratic Voting Platform

A transparent, full-stack voting application built with SvelteKit, TypeScript, and Supabase.

## Features

- 🗳️ **Democratic Voting**: Create voting ballots with configurable time periods
- 📊 **Real-time Results**: Live vote count updates using Server-Sent Events
- 🔍 **Full Transparency**: Complete voting history with timestamps
- 🔔 **Smart Notifications**: Automated notifications for new ballots and voting reminders
- 🔐 **Secure Authentication**: Supabase Auth integration with JWT tokens
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: SvelteKit with TypeScript
- **Backend**: SvelteKit API routes
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **Styling**: Custom CSS with responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase account

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd campvotr
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

- `DATABASE_URL`: Your PostgreSQL connection string
- `PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

4. Set up the database:

```bash
# Generate migration files
npm run db:generate

# Run migrations
npm run db:migrate

# Optional: Open Drizzle Studio to view your database
npm run db:studio
```

5. Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173` to see the application.

## Database Schema

The application uses three main tables:

- **ballots**: Voting proposals with title, description, and voting periods
- **votes**: Individual votes cast by users (yea/nay/abstain)
- **notifications**: System notifications for users

## API Endpoints

### Authentication

- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout

### ballots

- `GET /api/ballots` - List all ballots with vote counts
- `POST /api/ballots` - Create a new ballot
- `GET /api/ballots/[id]` - Get specific ballot details
- `POST /api/ballots/[id]/vote` - Cast or update a vote
- `GET /api/ballots/[id]/stream` - Real-time vote updates (SSE)

### Notifications

- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/[id]/read` - Mark notification as read

### System

- `POST /api/cron/update-ballots` - Background job for status updates

## Deployment

### Vercel Deployment

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

3. Deploy:

```bash
vercel --prod
```

### Database Setup for Production

1. Set up a PostgreSQL database (recommended: Supabase, Railway, or PlanetScale)
2. Run migrations in production:

```bash
npm run db:migrate
```

### Supabase Configuration

1. Create a new Supabase project
2. Enable Authentication in the Supabase dashboard
3. Configure authentication providers as needed
4. Copy your project URL and keys to environment variables

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio

## License

MIT License - see LICENSE file for details.
