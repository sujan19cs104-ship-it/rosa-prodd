import { getGoogleClients } from '../google';
import { storage } from '../storage';
import { randomUUID } from 'crypto';

// Map a Google Calendar event to booking fields. Adjust mapping as needed.
function eventToBooking(ev: any) {
  const startIso: string = ev.start?.dateTime || (ev.start?.date ? ev.start.date + 'T00:00:00' : '');
  const endIso: string = ev.end?.dateTime || (ev.end?.date ? ev.end.date + 'T23:59:59' : '');
  if (!startIso || !endIso) return null;

  // Combine summary + description for robust parsing
  const summary: string = String(ev.summary || '').trim();
  const description: string = String(ev.description || '').trim();
  const combined = [summary, description].filter(Boolean).join('\n');
  const lines = combined.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);

  // Defaults
  let theatreName = 'Screen-1';
  let guests = 2;
  let customerName = 'Walk-in';
  let phoneNumber: string | undefined;
  let paidAmount: number | undefined;
  let pendingAmount: number | undefined;

  // Theatre: "top word is the theatre name"
  if (lines.length) {
    const first = lines[0];
    // Take first token up to a space/colon (e.g., "COSMOS" from "COSMOS Booking:")
    theatreName = first.split(/\s|:/)[0]?.trim() || theatreName;
  }

  // Customer name: take text before the word 'Paid' on the same or preceding lines.
  // Prefer a line with 'Booking: <Name>', else deduce from lines before 'Paid'.
  const bookingLine = lines.find((l) => /\bBooking\s*:/i.test(l)) || '';
  const mName = bookingLine.match(/\bBooking\s*:\s*([^,;|]+)/i);
  if (mName && mName[1]) {
    customerName = mName[1].trim();
  } else {
    const paidIdx = lines.findIndex(l => /\bPaid\b/i.test(l));
    if (paidIdx > 0) {
      // Join preceding non-empty lines until a blank or theatre header
      const candidates = lines.slice(Math.max(0, paidIdx - 2), paidIdx);
      const nameLine = candidates.reverse().find(l => l && !/\bPaid\b|\bBooking\b|\bCOSMOS\b|\bCINEPOD\b/i.test(l));
      if (nameLine) {
        // Remove trailing words like 'Booking:' if present and anything after parentheses
        customerName = nameLine.replace(/\bBooking\s*:\s*/i, '').replace(/\(.+\)$/, '').trim();
      }
    }
  }

  // Guests (if present like "5 guests")
  const guestsLine = lines.find((l) => /\bguest/i.test(l)) || combined;
  const mGuests = guestsLine.match(/(\d+)\s*guests?/i);
  if (mGuests) guests = parseInt(mGuests[1], 10);

  // Phone: look for 10-digit number
  const phoneMatch = combined.replace(/[^0-9]/g, ' ').match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
  if (phoneMatch) phoneNumber = phoneMatch[1];

  // Payments parsing:
  // - If 'Paid: <amount> cash' => cashAmount = amount
  // - If 'Paid: <amount>' without 'cash' => upiAmount = amount (your rule)
  // - 'pending : <amount>' contributes to total
  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, ''));

  let cashAmountParsed = 0;
  let upiAmountParsed = 0;

  // Find "Paid: ..." line and classify
  const paidLine = (lines.find(l => /\bPaid\s*:/i.test(l)) || combined).match(/\bPaid\s*:\s*([^\n]+)/i);
  if (paidLine) {
    const paidStr = paidLine[1];
    const amountMatch = paidStr.match(/([0-9][0-9,\.]*)/);
    if (amountMatch) {
      const amt = num(amountMatch[1]);
      if (/\bcash\b/i.test(paidStr)) {
        cashAmountParsed = amt;
      } else {
        upiAmountParsed = amt;
      }
    }
  }

  const mPending = combined.match(/\bpending\s*[:=]?\s*([0-9][0-9,\.]*)/i);
  if (mPending) pendingAmount = num(mPending[1]);

  const totalAmount = (cashAmountParsed + upiAmountParsed) + (pendingAmount ?? 0);
  const cashAmount = cashAmountParsed;
  const upiAmount = upiAmountParsed;

  // Fallback: support the old "A - 5 guests - Name (Phone)" format
  if (!bookingLine && summary.includes(' - ')) {
    try {
      const parts = summary.split(' - ').map((s: string) => s.trim());
      if (parts[0]) theatreName = parts[0];
      if (parts[1] && /\d+/.test(parts[1])) guests = parseInt(parts[1].match(/\d+/)![0], 10);
      if (parts[2]) {
        customerName = parts[2].replace(/\((.*?)\)/, (_m, p1) => { phoneNumber = phoneNumber || p1; return ''.trim(); }).trim();
      }
    } catch {}
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const bookingDate = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
  const timeSlot = `${pad(start.getHours())}:${pad(start.getMinutes())}-${pad(end.getHours())}:${pad(end.getMinutes())}`;

  return {
    id: randomUUID(),
    theatreName,
    timeSlot,
    guests,
    customerName,
    phoneNumber,
    totalAmount: totalAmount || 0,
    cashAmount: cashAmount || 0,
    upiAmount: upiAmount || 0,
    snacksAmount: 0,
    snacksCash: 0,
    snacksUpi: 0,
    bookingDate,
    isEighteenPlus: true,
    visited: true,
    repeatCount: 0,
    createdBy: null,
  };
}

export async function syncGoogleCalendarToBookings(options?: { calendarId?: string; timeMin?: string; timeMax?: string }) {
  // Respect integration toggle
  try {
    const { integrationSettings } = await storage.getConfig();
    if (integrationSettings && integrationSettings.calendarSyncEnabled === false) {
      return { scanned: 0, created: 0, disabled: true } as any;
    }
  } catch {}

  const { calendar } = await getGoogleClients();
  const calendarId = options?.calendarId || 'primary';

  // Default window: from config syncWindowDays
  const now = new Date();
  let timeMin = options?.timeMin || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  let timeMax = options?.timeMax;
  if (!timeMax) {
    let days = 30;
    try { const { integrationSettings } = await storage.getConfig(); days = integrationSettings?.syncWindowDays || 30; } catch {}
    timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days).toISOString();
  }

  const eventsRes = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = eventsRes.data.items || [];
  let created = 0;
  for (const ev of events) {
    const booking = eventToBooking(ev);
    if (!booking) continue;

    // Deduplicate by phone + date + slot if possible
    if (booking.phoneNumber) {
      const exists = await storage.getBookingByPhoneDateAndSlot(booking.phoneNumber, booking.bookingDate, booking.timeSlot);
      if (exists) continue;
    }

    await storage.createBooking(booking);
    created++;
  }
  return { scanned: events.length, created };
}

// ESM-compatible main check
import { fileURLToPath } from 'url';
import path from 'path';

const thisFile = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFile);

if (isMain) {
  syncGoogleCalendarToBookings().then((r) => {
    console.log('sync result', r);
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}