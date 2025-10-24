# Provider Portal

A white-labeled provider portal for call center management built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- **White-labeled Design**: Displays provider logo and name automatically
- **Session-based Authentication**: Secure authentication using Airtable user records
- **Provider-specific Data**: All data is filtered by provider ID
- **Clean Modern UI**: Minimalist design with Lucide React icons
- **Responsive Layout**: Works on desktop, tablet, and mobile devices

## Dashboard Sections

- **Dashboard Home**: Overview with quick access cards
- **Employees**: View employees linked to the provider
- **Patients**: View patients linked to the provider
- **Job Templates**: View job templates for the provider
- **Occurrences**: View scheduled job occurrences
- **Call Logs**: View call history
- **Reports**: View and download generated reports

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Authentication**: iron-session (encrypted cookies)
- **Database**: Airtable
- **Session Management**: Cookie-based with 7-day expiration

## Environment Variables

Create a `.env.local` file in the root directory with:

```bash
# Airtable Configuration
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id

# User Table ID
USER_TABLE_ID=tblLiBIYIt9jDwQGT

# Session Configuration (min 32 characters)
SESSION_SECRET=your_session_secret_key_min_32_chars

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see above)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Authentication

The portal uses custom Airtable authentication:

- **User Table**: `tblLiBIYIt9jDwQGT`
- **Login Fields**: `Email` and `Pass`
- **Provider Linking**: Users are linked to providers via the `Provider` field
- **Session Duration**: 7 days

## Data Filtering

All data is automatically filtered by the logged-in user's provider ID using Airtable formulas:
- `FIND('{providerId}', ARRAYJOIN({Provider}))`

## White-Label Configuration

The portal automatically displays:
- Provider name from the `Name` field in the Providers table
- Provider logo from the `Logo` field (attachment field in Airtable)

If no logo is present, it displays the provider name as text.

## Project Structure

```
provider-portal/
├── app/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   └── provider/      # Provider data endpoints
│   ├── dashboard/         # Dashboard pages
│   │   ├── employees/
│   │   ├── patients/
│   │   ├── job-templates/
│   │   ├── occurrences/
│   │   ├── call-logs/
│   │   ├── reports/
│   │   ├── layout.tsx     # Dashboard layout with sidebar
│   │   └── page.tsx       # Dashboard home
│   ├── login/             # Login page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Root redirect to dashboard
├── components/
│   ├── DataTable.tsx      # Reusable data table
│   └── Sidebar.tsx        # Navigation sidebar
├── lib/
│   ├── airtable.ts        # Airtable client
│   ├── auth.ts            # Authentication utilities
│   └── session.ts         # Session configuration
├── middleware.ts          # Route protection middleware
└── next.config.ts         # Next.js configuration
```

## Development

The portal uses Next.js 15's App Router with:
- Server Components for optimal performance
- Client Components for interactive features
- API Routes for backend functionality
- Middleware for route protection

## Security

- Passwords are compared in plain text (as per Airtable storage)
- Sessions are encrypted using iron-session
- All dashboard routes are protected by middleware
- Session cookies are HTTP-only and secure in production

## Production Deployment

Before deploying to production:

1. Update `SESSION_SECRET` to a strong random string (min 32 characters)
2. Update `NEXT_PUBLIC_APP_URL` to your production URL
3. Ensure Airtable credentials are properly set
4. Build the application: `npm run build`
5. Start production server: `npm start`

## License

Proprietary - Call Center Management System
