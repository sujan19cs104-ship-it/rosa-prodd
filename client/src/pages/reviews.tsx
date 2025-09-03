import React from 'react';
import { Button } from '@/components/ui/button';

export default function ReviewsPage() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const token = params.get('token') || '';

  const overrideUrl = (import.meta as any).env?.VITE_GOOGLE_REVIEW_URL as string | undefined;
  const placeId = (import.meta as any).env?.VITE_GOOGLE_PLACE_ID as string | undefined;
  const [serverReviewUrl, setServerReviewUrl] = React.useState<string | null>(null);
  const [configLoading, setConfigLoading] = React.useState<boolean>(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Allow passing reviewUrl via query param as immediate override
  React.useEffect(() => {
    const qpUrl = params.get('reviewUrl') || params.get('ru');
    if (qpUrl) {
      try {
        setServerReviewUrl(decodeURIComponent(qpUrl));
      } catch {
        setServerReviewUrl(qpUrl);
      }
    }
  }, []);

  // Fallback to server-provided config if client env is not set
  React.useEffect(() => {
    if (!overrideUrl && !placeId) {
      setConfigLoading(true);
      fetch('/api/reviews/config')
        .then(async (r) => {
          try {
            const j = await r.json();
            setServerReviewUrl(j?.reviewUrl || null);
          } catch {
            setServerReviewUrl(null);
          }
        })
        .catch(() => setServerReviewUrl(null))
        .finally(() => setConfigLoading(false));
    }
  }, [overrideUrl, placeId]);

  const reviewUrl = overrideUrl
    ? overrideUrl
    : placeId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
    : serverReviewUrl || undefined;

  const autoMarkSubmitted = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // If token is present, notify server that review is submitted
      if (token) {
        const note = 'Auto-confirmed after opening Google review';
        const res = await fetch('/api/reviews/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, note })
        });
        // Ignore server errors for UI flow, but surface message if helpful
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.message || 'Could not confirm on server, but marked done locally.');
        }
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReview = async () => {
    // Open Google Reviews in a new tab
    if (reviewUrl) {
      window.open(reviewUrl, '_blank');
      // After 5–10 seconds, show the submitted state (use 7s)
      setTimeout(() => {
        autoMarkSubmitted();
      }, 7000);
      return;
    }
    // Try fetching server config on-demand before giving up
    try {
      setConfigLoading(true);
      const r = await fetch('/api/reviews/config');
      const j = await r.json();
      if (j?.reviewUrl) {
        setServerReviewUrl(j.reviewUrl);
        window.open(j.reviewUrl, '_blank');
        setTimeout(() => {
          autoMarkSubmitted();
        }, 7000);
        return;
      }
    } catch {}
    finally { setConfigLoading(false); }
    alert('Review link not configured. Please contact admin.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rosae-black text-white p-6">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-800 text-center space-y-6">
        {/* Brand */}
        <div className="flex justify-center">
          <img src="/rosae-logo.jpg" alt="ROSAE" className="w-20 h-20 rounded-full object-cover shadow-md" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Share your experience</h1>
          <p className="text-sm text-gray-300">Please give 5-star rating on Google</p>
          {/* 5 stars centered */}
          <div className="flex justify-center gap-1" aria-label="5 star rating">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-yellow-400 text-xl" role="img" aria-hidden>★</span>
            ))}
          </div>
        </div>

        {/* Info */}
        {!token && (
          <div className="text-yellow-300/90 text-xs">Tip: Use the exact link shared by our staff for best tracking.</div>
        )}

        {/* Actions */}
        {!done ? (
          <div className="space-y-3">
            <Button
              onClick={handleOpenReview}
              className="w-full justify-center bg-white text-black hover:bg-gray-200"
              disabled={configLoading || submitting}
            >
              {configLoading ? 'Loading…' : submitting ? 'Please wait…' : 'Open Google Reviews'}
            </Button>
            <div className="text-xs text-gray-400">Your review will help us improve.</div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <div className="text-green-400 text-base font-medium">Review submitted</div>
            <div className="text-xs text-gray-400">Thank you! Your review has been recorded.</div>
          </div>
        )}
      </div>
    </div>
  );
}