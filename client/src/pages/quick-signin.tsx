import Layout from '@/components/layout';
import { QuickSignin } from '@/components/quick-signin';
import { useState } from 'react';

export default function QuickSigninPage() {
  const [result, setResult] = useState<any>(null);
  return (
    <Layout>
      <div className="min-h-screen bg-rosae-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-rosae-dark-gray border border-gray-700 rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-2">Quick Sign-in</h1>
          <p className="text-gray-400 mb-4 text-sm">Sign in using your phone number to view your bookings.</p>
          <QuickSignin onSuccess={setResult} />
          {result && (
            <div className="mt-6 text-sm text-gray-300">
              <div className="font-semibold mb-1">Bookings linked to your phone:</div>
              <ul className="list-disc ml-5 space-y-1">
                {(result.bookings || []).map((b: any) => (
                  <li key={b.id}>{b.bookingDate} • {b.theatreName} • {b.timeSlot} • Guests: {b.guests}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}