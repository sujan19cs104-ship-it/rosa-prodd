import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function ReviewModal({ open, onOpenChange, booking, onConfirmed }: { open: boolean; onOpenChange: (v: boolean) => void; booking: any; onConfirmed?: () => void; }) {
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLeaveReview = async () => {
    try {
      const res = await fetch('/api/reviews/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create review link');
      window.open(data.reviewUrl, '_blank');
    } catch (e) {
      alert((e as any).message || 'Failed to create review link');
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      // Use token from URL if they came back, else we request fresh token then confirm
      let token = new URLSearchParams(window.location.search).get('token');
      if (!token) {
        const res = await fetch('/api/reviews/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create review link');
        token = data.token;
      }
      const res2 = await fetch('/api/reviews/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.message || 'Failed to confirm');
      onConfirmed?.();
      onOpenChange(false);
    } catch (e) {
      alert((e as any).message || 'Failed to confirm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
          <DialogDescription>We appreciate your feedback! Please leave a Google review in the new tab, then come back and confirm.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">What did you like most?</div>
            <Textarea value={q1} onChange={e => setQ1(e.target.value)} placeholder="e.g., ambience, staff, sound quality" />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Any suggestions?</div>
            <Textarea value={q2} onChange={e => setQ2(e.target.value)} placeholder="How could we improve?" />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Would you recommend us?</div>
            <Textarea value={q3} onChange={e => setQ3(e.target.value)} placeholder="Tell us why" />
          </div>
          <div className="flex gap-2 justify-between">
            <Button variant="secondary" onClick={handleLeaveReview}>Open Google Review</Button>
            <Button onClick={handleConfirm} disabled={submitting}>{submitting ? 'Confirming…' : 'I have left the review'}</Button>
          </div>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}