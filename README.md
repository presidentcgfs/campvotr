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

### Users

- `GET /api/users/lookup-by-email?email={email}` - Find user ID by email within the current user's organization

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

### Chron setup

We expose an endpoint that takes a header 'x-cron-secret' and a shared chron secret (CRON_SECRET). To make reminders work a cron job can be set up to call this endpoint every 15 minutes or so. If you are using supabase enable
pg_net and pg_cron and setup a job to call that endpoint -- something like.

```sql
select
  net.http_post(
      url:='https://<YOUR_SERVER>/api/cron/ballots/tick',
      headers:=jsonb_build_object('x-cron-secret', '<CRON_SECRET_HERE>'),
      timeout_milliseconds:=1000
  );
```

## Development

### Prerequisites for Development

- Node.js 18+ (recommended: use nvm or fnm for version management)
- pnpm (preferred package manager)
- PostgreSQL database (local or remote)
- Supabase account for authentication
- Git for version control

### Development Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd campvotr
   pnpm install
   ```

2. **Environment setup:**

   ```bash
   cp .env.example .env
   ```

   Configure your `.env` file with development values.

3. **Database setup:**

   ```bash
   # Generate and run migrations
   pnpm run db:generate
   pnpm run db:migrate

   # Optional: View database in Drizzle Studio
   pnpm run db:studio
   ```

4. **Start development server:**
   ```bash
   pnpm run dev
   ```

### Available Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build locally
- `pnpm run check` - Run Svelte check for TypeScript errors
- `pnpm run check:watch` - Run Svelte check in watch mode
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier
- `pnpm run db:generate` - Generate database migrations from schema changes
- `pnpm run db:migrate` - Run pending database migrations
- `pnpm run db:push` - Push schema changes directly to database (dev only)
- `pnpm run db:studio` - Open Drizzle Studio for database management
- `pnpm run db:seed` - Seed database with sample data (if available)

### Project Structure

```
src/
├── lib/
│   ├── components/     # Reusable Svelte components
│   ├── server/        # Server-side utilities and database
│   ├── stores/        # Svelte stores for state management
│   └── utils/         # Shared utility functions
├── routes/
│   ├── api/          # API endpoints
│   └── (app)/        # Application routes
├── app.html          # HTML template
└── hooks.server.ts   # SvelteKit hooks
```

### Development Guidelines

#### Code Style

- Use TypeScript for all new code
- Follow the existing code formatting (Prettier configuration)
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

#### Database Changes

1. Modify schema in `src/lib/server/db/schema.ts`
2. Generate migration: `pnpm run db:generate`
3. Review the generated migration file
4. Apply migration: `pnpm run db:migrate`

#### Component Development

- Use Svelte 5 runes syntax (`$props`, `$state`, `$derived`, `$effect`)
- Prefer Flowbite-Svelte components over custom UI elements
- Use Tailwind CSS for styling
- Keep components focused and reusable
- Use TypeScript for prop definitions

#### API Development

- Follow RESTful conventions
- Use proper HTTP status codes
- Implement proper error handling
- Add input validation using Zod schemas
- Use dependency injection pattern with services

### Testing

Currently, the project uses manual testing. To contribute to testing:

1. **Manual Testing Checklist:**
   - User registration and authentication
   - Ballot creation and voting
   - Real-time updates
   - Notification system
   - Mobile responsiveness

2. **Future Testing Plans:**
   - Unit tests with Vitest
   - Integration tests for API endpoints
   - E2E tests with Playwright

### Debugging

#### Development Tools

- Use browser DevTools for frontend debugging
- Check SvelteKit logs in terminal for server-side issues
- Use Drizzle Studio to inspect database state
- Monitor network requests for API debugging

#### Common Issues

- **Database connection errors**: Check `DATABASE_URL` in `.env`
- **Authentication issues**: Verify Supabase configuration
- **Build errors**: Run `pnpm run check` for TypeScript issues
- **Migration errors**: Ensure database is accessible and migrations are in correct order

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes following the development guidelines
4. Test your changes thoroughly
5. Commit with descriptive messages
6. Push to your fork and create a pull request

### Performance Considerations

- Use `$derived` for computed values instead of reactive statements
- Implement proper loading states for async operations
- Optimize database queries with appropriate indexes
- Use Server-Sent Events efficiently for real-time updates
- Consider pagination for large data sets

## License
