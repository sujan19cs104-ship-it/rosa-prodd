import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function QuickSignin({ onSuccess }: { onSuccess?: (data: any) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      setError('Enter a valid phone');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/quick-signin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      onSuccess?.(data);
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="space-y-1">
        <Label htmlFor="qs_name">Name</Label>
        <Input id="qs_name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="qs_phone">Phone</Label>
        <Input id="qs_phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
      </div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? 'Signing in…' : 'Quick Sign-in'}</Button>
    </form>
  );
}