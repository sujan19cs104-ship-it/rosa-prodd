# Review Collection Feature

This adds customer review collection to ROSAE.

## Backend

- Endpoints:
  - POST /api/auth/quick-signin { name, phone } -> creates session for guests; returns bookings list
  - POST /api/reviews/request { bookingId } (auth required) -> creates a `reviews` row, returns { token, reviewUrl }
  - POST /api/reviews/confirm { token } -> marks review submitted and sets booking.review_flag=true; emits `review.submitted` webhook (optional)
  - POST /api/integrations/reviews-webhook -> example webhook receiver (marks booking.review_flag)

- DB
  - New table `reviews` (id, booking_id, phone, name, token, status, requested_at, submitted_at, verified_at, verification_method, gmaps_place_id, gmaps_review_id, note)
  - New column `bookings.review_flag` (boolean)
  - Migration: `server/migrations/add_reviews_and_review_flag.ts`

- Token expiry: 72 hours enforced in /api/reviews/confirm
- Simple rate limit on quick-signin (5/min per IP+phone)

### Google Places Verification (optional)
- Script: `server/jobs/verify-reviews.ts`
- Env vars:
  - GOOGLE_PLACES_API_KEY
  - GOOGLE_PLACE_ID
- Run periodically (cron): `tsx server/jobs/verify-reviews.ts`

## Frontend
- Components
  - components/quick-signin.tsx -> name & phone, calls quick-signin
  - components/review-modal.tsx -> CTA to open review URL + micro-questions + confirm button
- Integrate modal on booking detail/list page: show "Leave a Review" when `!booking.reviewFlag`.

## Webhook
- Set `REVIEWS_WEBHOOK_URL` env to a POST endpoint that accepts `{ type: 'review.submitted', data: { reviewId, bookingId } }`
- Example local receiver at `/api/integrations/reviews-webhook` already included

## Dev/Deploy Notes
- Run migration: `tsx server/migrations/add_reviews_and_review_flag.ts`
- Start server: `npm run dev`
- For prod, set env:
  - SESSION_SECRET
  - REVIEWS_WEBHOOK_URL (optional)
  - GOOGLE_PLACES_API_KEY (optional)
  - GOOGLE_PLACE_ID (optional)