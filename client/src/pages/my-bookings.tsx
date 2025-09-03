import Layout from '@/components/layout';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function MyBookingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/bookings?page=1&pageSize=100', { credentials: 'include' });
        if (!res.ok) throw new Error('Please sign in first');
        const json = await res.json();
        if (isMounted) setData(json);
      } catch (e: any) {
        if (isMounted) setError(e.message || 'Failed to load');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-rosae-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">My Bookings</h1>
          <p className="text-gray-400 mb-6 text-sm">Showing bookings linked to your current session.</p>

          {loading && <div>Loading…</div>}
          {error && (
            <div className="text-red-400 mb-4 text-sm">{error} <a href="/quick-signin" className="underline text-blue-400">Quick Sign-in</a></div>
          )}

          {data?.bookings?.length ? (
            <div className="space-y-3">
              {data.bookings.map((b: any) => (
                <div key={b.id} className="border border-gray-700 rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{b.bookingDate} • {b.theatreName} • {b.timeSlot}</div>
                    <div className="text-sm text-gray-400">Guests: {b.guests} • Phone: {b.phoneNumber || 'N/A'}</div>
                  </div>
                  <div className="text-sm">
                    {b.reviewFlag ? (
                      <span className="text-green-400">Reviewed</span>
                    ) : (
                      <a href={`/bookings`} className="text-blue-400 underline">Leave a review</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (!loading && !error) ? (
            <div className="text-gray-400">No bookings found.</div>
          ) : null}

          <div className="mt-6">
            <Button asChild>
              <a href="/quick-signin">Sign in with another phone</a>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}