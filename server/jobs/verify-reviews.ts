import fetch from 'node-fetch';
import { db } from '../db';
import { reviews } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

// Simple text similarity: Jaccard over word sets
function similarity(a: string, b: string) {
  const A = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const inter = new Set([...A].filter(x => B.has(x))).size;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
}

export async function verifyReviewsFromGoogle() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) {
    console.warn('Missing GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID');
    return { verified: 0 };
  }

  // Fetch Google reviews
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=review&key=${apiKey}`;
  const resp = await fetch(url);
  const json = await resp.json();
  const gReviews: any[] = json?.result?.reviews || [];

  // Get pending/submitted reviews
  const pending = await db.query.reviews.findMany({});

  let verified = 0;
  for (const r of pending as any[]) {
    if (!r.name && !r.phone) continue;
    const candidates = gReviews.filter(gr => {
      const author = gr.author_name || '';
      const text = gr.text || '';
      // Match by author name contains customer name or phone in text, with some similarity
      const byName = r.name && author.toLowerCase().includes(String(r.name).toLowerCase());
      const byPhone = r.phone && text.includes(String(r.phone));
      return byName || byPhone;
    });
    let best: any = null, bestScore = 0;
    for (const c of candidates) {
      const s = similarity((r.note || '') + ' ' + (r.name || ''), (c.text || '') + ' ' + (c.author_name || ''));
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (best && bestScore >= 0.2) { // conservative threshold
      await db.update(reviews)
        .set({ status: 'verified', verificationMethod: 'gmaps', verifiedAt: new Date().toISOString(), gmapsPlaceId: placeId, gmapsReviewId: String(best.time || '') })
        .where(eq(reviews.id, r.id));
      verified++;
    }
  }

  return { verified };
}

if (require.main === module) {
  verifyReviewsFromGoogle().then((r) => {
    console.log('verifyReviews result', r);
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}