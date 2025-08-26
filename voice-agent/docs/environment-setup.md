# Environment Setup - Phase 2

## Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here

# Redis Configuration (Upstash)
REDIS_URL=your_upstash_redis_url_here
REDIS_TOKEN=your_upstash_redis_token_here
STATE_TTL_SECONDS=3600

# Application Configuration
NODE_ENV=development
```

## Upstash Redis Setup

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the `UPSTASH_REDIS_REST_URL` as `REDIS_URL`
4. Copy the `UPSTASH_REDIS_REST_TOKEN` as `REDIS_TOKEN`

## Vercel Deployment

Add the same environment variables to your Vercel project:

```bash
npx vercel env add REDIS_URL
npx vercel env add REDIS_TOKEN
npx vercel env add STATE_TTL_SECONDS
```

## State TTL Configuration

- `STATE_TTL_SECONDS=3600` (1 hour) - Default call state expiration
- Adjust based on your typical call duration needs
- Shorter TTL = less Redis storage cost
- Longer TTL = more resilient to network issues
