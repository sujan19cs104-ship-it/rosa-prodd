import { sql, eq, desc, and, like, gte, lte, inArray, asc } from "drizzle-orm";
import { InsertLeadInfo, insertLeadInfoSchema, InsertRevenueGoal, insertRevenueGoalSchema } from "@shared/schema";
import { db, execRaw } from "./db";
import { 
  users, bookings, expenses, leaveApplications, activityLogs, 
  calendarEvents, salesReports, configurations, adSpends, dailyIncome, customerTickets, loginTracker,
  leaveTypes, leaveBalances, notifications, feedbacks, followUps, refundRequests, leadInfos, revenueGoals, reviews, sessions
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

function toCSV(rows: any[], headers: string[], mapper: (r: any) => string[]): string {
  const header = headers.join(",") + "\n";
  const body = rows.map(r => mapper(r).map(v => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(",")).join("\n");
  return header + body;
}

// Create a storage interface for database operations
export const storage = {
  // User operations
  async findUserByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email),
    });
  },
  
  async getUserByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email),
    });
  },
  
  async getUser(id: string) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },
  
  async listUsers(params: { page?: number; pageSize?: number; email?: string; role?: string; active?: boolean }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const filters: any[] = [];
    if (params.email) filters.push(like(users.email, `%${params.email}%`));
    if (params.role) filters.push(eq(users.role, params.role));
    if (typeof params.active === 'boolean') filters.push(eq(users.active as any, params.active));
    const whereClause = filters.length ? and(...filters) : undefined;
    const rows = await db.query.users.findMany({ where: whereClause, orderBy: [asc(users.firstName)], limit: pageSize, offset });
    const count = await db.select({ count: sql`COUNT(*)` }).from(users).where(whereClause);
    const total = Number(count?.[0]?.count || 0);
    return { rows, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  },

  async createUser(userData: { email: string; password: string; firstName: string; lastName: string; role?: string }) {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const user = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      passwordHash,
      role: userData.role || 'employee',
      active: true,
    };
    const result = await db.insert(users).values(user).returning();
    return result[0];
  },
  
  async upsertUser(userData: any) {
    // Check if user exists
    const existingUser = await this.getUser(userData.id);
    
    if (existingUser) {
      // Update existing user
      const result = await db.update(users)
        .set(userData)
        .where(eq(users.id, userData.id))
        .returning();
      return result[0];
    } else {
      // Create new user
      const result = await db.insert(users).values(userData).returning();
      return result[0];
    }
  },

  async updateUser(userId: string, update: Partial<{ email: string; firstName: string; lastName: string; role: string; active: boolean }>) {
    const res = await db.update(users)
      .set({ ...update, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(users.id, userId))
      .returning();
    return res[0];
  },

  async updateUserRole(userId: string, role: string) {
    const result = await db.update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  },

  async deactivateUser(userId: string) {
    await db.update(users)
      .set({ active: false, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(users.id, userId));
  },

  // List all users (used by webhook and admin pages)
  async getAllUsers() {
    return db.query.users.findMany({ orderBy: [asc(users.firstName)] });
  },
  
  // Booking operations
  async createBooking(bookingData: any) {
    const result = await db.insert(bookings).values(bookingData).returning();
    return result[0];
  },

  // Refund workflow
  async createRefundRequest({ bookingId, amount, reason, requestedBy }: { bookingId: string; amount: number; reason: string; requestedBy: string; }) {
    // Create request
    const reqRow = (await db.insert(refundRequests).values({ bookingId, amount, reason, status: 'pending', requestedBy }).returning())[0];
    // Update booking to pending
    await db.update(bookings)
      .set({ refundStatus: 'pending', refundAmount: amount, refundReason: reason, refundRequestedBy: requestedBy, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(bookings.id, bookingId));
    return reqRow;
  },

  async listRefundRequests({ status }: { status?: 'pending' | 'approved' | 'rejected' } = {}) {
    if (status) {
      return db.query.refundRequests.findMany({ where: eq(refundRequests.status as any, status) as any, orderBy: [desc(refundRequests.createdAt)] });
    }
    return db.query.refundRequests.findMany({ orderBy: [desc(refundRequests.createdAt)] });
  },

  async approveRefundRequest(id: string, approverId: string) {
    const reqRow = await db.query.refundRequests.findFirst({ where: eq(refundRequests.id, id) });
    if (!reqRow) return null;
    // Mark request approved
    const updatedReq = (await db.update(refundRequests)
      .set({ status: 'approved', approvedBy: approverId, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(refundRequests.id, id))
      .returning())[0];
    // Update booking
    await db.update(bookings)
      .set({ refundStatus: 'approved', refundAmount: (reqRow as any).amount, refundReason: (reqRow as any).reason, refundedAt: new Date().toISOString(), refundApprovedBy: approverId, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(bookings.id, (reqRow as any).bookingId));
    return updatedReq;
  },

  async rejectRefundRequest(id: string, approverId: string) {
    const reqRow = await db.query.refundRequests.findFirst({ where: eq(refundRequests.id, id) });
    if (!reqRow) return null;
    const updatedReq = (await db.update(refundRequests)
      .set({ status: 'rejected', approvedBy: approverId, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(refundRequests.id, id))
      .returning())[0];
    // Reset booking refund fields except reason (keep)
    await db.update(bookings)
      .set({ refundStatus: 'rejected', refundAmount: 0, refundedAt: null as any, refundApprovedBy: approverId, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(bookings.id, (reqRow as any).bookingId));
    return updatedReq;
  },

  async getBookingsByPhoneNumber(phoneNumber: string) {
    // Support partial matches by using LIKE and also try exact match prioritization
    const pattern = `%${phoneNumber}%`;
    return db.query.bookings.findMany({
      where: like(bookings.phoneNumber, pattern),
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
    });
  },

  async getBookingById(bookingId: string) {
    return db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
  },

  // Reviews operations
  async createReviewRequest({ bookingId, name, phone }: { bookingId: string; name?: string; phone?: string; }) {
    const token = randomUUID();
    const row = (await db.insert(reviews).values({ bookingId, name, phone, token, status: 'pending' }).returning())[0];
    return row;
  },

  // Follow-ups operations
  async listFollowUps(params: { type?: string; status?: string } = {}) {
    const parts: any[] = [];
    if (params.type) parts.push(eq(followUps.type as any, params.type as any));
    if (params.status) parts.push(eq(followUps.status as any, params.status as any));
    const whereClause = parts.length ? and(...parts) : undefined;
    return db.query.followUps.findMany({ where: whereClause, orderBy: [desc(followUps.createdAt as any)] });
  },

  async createFollowUp(data: { bookingId?: string | null; customerName: string; phoneNumber: string; followUpDate: string; note: string; category?: string; type?: string; createdBy?: string }) {
    const resolvedType = (data.type || data.category || 'feedback') as any; // prefer explicit type, default to 'feedback'
    const row = (await db.insert(followUps).values({
      bookingId: data.bookingId || null,
      customerName: data.customerName,
      phoneNumber: data.phoneNumber,
      reason: data.note,
      type: resolvedType,
      status: 'pending' as any,
      dueAt: data.followUpDate,
      createdBy: data.createdBy || null,
    }).returning())[0];
    return row;
  },

  async markFollowUpCompleted(id: string) {
    const row = (await db.update(followUps)
      .set({ status: 'completed' as any, completedAt: new Date().toISOString(), updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(followUps.id, id))
      .returning())[0];
    return row;
  },

  async cancelFollowUp(id: string) {
    const row = (await db.update(followUps)
      .set({ status: 'cancelled' as any, updatedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(followUps.id, id))
      .returning())[0];
    return row;
  },

  async deleteFollowUp(id: string) {
    await db.delete(followUps).where(eq(followUps.id, id));
    return { ok: true };
  },

  async getReviewByToken(token: string) {
    // Tolerant lookup: trim, strip quotes, try exact, then case-insensitive
    const raw = String(token || "");
    const cleaned = raw.trim().replace(/^['\"]|['\"]$/g, '');
    const exact = await db.query.reviews.findFirst({ where: eq(reviews.token, cleaned) });
    if (exact) return exact;
    const lower = cleaned.toLowerCase();
    const row = await db.query.reviews.findFirst({
      where: sql`lower(${reviews.token}) = ${lower}` as any,
    });
    return row || null;
  },

  async markReviewSubmitted(token: string, extras?: { note?: string }) {
    const now = new Date().toISOString();
    const update: any = { status: 'submitted', submittedAt: now };
    if (extras?.note) update.note = extras.note;
    const res = await db.update(reviews)
      .set(update)
      .where(eq(reviews.token, token))
      .returning();
    return res[0];
  },

  async verifyReviewByGmaps({ id, method, gmapsPlaceId, gmapsReviewId }: { id: string; method: 'gmaps'; gmapsPlaceId: string; gmapsReviewId: string; }) {
    const now = new Date().toISOString();
    const res = await db.update(reviews)
      .set({ status: 'verified', verifiedAt: now, verificationMethod: method, gmapsPlaceId, gmapsReviewId })
      .where(eq(reviews.id, id))
      .returning();
    return res[0];
  },

  async listReviewsByBooking(bookingId: string) {
    return db.query.reviews.findMany({ where: eq(reviews.bookingId, bookingId), orderBy: [desc(reviews.requestedAt as any)] });
  },

  // Admin: clear all data except users and configurations
  async clearAllDataExceptUsersAndConfig() {
    // Disable FK checks to ensure deletions succeed in any order
    execRaw("PRAGMA foreign_keys = OFF;");

    const targets: { name: string; sql: string }[] = [
      { name: 'reviews', sql: 'DELETE FROM reviews;' },
      { name: 'refund_requests', sql: 'DELETE FROM refund_requests;' },
      { name: 'customer_tickets', sql: 'DELETE FROM customer_tickets;' },
      { name: 'feedbacks', sql: 'DELETE FROM feedbacks;' },
      { name: 'follow_ups', sql: 'DELETE FROM follow_ups;' },
      { name: 'calendar_events', sql: 'DELETE FROM calendar_events;' },
      { name: 'sales_reports', sql: 'DELETE FROM sales_reports;' },
      { name: 'daily_income', sql: 'DELETE FROM daily_income;' },
      { name: 'expenses', sql: 'DELETE FROM expenses;' },
      { name: 'ad_spends', sql: 'DELETE FROM ad_spends;' },
      { name: 'lead_infos', sql: 'DELETE FROM lead_infos;' },
      { name: 'revenue_goals', sql: 'DELETE FROM revenue_goals;' },
      { name: 'notifications', sql: 'DELETE FROM notifications;' },
      { name: 'login_tracker', sql: 'DELETE FROM login_tracker;' },
      { name: 'leave_balances', sql: 'DELETE FROM leave_balances;' },
      { name: 'leave_applications', sql: 'DELETE FROM leave_applications;' },
      { name: 'leave_types', sql: 'DELETE FROM leave_types;' },
      { name: 'activity_logs', sql: 'DELETE FROM activity_logs;' },
      { name: 'bookings', sql: 'DELETE FROM bookings;' },
      { name: 'sessions', sql: 'DELETE FROM sessions;' },
    ];

    const results: Record<string, 'ok' | string> = {};

    for (const t of targets) {
      try {
        execRaw(t.sql);
        results[t.name] = 'ok';
      } catch (e: any) {
        results[t.name] = e?.message || 'error';
        // continue with next table instead of failing the whole operation
      }
    }

    execRaw("PRAGMA foreign_keys = ON;");

    return { ok: true, results };
  },

  // Find a specific booking by phone number + date + time slot
  async getBookingByPhoneDateAndSlot(phoneNumber: string, bookingDate: string, timeSlot: string) {
    // Normalize inputs to be more tolerant (trim, case-insensitive)
    const pn = phoneNumber.trim();
    const dt = bookingDate.trim();
    const slot = timeSlot.trim();
    // Try exact first, then case-insensitive match if needed
    const exact = await db.query.bookings.findFirst({
      where: (bookings, { and, eq }) => and(
        eq(bookings.phoneNumber, pn),
        eq(bookings.bookingDate, dt),
        eq(bookings.timeSlot, slot)
      ),
      orderBy: [desc(bookings.createdAt)],
    });
    if (exact) return exact;

    // Fallback: compare normalized timeSlot in memory (case-insensitive)
    const rows = await db.query.bookings.findMany({
      where: (bookings, { and, eq }) => and(
        eq(bookings.phoneNumber, pn),
        eq(bookings.bookingDate, dt)
      ),
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
    });
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    return rows.find(r => norm(r.timeSlot) === norm(slot));
  },

  async updateBooking(bookingId: string, updateData: any) {
    const result = await db.update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();
    return result[0];
  },

  // Daily Income operations
  async listDailyIncome(filters?: { startDate?: string; endDate?: string; paymentType?: 'all' | 'cash' | 'upi' | 'other' }) {
    const whereParts: any[] = [];
    if (filters?.startDate) whereParts.push(gte(dailyIncome.date as any, filters.startDate));
    if (filters?.endDate) whereParts.push(lte(dailyIncome.date as any, filters.endDate));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;
    const rows = await db.query.dailyIncome.findMany({ where: whereClause, orderBy: [desc(dailyIncome.date as any)] });

    if (!rows.length) return rows;

    // Build a set of dates we need refund adjustments for
    const dates = Array.from(new Set(rows.map(r => r.date)));
    const bookingsForDates = await db.query.bookings.findMany({
      where: inArray(bookings.bookingDate as any, dates as any),
    });

    // Build per-date refund breakdowns (pro-rate cash vs UPI) and refunded show counts
    const refundBreakdown = new Map<string, { total: number; cash: number; upi: number; refundedShows: number }>();
    for (const b of bookingsForDates as any[]) {
      const date = b.bookingDate as string;
      const isApprovedRefund = b.refundStatus === 'approved';
      const refundAmt = isApprovedRefund ? Math.max(0, Number(b.refundAmount || 0)) : 0;
      if (refundAmt <= 0) continue;
      const paidCash = Number(b.cashAmount || 0);
      const paidUpi = Number(b.upiAmount || 0);
      const paidTotal = paidCash + paidUpi;
      const totalAmount = Number(b.totalAmount || paidTotal || 0);
      // Pro-rate refund across payment modes; if nothing paid, assign to cash by default 0
      const cashShare = paidTotal > 0 ? (refundAmt * (paidCash / paidTotal)) : 0;
      const upiShare = Math.max(0, refundAmt - cashShare);
      const fullRefunded = totalAmount > 0 ? (refundAmt >= totalAmount - 0.01) : (refundAmt >= paidTotal - 0.01);
      const curr = refundBreakdown.get(date) || { total: 0, cash: 0, upi: 0, refundedShows: 0 };
      curr.total += refundAmt;
      curr.cash += cashShare;
      curr.upi += upiShare;
      if (fullRefunded) curr.refundedShows += 1;
      refundBreakdown.set(date, curr);
    }

    // Enrich rows with computed refunds and adjusted totals (do not persist here)
    const enriched = rows.map(r => {
      const cash = Number(r.cashReceived || 0);
      const upi = Number(r.upiReceived || 0);
      const other = Number(r.otherPayments || 0);
      const breakdown = refundBreakdown.get(r.date) || { total: 0, cash: 0, upi: 0, refundedShows: 0 };
      const adjustedCashReceived = Math.max(0, cash - breakdown.cash);
      const adjustedUpiReceived = Math.max(0, upi - breakdown.upi);
      const adjustedShows = Math.max(0, Number(r.numberOfShows || 0) - breakdown.refundedShows);
      const adjustedRevenue = Math.max(0, adjustedCashReceived + adjustedUpiReceived + other);
      return {
        ...r,
        refundTotal: breakdown.total,
        adjustedRevenue,
        adjustedShows,
        adjustedCashReceived,
        adjustedUpiReceived,
      } as any;
    });

    return enriched;
  },

  async createDailyIncome(data: any) {
    const res = await db.insert(dailyIncome).values(data).returning();
    return res[0];
  },

  async updateDailyIncome(id: string, data: any) {
    const res = await db.update(dailyIncome).set(data).where(eq(dailyIncome.id, id)).returning();
    return res[0];
  },

  async deleteDailyIncome(id: string) {
    await db.delete(dailyIncome).where(eq(dailyIncome.id, id));
    return true;
  },

  async getDailyIncomeByDate(date: string) {
    return db.query.dailyIncome.findFirst({ where: eq(dailyIncome.date as any, date) });
  },

  async syncDailyIncomeFromBookings(opts?: { startDate?: string; endDate?: string; mode?: 'overwrite' | 'upsert-missing' }) {
    // Fetch bookings in range or all
    const whereParts: any[] = [];
    if (opts?.startDate) whereParts.push(gte(bookings.bookingDate as any, opts.startDate));
    if (opts?.endDate) whereParts.push(lte(bookings.bookingDate as any, opts.endDate));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    const all = await db.query.bookings.findMany({ where: whereClause });
    if (!all.length) return { updated: 0 };

    // Group by date and aggregate
    const byDate = new Map<string, { cash: number; upi: number; shows: number; refund: number }>();
    for (const b of all as any[]) {
      const d = b.bookingDate as string;
      const curr = byDate.get(d) || { cash: 0, upi: 0, shows: 0, refund: 0 };
      curr.cash += Number(b.cashAmount || 0);
      curr.upi += Number(b.upiAmount || 0);
      curr.shows += 1; // treat each booking as a show entry; adjust if you have separate show entity
      if (b.refundStatus === 'approved') curr.refund += Math.max(0, Number(b.refundAmount || 0));
      byDate.set(d, curr);
    }

    let updated = 0;
    for (const [date, agg] of byDate) {
      const gross = agg.cash + agg.upi; // otherPayments left as 0 for sync; can be extended
      const adjustedRevenue = Math.max(0, gross - agg.refund);
      const existing = await this.getDailyIncomeByDate(date);
      if (existing) {
        if ((opts?.mode || 'overwrite') === 'overwrite') {
          await this.updateDailyIncome(existing.id, {
            date,
            numberOfShows: agg.shows,
            cashReceived: agg.cash,
            upiReceived: agg.upi,
            otherPayments: existing.otherPayments || 0,
            adjustedShows: agg.shows,
            adjustedRevenue,
            refundTotal: agg.refund,
          });
          updated++;
        }
      } else {
        await this.createDailyIncome({
          date,
          numberOfShows: agg.shows,
          cashReceived: agg.cash,
          upiReceived: agg.upi,
          otherPayments: 0,
          adjustedShows: agg.shows,
          adjustedRevenue,
          refundTotal: agg.refund,
        });
        updated++;
      }
    }

    return { updated };
  },

  async deleteBooking(bookingId: string) {
    // Delete dependent records first to satisfy FK constraints
    try {
      await db.delete(feedbacks).where(eq(feedbacks.bookingId, bookingId));
    } catch {}
    try {
      await db.delete(customerTickets).where(eq(customerTickets.bookingId, bookingId));
    } catch {}
    try {
      await db.delete(followUps).where(eq(followUps.bookingId, bookingId));
    } catch {}
    try {
      await db.delete(calendarEvents).where(eq(calendarEvents.bookingId, bookingId));
    } catch {}

    // Finally delete the booking itself
    await db.delete(bookings).where(eq(bookings.id, bookingId));
  },

  async getBookingsByDateRange(startDate: string, endDate: string) {
    return db.query.bookings.findMany({
      where: (bookings, { and, gte, lte }) => and(
        gte(bookings.bookingDate, startDate),
        lte(bookings.bookingDate, endDate)
      ),
      orderBy: [desc(bookings.createdAt)]
    });
  },
  
  async getAllBookings(page: number = 1, pageSize: number = 10, filters?: {
    dateFilter?: string;
    phoneFilter?: string;
    bookingDateFilter?: string;
    repeatCountFilter?: string;
  }) {
    const offset = (page - 1) * pageSize;
    
    // Build where conditions
    const whereConditions: any[] = [];
    
    if (filters?.dateFilter) {
      const filterDate = filters.dateFilter;
      whereConditions.push(sql`DATE(${bookings.createdAt}) = ${filterDate}`);
    }
    
    if (filters?.phoneFilter) {
      whereConditions.push(like(bookings.phoneNumber, `%${filters.phoneFilter}%`));
    }
    
    if (filters?.bookingDateFilter) {
      whereConditions.push(eq(bookings.bookingDate, filters.bookingDateFilter));
    }
    
    if (filters?.repeatCountFilter) {
      whereConditions.push(eq(bookings.repeatCount, Number(filters.repeatCountFilter)));
    }
    
    // Combine conditions with AND
    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions)
      : undefined;
    
    // Get filtered results joined with creator info
    const rows = await db
      .select({
        b: bookings,
        creatorEmail: users.email,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(bookings.createdAt))
      .limit(pageSize)
      .offset(offset);

    const results = rows.map((r: any) => ({
      ...r.b,
      createdByEmail: r.creatorEmail || null,
      createdByName: ((r.creatorFirstName || '') + ' ' + (r.creatorLastName || '')).trim() || null,
    }));
    
    // Get total count for pagination with filters
    const countQuery = db.select({ count: sql`count(*)` })
      .from(bookings)
      .where(whereClause);
    const countResult = await countQuery.execute();
    const totalCount = Number(countResult[0]?.count || 0);
    
    return {
      bookings: results,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    };
  },
  
  // Tickets operations
  async createTicket(data: { bookingId: string; reason: string; notes?: string; timeSlot?: string; createdBy?: string }) {
    const result = await db.insert(customerTickets).values({
      bookingId: data.bookingId,
      reason: data.reason,
      notes: data.notes,
      timeSlot: data.timeSlot,
      createdBy: data.createdBy,
    }).returning();
    return result[0];
  },

  async updateTicket(id: string, update: Partial<{ reason: string; notes: string; status: string }>) {
    const result = await db.update(customerTickets)
      .set({ ...update, updatedAt: new Date().toISOString() })
      .where(eq(customerTickets.id, id))
      .returning();
    return result[0];
  },

  async softDeleteTicket(id: string) {
    const result = await db.update(customerTickets)
      .set({ status: 'deleted', deletedAt: new Date().toISOString() })
      .where(eq(customerTickets.id, id))
      .returning();
    return result[0];
  },

  async getTickets(params: {
    page?: number;
    pageSize?: number;
    bookingId?: string;
    phoneNumber?: string;
    reason?: string;
    timeSlot?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const baseWhere: any[] = [sql`deleted_at IS NULL`];

    // Build query depending on whether phoneNumber filter is used
    if (params.phoneNumber) {
      // Join with bookings to filter by phone
      const whereJoinParts: any[] = [...baseWhere, eq(bookings.phoneNumber, params.phoneNumber)];
      if (params.reason) whereJoinParts.push(eq(customerTickets.reason, params.reason));
      if (params.timeSlot) whereJoinParts.push(eq(customerTickets.timeSlot, params.timeSlot));
      if (params.startDate && params.endDate) {
        whereJoinParts.push(and(gte(customerTickets.createdAt, params.startDate), lte(customerTickets.createdAt, params.endDate)));
      }
      if (params.bookingId) whereJoinParts.push(eq(customerTickets.bookingId, params.bookingId));
      const whereClause = and(...whereJoinParts);

      const rows = await db
        .select({ ticket: customerTickets })
        .from(customerTickets)
        .leftJoin(bookings, eq(bookings.id, customerTickets.bookingId))
        .where(whereClause)
        .orderBy(desc(customerTickets.createdAt))
        .limit(pageSize)
        .offset(offset);

      const countRes = await db
        .select({ count: sql`count(*)` })
        .from(customerTickets)
        .leftJoin(bookings, eq(bookings.id, customerTickets.bookingId))
        .where(whereClause)
        .execute();

      const total = Number(countRes[0]?.count || 0);
      const tickets = rows.map(r => r.ticket);
      return { tickets, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
    } else {
      // No phone filter → simple table query
      const whereParts: any[] = [...baseWhere];
      if (params.bookingId) whereParts.push(eq(customerTickets.bookingId, params.bookingId));
      if (params.reason) whereParts.push(eq(customerTickets.reason, params.reason));
      if (params.timeSlot) whereParts.push(eq(customerTickets.timeSlot, params.timeSlot));
      if (params.startDate && params.endDate) {
        whereParts.push(and(gte(customerTickets.createdAt, params.startDate), lte(customerTickets.createdAt, params.endDate)));
      }
      const whereClause = and(...whereParts);

      const rows = await db.select().from(customerTickets)
        .where(whereClause)
        .orderBy(desc(customerTickets.createdAt))
        .limit(pageSize)
        .offset(offset);

      const countRes = await db.select({ count: sql`count(*)` })
        .from(customerTickets)
        .where(whereClause)
        .execute();
      const total = Number(countRes[0]?.count || 0);

      return { tickets: rows, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
    }
  },

  // Expense operations
  async createExpense(expenseData: any) {
    const result = await db.insert(expenses).values(expenseData).returning();
    return result[0];
  },

  async getAllExpenses(limit?: number) {
    return db.query.expenses.findMany({
      orderBy: [desc(expenses.createdAt)],
      limit: limit
    });
  },

  // Lead Info operations
  async createLeadInfo(data: any) {
    // Enforce one entry per user per date per shift
    const existing = await db.query.leadInfos.findFirst({
      where: (leadInfos, { and, eq }) => and(
        eq(leadInfos.date as any, data.date),
        eq(leadInfos.shift as any, data.shift),
        eq(leadInfos.createdBy as any, data.createdBy)
      )
    });
    if (existing) return existing;
    const res = await db.insert(leadInfos).values(data).returning();
    return res[0];
  },

  async listLeadInfos(filters?: { startDate?: string; endDate?: string; source?: string }) {
    const whereParts: any[] = [];
    if (filters?.startDate) whereParts.push(gte(leadInfos.date as any, filters.startDate));
    if (filters?.endDate) whereParts.push(lte(leadInfos.date as any, filters.endDate));
    if (filters?.source) whereParts.push(eq(leadInfos.source as any, filters.source));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;
    return db.query.leadInfos.findMany({ where: whereClause, orderBy: [desc(leadInfos.date as any), desc(leadInfos.createdAt as any)] });
  },

  async getLeadStats(filters?: { startDate?: string; endDate?: string }) {
    const rows = await this.listLeadInfos(filters);
    // Aggregate simple totals and per-day breakdown for charts
    const total = { totalLeads: 0, goodLeads: 0, badLeads: 0, callsMade: 0 } as any;
    const byDate = new Map<string, { totalLeads: number; goodLeads: number; badLeads: number; callsMade: number }>();
    for (const r of rows as any[]) {
      total.totalLeads += Number(r.totalLeads || 0);
      total.goodLeads += Number(r.goodLeads || 0);
      total.badLeads += Number(r.badLeads || 0);
      total.callsMade += Number(r.callsMade || 0);
      const d = r.date as string;
      const curr = byDate.get(d) || { totalLeads: 0, goodLeads: 0, badLeads: 0, callsMade: 0 };
      curr.totalLeads += Number(r.totalLeads || 0);
      curr.goodLeads += Number(r.goodLeads || 0);
      curr.badLeads += Number(r.badLeads || 0);
      curr.callsMade += Number(r.callsMade || 0);
      byDate.set(d, curr);
    }
    const series = Array.from(byDate.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
    return { total, series };
  },

  async createLeadNotificationsIfMissing(referenceDateISO: string) {
    // Check if any lead info exists for that date; notify all users otherwise
    const date = referenceDateISO;
    const rows = await db.query.leadInfos.findMany({ where: eq(leadInfos.date as any, date) });
    if (rows.length > 0) return { notified: 0 };
    const allUsers = await this.getAllUsers();
    let notified = 0;
    for (const u of allUsers as any[]) {
      try {
        await this.createNotification({ userId: u.id, title: `Missing lead info for ${date}`, body: 'Please submit morning/evening lead info', type: 'lead_info' });
        notified++;
      } catch {}
    }
    return { notified };
  },

  async exportLeadInfosCSV(filters?: { startDate?: string; endDate?: string; source?: string }) {
    const rows = await this.listLeadInfos(filters);
    const headers = ['Date','Shift','Source','Total Leads','Good Leads','Bad Leads','Calls Made','Description','Created By','Created At'];
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(',')].concat((rows as any[]).map((r) => [
      r.date,
      r.shift,
      r.source,
      r.totalLeads ?? 0,
      r.goodLeads ?? 0,
      r.badLeads ?? 0,
      r.callsMade ?? 0,
      r.description ?? '',
      r.createdBy ?? '',
      r.createdAt ?? '',
    ].map(escape).join(','))).join('\n');
    return csv;
  },

  async getExpensesByCategory(category: string) {
    return db.query.expenses.findMany({
      where: eq(expenses.category, category),
      orderBy: [desc(expenses.createdAt)]
    });
  },

  async getExpensesByDateRange(startDate: string, endDate: string) {
    return db.query.expenses.findMany({
      where: (expenses, { and, gte, lte }) => and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate)
      ),
      orderBy: [desc(expenses.createdAt)]
    });
  },

  // Login tracker operations
  async logLogin(entry: { userId: string; email?: string | null; deviceType?: string | null; userAgent?: string | null; ipAddress?: string | null }) {
    const now = new Date().toISOString();
    const row = await db.insert(loginTracker).values({
      id: randomUUID(),
      userId: entry.userId,
      email: entry.email || null,
      deviceType: entry.deviceType || null,
      userAgent: entry.userAgent || null,
      ipAddress: entry.ipAddress || null,
      loginTime: now,
    }).returning();
    return row[0];
  },

  async logLogout(userId: string) {
    // Find latest open session for user and close it
    const rows = await db.select().from(loginTracker)
      .where(and(eq(loginTracker.userId, userId), sql`logout_time IS NULL`))
      .orderBy(desc(loginTracker.loginTime))
      .limit(1);
    const open = rows[0];
    if (!open) return null;

    const logoutTime = new Date().toISOString();
    const durationSec = Math.max(0, Math.floor((new Date(logoutTime).getTime() - new Date(open.loginTime!).getTime()) / 1000));
    const updated = await db.update(loginTracker)
      .set({ logoutTime, sessionDurationSec: durationSec })
      .where(eq(loginTracker.id, open.id))
      .returning();
    return updated[0];
  },

  async listLogins(filters?: { startDate?: string; endDate?: string; userId?: string; email?: string }) {
    const where: any[] = [];
    if (filters?.startDate && filters?.endDate) {
      where.push(sql`login_time >= ${filters.startDate} AND login_time <= ${filters.endDate}`);
    }
    if (filters?.userId) where.push(eq(loginTracker.userId, filters.userId));
    if (filters?.email) where.push(eq(loginTracker.email, filters.email));
    const clause = where.length ? and(...where) : undefined;
    // Join users to include names and better identity info
    const rows = await db
      .select({
        log: loginTracker,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(loginTracker)
      .leftJoin(users, eq(loginTracker.userId, users.id))
      .where(clause)
      .orderBy(desc(loginTracker.loginTime));

    return rows.map((r: any) => ({
      ...r.log,
      firstName: r.firstName || null,
      lastName: r.lastName || null,
    }));
  },

  // Ad spend operations
  async createAdSpend(data: any) {
    try {
      console.log("Storage: Creating ad spend with data:", JSON.stringify(data, null, 2));
      const result = await db.insert(adSpends).values(data).returning();
      console.log("Storage: Ad spend created successfully:", result[0]);
      return result[0];
    } catch (error) {
      console.error("Storage: Error creating ad spend:", error);
      throw error;
    }
  },

  async updateAdSpend(id: string, update: any) {
    const result = await db.update(adSpends).set(update).where(eq(adSpends.id, id)).returning();
    return result[0];
  },

  async deleteAdSpend(id: string) {
    await db.delete(adSpends).where(eq(adSpends.id, id));
  },

  async getAdSpends(filters?: {
    startDate?: string;
    endDate?: string;
    campaignName?: string;
    platform?: string;
    maxCpl?: number;
  }) {
    // Build dynamic where clause
    const whereParts: any[] = [];

    if (filters?.startDate && filters?.endDate) {
      whereParts.push(sql`date >= ${filters.startDate} AND date <= ${filters.endDate}`);
    }
    if (filters?.campaignName) {
      whereParts.push(like(adSpends.campaignName, `%${filters.campaignName}%`));
    }
    if (filters?.platform) {
      whereParts.push(eq(adSpends.platform, filters.platform));
    }

    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    const rows = await db.select().from(adSpends).where(whereClause).orderBy(desc(adSpends.date), desc(adSpends.createdAt));

    // Apply CPL filter in memory (requires computed value)
    if (typeof filters?.maxCpl === 'number') {
      return rows.filter(r => (r.totalLeads || 0) > 0 && (r.adSpend / r.totalLeads) <= (filters!.maxCpl as number));
    }

    return rows;
  },

  // Leave application operations
  async createLeaveApplication(leaveData: any) {
    const result = await db.insert(leaveApplications).values(leaveData).returning();
    return result[0];
  },

  async getLeaveApplications() {
    return db.query.leaveApplications.findMany({
      orderBy: [desc(leaveApplications.createdAt)]
    });
  },

  async updateLeaveStatus(applicationId: string, status: string, reviewedBy: string) {
    const result = await db.update(leaveApplications)
      .set({ 
        status, 
        reviewedBy, 
        reviewedAt: new Date().toISOString()
      })
      .where(eq(leaveApplications.id, applicationId))
      .returning();
    return result[0];
  },

  // Feedbacks operations
  async listFeedbacks(filters?: { collected?: boolean; theatreName?: string; date?: string; timeSlot?: string }, page: number = 1, pageSize: number = 20) {
    // Build simple where on feedbacks for prefiltering
    const whereParts: any[] = [];
    if (filters?.theatreName) whereParts.push(eq(feedbacks.theatreName, filters.theatreName));
    if (filters?.date) whereParts.push(eq(feedbacks.bookingDate, filters.date));
    if (filters?.timeSlot) whereParts.push(eq(feedbacks.timeSlot, filters.timeSlot));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    // Join feedbacks with bookings to always have customerName/phoneNumber present
    const joined = await db
      .select({ fb: feedbacks, b: bookings })
      .from(feedbacks)
      .leftJoin(bookings, eq(feedbacks.bookingId, bookings.id))
      .where(whereClause)
      .orderBy(desc(feedbacks.createdAt));

    // Pick latest feedback per bookingId
    const latestByBooking = new Map<string, any>();
    for (const r of joined as any[]) {
      const f = r.fb;
      if (!latestByBooking.has(f.bookingId)) {
        latestByBooking.set(f.bookingId, {
          ...f,
          customerName: r.b?.customerName || null,
          phoneNumber: r.b?.phoneNumber || null,
        });
      }
    }

    // Convert to list and apply 'collected' filter on latest
    let list = Array.from(latestByBooking.values());
    if (typeof filters?.collected === 'boolean') {
      list = list.filter((r: any) => r.collected === filters.collected);
    }

    // Sort by createdAt DESC
    list.sort((a: any, b: any) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

    // Pagination over distinct bookings
    const total = list.length;
    const start = Math.max(0, (page - 1) * pageSize);
    const paged = list.slice(start, start + pageSize);

    return { rows: paged, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  },

  async getLatestFeedbackForBooking(bookingId: string) {
    const rows = await db.query.feedbacks.findMany({ where: eq(feedbacks.bookingId, bookingId), orderBy: [desc(feedbacks.createdAt)], limit: 1 });
    return rows?.[0] || null;
  },

  async upsertFeedback(data: { id?: string; bookingId: string; bookingDate?: string | null; timeSlot?: string | null; theatreName?: string | null; customerName?: string | null; phoneNumber?: string | null; collected: boolean; reason?: string | null; createdBy?: string | null }) {
    // If id provided, update that record without wiping existing denormalized fields
    if (data.id) {
      const existingRows = await db.query.feedbacks.findMany({ where: eq(feedbacks.id, data.id), limit: 1 });
      const existing = existingRows?.[0] as any;
      const res = await db.update(feedbacks)
        .set({
          bookingId: data.bookingId || existing?.bookingId,
          bookingDate: (data.bookingDate !== undefined ? data.bookingDate : existing?.bookingDate) ?? null,
          timeSlot: (data.timeSlot !== undefined ? data.timeSlot : existing?.timeSlot) ?? null,
          theatreName: (data.theatreName !== undefined ? data.theatreName : existing?.theatreName) ?? null,
          customerName: (data.customerName !== undefined ? data.customerName : existing?.customerName) ?? null,
          phoneNumber: (data.phoneNumber !== undefined ? data.phoneNumber : existing?.phoneNumber) ?? null,
          collected: data.collected,
          reason: data.collected ? null : (data.reason !== undefined ? data.reason : existing?.reason ?? null),
          updatedAt: sql`(CURRENT_TIMESTAMP)`
        })
        .where(eq(feedbacks.id, data.id))
        .returning();
      return res[0];
    }

    // Otherwise, upsert by latest feedback for the booking
    const latest = await db.query.feedbacks.findMany({
      where: eq(feedbacks.bookingId, data.bookingId),
      orderBy: [desc(feedbacks.createdAt)],
      limit: 1,
    });
    if (latest && latest[0]) {
      const cur = latest[0] as any;
      const res = await db.update(feedbacks)
        .set({
          bookingId: data.bookingId || cur.bookingId,
          bookingDate: (data.bookingDate !== undefined ? data.bookingDate : cur.bookingDate) ?? null,
          timeSlot: (data.timeSlot !== undefined ? data.timeSlot : cur.timeSlot) ?? null,
          theatreName: (data.theatreName !== undefined ? data.theatreName : cur.theatreName) ?? null,
          customerName: (data.customerName !== undefined ? data.customerName : cur.customerName) ?? null,
          phoneNumber: (data.phoneNumber !== undefined ? data.phoneNumber : cur.phoneNumber) ?? null,
          collected: data.collected,
          reason: data.collected ? null : (data.reason !== undefined ? data.reason : cur.reason ?? null),
          updatedAt: sql`(CURRENT_TIMESTAMP)`
        })
        .where(eq(feedbacks.id, latest[0].id))
        .returning();
      return res[0];
    }

    // No previous feedback → insert new
    const res = await db.insert(feedbacks)
      .values({
        bookingId: data.bookingId,
        bookingDate: data.bookingDate ?? null,
        timeSlot: data.timeSlot ?? null,
        theatreName: data.theatreName ?? null,
        customerName: data.customerName ?? null,
        phoneNumber: data.phoneNumber ?? null,
        collected: data.collected,
        reason: data.collected ? null : (data.reason ?? null),
        createdBy: data.createdBy ?? null,
      })
      .returning();
    return res[0];
  },

  // Follow-ups operations (extend for feedback type)
  async createFollowUpForFeedback(input: { bookingId?: string | null; customerName?: string | null; phoneNumber?: string | null; reason: string; dueAt?: string | null; createdBy?: string | null; }) {
    const res = await db.insert(followUps).values({
      bookingId: input.bookingId ?? null,
      customerName: input.customerName ?? null,
      phoneNumber: input.phoneNumber ?? null,
      reason: input.reason,
      type: 'feedback',
      status: 'pending',
      dueAt: input.dueAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdBy: input.createdBy ?? null,
    }).returning();
    return res[0];
  },

  async markFollowUpCompleted(id: string) {
    // 1) Mark follow-up as completed
    const updated = await db.update(followUps)
      .set({ status: 'completed', completedAt: new Date().toISOString() })
      .where(eq(followUps.id, id))
      .returning();

    // 2) If this follow-up relates to a booking, mark its feedback as collected and close other pending follow-ups
    try {
      const fu = await db.query.followUps.findFirst({ where: eq(followUps.id, id) });
      const bookingId = (fu as any)?.bookingId;
      if (bookingId) {
        // Update latest feedback to collected=true
        const fbRows = await db.query.feedbacks.findMany({
          where: eq(feedbacks.bookingId, bookingId),
          orderBy: [desc(feedbacks.createdAt)],
          limit: 1,
        });
        const latest = fbRows[0] as any;
        if (latest) {
          await db.update(feedbacks)
            .set({ collected: true, reason: null, updatedAt: sql`(CURRENT_TIMESTAMP)` })
            .where(eq(feedbacks.id, latest.id));
        } else {
          // Create a collected feedback record if none exists
          const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
          await db.insert(feedbacks).values({
            bookingId,
            bookingDate: (booking as any)?.bookingDate || null,
            timeSlot: (booking as any)?.timeSlot || null,
            theatreName: (booking as any)?.theatreName || null,
            customerName: (booking as any)?.customerName || null,
            phoneNumber: (booking as any)?.phoneNumber || null,
            collected: true,
            reason: null,
            createdBy: (fu as any)?.createdBy || null,
          });
        }

        // Close all other pending follow-ups for this booking and type 'feedback'
        const openFus = await db.query.followUps.findMany({
          where: and(eq(followUps.bookingId, bookingId), eq(followUps.type, 'feedback'), eq(followUps.status, 'pending')),
        });
        for (const x of openFus as any[]) {
          await db.update(followUps).set({ status: 'completed', completedAt: new Date().toISOString() }).where(eq(followUps.id, x.id));
        }
      }
    } catch (e) {
      console.warn('Failed to flip feedback to collected on follow-up completion:', e);
    }

    return updated[0];
  },

  async cancelFollowUp(id: string) {
    const res = await db.update(followUps)
      .set({ status: 'cancelled', completedAt: new Date().toISOString() })
      .where(eq(followUps.id, id))
      .returning();
    return res[0];
  },

  async closePendingFollowUpsForBooking(bookingId: string) {
    const pending = await db.query.followUps.findMany({
      where: and(eq(followUps.bookingId, bookingId), eq(followUps.type, 'feedback'), eq(followUps.status, 'pending')),
    });
    for (const p of pending as any[]) {
      await db.update(followUps).set({ status: 'completed', completedAt: new Date().toISOString() }).where(eq(followUps.id, p.id));
    }
    return pending.length;
  },

  async listFollowUps(filters?: { type?: string; status?: string }) {
    const whereParts: any[] = [];
    if (filters?.type) whereParts.push(eq(followUps.type, filters.type));
    if (filters?.status) whereParts.push(eq(followUps.status, filters.status));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;
    return db.query.followUps.findMany({ where: whereClause, orderBy: [desc(followUps.createdAt)] });
  },

  async listBookingsNeedingFeedback(filters?: { theatreName?: string; date?: string; timeSlot?: string }, page: number = 1, pageSize: number = 20) {
    // Bookings where there is no collected=true feedback record
    const offset = (page - 1) * pageSize;

    const whereParts: any[] = [];
    if (filters?.theatreName) whereParts.push(eq(bookings.theatreName, filters.theatreName));
    if (filters?.date) whereParts.push(eq(bookings.bookingDate, filters.date));
    if (filters?.timeSlot) whereParts.push(eq(bookings.timeSlot, filters.timeSlot));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    // Step 1: get candidate bookings
    const candidate = await db.query.bookings.findMany({ where: whereClause, orderBy: [desc(bookings.createdAt)], limit: pageSize, offset });
    const bookingIds = candidate.map(b => b.id);

    // Step 2: get feedbacks for these bookings and compute maps
    let collectedMap = new Map<string, boolean>();
    let latestFeedbackByBooking = new Map<string, any>();
    if (bookingIds.length) {
      const fbRows = await db.query.feedbacks.findMany({
        where: (feedbacks, { inArray }) => inArray(feedbacks.bookingId, bookingIds as any[]) as any,
      });
      for (const f of fbRows as any[]) {
        if (f.collected) collectedMap.set(f.bookingId, true);
        const prev = latestFeedbackByBooking.get(f.bookingId);
        if (!prev) {
          latestFeedbackByBooking.set(f.bookingId, f);
        } else {
          const prevT = new Date(prev.createdAt as any).getTime();
          const curT = new Date(f.createdAt as any).getTime();
          if (!Number.isFinite(prevT) || (Number.isFinite(curT) && curT > prevT)) {
            latestFeedbackByBooking.set(f.bookingId, f);
          }
        }
      }
    }

    // Step 3: filter out those already collected=true, and attach latest feedback state (if any)
    const rows = candidate
      .filter(b => !collectedMap.get(b.id))
      .map(b => {
        const fb = latestFeedbackByBooking.get(b.id);
        return {
          ...b,
          collected: fb?.collected ?? null,
          reason: fb?.reason ?? null,
        } as any;
      });

    // Count approximate total: use bookings count then subtract those with collected
    const totalRow = await db.select({ count: sql`COUNT(*)` }).from(bookings).where(whereClause);
    const totalApprox = Number(totalRow?.[0]?.count || 0);

    return { rows, pagination: { total: totalApprox, page, pageSize, totalPages: Math.ceil(totalApprox / pageSize) } };
  },

  // Feedback SLA: notify overdue follow-ups (>1 day)
  async notifyOverdueFeedbackFollowUps() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Find pending follow-ups of type 'feedback' past due and not yet notified
    const overdue = await db.select()
      .from(followUps)
      .where(and(eq(followUps.type, 'feedback'), eq(followUps.status, 'pending'), sql`${followUps.dueAt} < ${cutoff}`, sql`${followUps.notifiedOverdueAt} IS NULL`));

    if (!overdue.length) return [];

    // Notify admins and employees (per requirement) for each overdue
    const allUsers = await db.query.users.findMany();
    const toNotify = allUsers; // admins + employees

    const created: any[] = [];
    for (const fu of overdue as any[]) {
      for (const u of toNotify) {
        const n = await db.insert(notifications).values({
          userId: u.id,
          title: 'Feedback follow-up overdue',
          body: `Follow-up for booking ${fu.bookingId || ''} is overdue`,
          type: 'feedback',
          relatedType: 'follow_up',
          relatedId: fu.id,
        }).returning();
        created.push(n[0]);
      }
      await db.update(followUps).set({ notifiedOverdueAt: new Date().toISOString() }).where(eq(followUps.id, (fu as any).id));
    }
    return created;
  },

  async exportFeedbacksCSV(filters?: { collected?: boolean; theatreName?: string; date?: string; timeSlot?: string }) {
    const whereParts: any[] = [];
    if (typeof filters?.collected === 'boolean') whereParts.push(eq(feedbacks.collected, filters.collected));
    if (filters?.theatreName) whereParts.push(eq(feedbacks.theatreName, filters.theatreName));
    if (filters?.date) whereParts.push(eq(feedbacks.bookingDate, filters.date));
    if (filters?.timeSlot) whereParts.push(eq(feedbacks.timeSlot, filters.timeSlot));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    const rows = await db.query.feedbacks.findMany({ where: whereClause, orderBy: [desc(feedbacks.createdAt)] });

    const headers = ['Booking ID','Theatre','Date','Time Slot','Collected','Reason','Created At'];
    const csv = [headers.join(',')].concat(rows.map((r: any) => [
      r.bookingId,
      r.theatreName || '',
      r.bookingDate || '',
      r.timeSlot || '',
      r.collected ? 'Yes' : 'No',
      (r.reason || '').replace(/"/g, '""'),
      r.createdAt
    ].map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(','))).join('\n');
    return csv;
  },

  // Leave types operations
  async getLeaveTypes() {
    return db.query.leaveTypes.findMany();
  },

  async upsertLeaveType(data: { id?: string; code: string; name: string; defaultAnnual?: number; active?: boolean }) {
    if (data.id) {
      const result = await db.update(leaveTypes)
        .set({ code: data.code, name: data.name, defaultAnnual: data.defaultAnnual ?? 0, active: data.active ?? true })
        .where(eq(leaveTypes.id, data.id))
        .returning();
      return result[0];
    }
    const result = await db.insert(leaveTypes)
      .values({ code: data.code, name: data.name, defaultAnnual: data.defaultAnnual ?? 0, active: data.active ?? true })
      .returning();
    return result[0];
  },

  // Leave balance operations
  async getLeaveBalancesByUser(userId: string, year?: number) {
    const yr = year ?? new Date().getFullYear();
    return db.query.leaveBalances.findMany({
      where: and(eq(leaveBalances.userId, userId), eq(leaveBalances.year, yr))
    });
  },

  async setLeaveBalance(userId: string, leaveTypeCode: string, year: number, allocated: number) {
    // Try update, else insert
    const existing = await db.query.leaveBalances.findFirst({
      where: and(eq(leaveBalances.userId, userId), eq(leaveBalances.leaveTypeCode, leaveTypeCode), eq(leaveBalances.year, year))
    });
    if (existing) {
      const res = await db.update(leaveBalances)
        .set({ allocated })
        .where(eq(leaveBalances.id, existing.id))
        .returning();
      return res[0];
    }
    const res = await db.insert(leaveBalances)
      .values({ userId, leaveTypeCode, year, allocated, used: 0, carriedOver: 0 })
      .returning();
    return res[0];
  },

  async adjustLeaveUsed(userId: string, leaveTypeCode: string, year: number, delta: number) {
    const existing = await db.query.leaveBalances.findFirst({
      where: and(eq(leaveBalances.userId, userId), eq(leaveBalances.leaveTypeCode, leaveTypeCode), eq(leaveBalances.year, year))
    });
    if (!existing) {
      const res = await db.insert(leaveBalances)
        .values({ userId, leaveTypeCode, year, allocated: 0, used: Math.max(0, delta), carriedOver: 0 })
        .returning();
      return res[0];
    }
    const newUsed = Math.max(0, Number(existing.used) + delta);
    const res = await db.update(leaveBalances)
      .set({ used: newUsed })
      .where(eq(leaveBalances.id, existing.id))
      .returning();
    return res[0];
  },

  // Notifications operations
  async createNotification(data: { userId: string; title: string; body?: string; type?: string; relatedType?: string; relatedId?: string }) {
    const result = await db.insert(notifications).values({
      userId: data.userId,
      title: data.title,
      body: data.body ?? null,
      type: data.type ?? 'leave',
      relatedType: data.relatedType ?? null,
      relatedId: data.relatedId ?? null,
    }).returning();
    return result[0];
  },

  async listNotifications(userId: string) {
    return db.query.notifications.findMany({ where: eq(notifications.userId, userId), orderBy: [desc(notifications.createdAt)] });
  },

  async markNotificationRead(id: string, isRead: boolean = true) {
    const result = await db.update(notifications)
      .set({ isRead })
      .where(eq(notifications.id, id))
      .returning();
    return result[0];
  },

  // Calendar operations
  async createCalendarEvent(eventData: any) {
    const result = await db.insert(calendarEvents).values(eventData).returning();
    return result[0];
  },

  async getCalendarEventByBookingId(bookingId: string) {
    return db.query.calendarEvents.findFirst({
      where: eq(calendarEvents.bookingId, bookingId)
    });
  },

  async updateCalendarEvent(eventId: string, updateData: any) {
    const result = await db.update(calendarEvents)
      .set(updateData)
      .where(eq(calendarEvents.id, eventId))
      .returning();
    return result[0];
  },

  async deleteCalendarEvent(eventId: string) {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId));
  },
  
  // Login tracker operations
  async logLogin(data: { userId: string; email?: string | null; deviceType?: string | null; userAgent?: string | null; ipAddress?: string | null }) {
    const row = (await db.insert(loginTracker).values({
      userId: data.userId,
      email: data.email ?? null,
      loginTime: new Date().toISOString(),
      deviceType: data.deviceType ?? null,
      userAgent: data.userAgent ?? null,
      ipAddress: data.ipAddress ?? null,
    }).returning())[0];
    return row;
  },

  async logLogout(userId: string) {
    // Find most recent login with no logout
    const open = await db.query.loginTracker.findMany({
      where: eq(loginTracker.userId, userId),
      orderBy: [desc(loginTracker.loginTime)],
      limit: 1,
    });
    const last = open?.[0];
    if (!last || (last as any).logoutTime) return null;
    const logoutTime = new Date().toISOString();
    const sessionDurationSec = Math.max(0, Math.floor((new Date(logoutTime).getTime() - new Date((last as any).loginTime).getTime()) / 1000));
    const updated = await db.update(loginTracker)
      .set({ logoutTime, sessionDurationSec })
      .where(eq(loginTracker.id, (last as any).id))
      .returning();
    return updated[0];
  },

  async listLogins(params: { startDate?: string; endDate?: string; userId?: string; email?: string; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const filters: any[] = [];
    if (params.startDate) filters.push(gte(loginTracker.loginTime as any, params.startDate));
    if (params.endDate) filters.push(lte(loginTracker.loginTime as any, params.endDate));
    if (params.userId) filters.push(eq(loginTracker.userId, params.userId));
    if (params.email) filters.push(like(loginTracker.email, `%${params.email}%`));
    const whereClause = filters.length ? and(...filters) : undefined;

    const rows = await db.query.loginTracker.findMany({ where: whereClause, orderBy: [desc(loginTracker.loginTime)], limit: pageSize, offset });

    const count = await db.select({ count: sql`COUNT(*)` }).from(loginTracker).where(whereClause);
    const total = Number(count?.[0]?.count || 0);

    return { rows, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  },

  // Activity log operations
  async logActivity(userId: string, action: string, resourceType: string, resourceId: string, details: string) {
    return db.insert(activityLogs).values({
      userId,
      action,
      resourceType,
      resourceId,
      details
    }).returning();
  },
  
  // Analytics operations
  async getDailyRevenue(daysOrFilters: number | { startDate?: string; endDate?: string } = 7) {
    // Helper to compute net amounts, full-refund flag, and refund amount
    const computeNet = (b: any) => {
      const total = Number(b.totalAmount || 0);
      const isRefunded = (b.refundStatus === 'approved');
      const refund = isRefunded ? Math.max(0, Math.min(Number(b.refundAmount || 0), total)) : 0;
      const netTotal = Math.max(0, total - refund);
      const isFullRefund = total > 0 ? (refund >= total - 0.01) : false;
      return { netTotal, isFullRefund, refund };
    };

    const result: any[] = [];

    // Utilities for safe YYYY-MM-DD iteration without timezone pitfalls
    const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const addDaysYmd = (ymd: string, days: number) => {
      const [y,m,day] = ymd.split('-').map(Number);
      const d = new Date(y, (m - 1), day);
      d.setDate(d.getDate() + days);
      return toYMD(d);
    };

    // Determine date range
    let startStr: string;
    let endStr: string;
    if (typeof daysOrFilters === 'object') {
      const { startDate, endDate } = daysOrFilters || {};
      const today = toYMD(new Date());
      startStr = (startDate && String(startDate)) || today;
      endStr = (endDate && String(endDate)) || today;
    } else {
      const days = daysOrFilters as number;
      const today = toYMD(new Date());
      endStr = today;
      // build start by subtracting days-1
      startStr = addDaysYmd(today, -(days - 1));
    }

    // Iterate inclusive range
    let cursor = startStr;
    while (cursor <= endStr) {
      const dailyBookings = await db.query.bookings.findMany({ where: eq(bookings.bookingDate, cursor) });
      const revenue = dailyBookings.reduce((sum, b) => {
        const { netTotal } = computeNet(b);
        return sum + netTotal;
      }, 0);
      const nonRefundedCount = dailyBookings.reduce((count, b) => count + (computeNet(b).isFullRefund ? 0 : 1), 0);
      const refundedCount = dailyBookings.reduce((count, b) => count + ((b.refundStatus === 'approved' && Number(b.refundAmount || 0) > 0) ? 1 : 0), 0);
      const refundAmount = dailyBookings.reduce((sum, b) => sum + computeNet(b).refund, 0);
      result.push({ date: cursor, revenue, bookings: nonRefundedCount, refunded: refundedCount, refundAmount });
      cursor = addDaysYmd(cursor, 1);
    }

    return result;
  },

  async getPaymentMethodBreakdown(filters?: { startDate?: string; endDate?: string }) {
    // Helper to compute net cash/upi after approved refunds proportionally
    const computeNetSplit = (b: any) => {
      const total = Number(b.totalAmount || 0);
      const cash = Number(b.cashAmount || 0);
      const upi = Number(b.upiAmount || 0);
      const isRefunded = (b.refundStatus === 'approved');
      const refund = isRefunded ? Math.max(0, Math.min(Number(b.refundAmount || 0), total)) : 0;
      if (total <= 0 || refund <= 0) return { netCash: cash, netUpi: upi };
      const cashShare = cash / total;
      const upiShare = upi / total;
      const netCash = Math.max(0, cash - refund * cashShare);
      const netUpi = Math.max(0, upi - refund * upiShare);
      return { netCash, netUpi };
    };

    // Optional date filter
    const whereParts: any[] = [];
    if (filters?.startDate) whereParts.push(gte(bookings.bookingDate as any, filters.startDate));
    if (filters?.endDate) whereParts.push(lte(bookings.bookingDate as any, filters.endDate));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    const allBookings = await db.query.bookings.findMany({ where: whereClause });
    let cash = 0;
    let upi = 0;
    for (const b of allBookings as any[]) {
      const { netCash, netUpi } = computeNetSplit(b);
      cash += netCash;
      upi += netUpi;
    }
    return { cash, upi };
  },

  async getTimeSlotPerformance(filters?: { startDate?: string; endDate?: string }) {
    const computeNet = (b: any) => {
      const total = Number(b.totalAmount || 0);
      const isRefunded = (b.refundStatus === 'approved');
      const refund = isRefunded ? Math.max(0, Math.min(Number(b.refundAmount || 0), total)) : 0;
      return Math.max(0, total - refund);
    };

    // Optional date filter
    const whereParts: any[] = [];
    if (filters?.startDate) whereParts.push(gte(bookings.bookingDate as any, filters.startDate));
    if (filters?.endDate) whereParts.push(lte(bookings.bookingDate as any, filters.endDate));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    const allBookings = await db.query.bookings.findMany({ where: whereClause });

    const slotMap = new Map<string, { timeSlot: string; bookings: number; revenue: number }>();
    for (const booking of allBookings as any[]) {
      const slot = booking.timeSlot as string;
      if (!slotMap.has(slot)) {
        slotMap.set(slot, { timeSlot: slot, bookings: 0, revenue: 0 });
      }
      const slotData = slotMap.get(slot)!;
      slotData.bookings += 1;
      slotData.revenue += computeNet(booking);
    }

    return Array.from(slotMap.values());
  },
  
  // Configuration operations
  async getConfig() {
    // Default configuration
    const defaultConfig = {
      theatres: ['Theatre 1', 'Theatre 2', 'Theatre 3'],
      timeSlots: ['10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM'],
      expenseCategories: ['Utilities', 'Maintenance', 'Staff Salaries', 'Equipment', 'Marketing', 'Rent', 'Supplies', 'Insurance', 'Other'],
      expenseCreators: ['Kumar', 'Rahul', 'Priya', 'Amit', 'Sneha'],
      integrationSettings: { calendarSyncEnabled: true, calendarId: 'primary', syncWindowDays: 30 }
    };
    
    try {
      // Get theatres configuration
      const theatresConfig = await db.query.configurations.findFirst({
        where: eq(configurations.key, 'theatres')
      });
      
      // Get time slots configuration
      const timeSlotsConfig = await db.query.configurations.findFirst({
        where: eq(configurations.key, 'timeSlots')
      });
      
      // Get expense categories configuration
      const expenseCategoriesConfig = await db.query.configurations.findFirst({
        where: eq(configurations.key, 'expenseCategories')
      });
      
      // Get expense creators configuration
      const expenseCreatorsConfig = await db.query.configurations.findFirst({
        where: eq(configurations.key, 'expenseCreators')
      });

      // Get integration settings
      const integrationSettingsConfig = await db.query.configurations.findFirst({
        where: eq(configurations.key, 'integrationSettings')
      });
      
      return {
        theatres: theatresConfig ? JSON.parse(theatresConfig.value) : defaultConfig.theatres,
        timeSlots: timeSlotsConfig ? JSON.parse(timeSlotsConfig.value) : defaultConfig.timeSlots,
        expenseCategories: expenseCategoriesConfig ? JSON.parse(expenseCategoriesConfig.value) : defaultConfig.expenseCategories,
        expenseCreators: expenseCreatorsConfig ? JSON.parse(expenseCreatorsConfig.value) : defaultConfig.expenseCreators,
        integrationSettings: integrationSettingsConfig ? JSON.parse(integrationSettingsConfig.value) : defaultConfig.integrationSettings
      };
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return defaultConfig;
    }
  },
  
  async updateConfig({ theatres, timeSlots, expenseCategories, expenseCreators, integrationSettings }: { theatres: string[], timeSlots: string[], expenseCategories?: string[], expenseCreators?: string[], integrationSettings?: any }, userId: string) {
    try {
      // Update theatres configuration
      await db.insert(configurations)
        .values({
          key: 'theatres',
          value: JSON.stringify(theatres),
          updatedBy: userId
        })
        .onConflictDoUpdate({
          target: configurations.key,
          set: {
            value: JSON.stringify(theatres),
            updatedBy: userId,
            updatedAt: sql`(CURRENT_TIMESTAMP)`
          }
        });
      
      // Update time slots configuration
      await db.insert(configurations)
        .values({
          key: 'timeSlots',
          value: JSON.stringify(timeSlots),
          updatedBy: userId
        })
        .onConflictDoUpdate({
          target: configurations.key,
          set: {
            value: JSON.stringify(timeSlots),
            updatedBy: userId,
            updatedAt: sql`(CURRENT_TIMESTAMP)`
          }
        });
      
      // Update expense categories configuration if provided
      if (expenseCategories) {
        await db.insert(configurations)
          .values({
            key: 'expenseCategories',
            value: JSON.stringify(expenseCategories),
            updatedBy: userId
          })
          .onConflictDoUpdate({
            target: configurations.key,
            set: {
              value: JSON.stringify(expenseCategories),
              updatedBy: userId,
              updatedAt: sql`(CURRENT_TIMESTAMP)`
            }
          });
      }
      
      // Update expense creators configuration if provided
      if (expenseCreators) {
        await db.insert(configurations)
          .values({
            key: 'expenseCreators',
            value: JSON.stringify(expenseCreators),
            updatedBy: userId
          })
          .onConflictDoUpdate({
            target: configurations.key,
            set: {
              value: JSON.stringify(expenseCreators),
              updatedBy: userId,
              updatedAt: sql`(CURRENT_TIMESTAMP)`
            }
          });
      }

      // Update integration settings if provided
      if (integrationSettings) {
        await db.insert(configurations)
          .values({
            key: 'integrationSettings',
            value: JSON.stringify(integrationSettings),
            updatedBy: userId
          })
          .onConflictDoUpdate({
            target: configurations.key,
            set: {
              value: JSON.stringify(integrationSettings),
              updatedBy: userId,
              updatedAt: sql`(CURRENT_TIMESTAMP)`
            }
          });
      }
      
      return { theatres, timeSlots, expenseCategories, expenseCreators, integrationSettings };
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  },
  
  // Sales report operations
  async getSalesReports() {
    return db.query.salesReports.findMany({
      orderBy: [desc(salesReports.createdAt)]
    });
  },

  async generateDailySalesReport(reportDate: string, reportData: any) {
    const result = await db.insert(salesReports).values({
      reportDate,
      ...reportData
    }).returning();
    return result[0];
  },

  // Daily Income operations
  async getDailyIncomes(filters?: { startDate?: string; endDate?: string; paymentType?: string }) {
    let whereConditions = [];
    
    if (filters?.startDate) {
      whereConditions.push(sql`${dailyIncome.date} >= ${filters.startDate}`);
    }
    
    if (filters?.endDate) {
      whereConditions.push(sql`${dailyIncome.date} <= ${filters.endDate}`);
    }
    
    return db.query.dailyIncome.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(dailyIncome.date)]
    });
  },



  // Revenue Goals operations
  async setMonthlyGoal(data: InsertRevenueGoal & { createdBy: string }) {
    const parsed = insertRevenueGoalSchema.parse(data);
    // Check if goal already exists for this month
    const existing = await db.query.revenueGoals.findFirst({
      where: eq(revenueGoals.month as any, parsed.month)
    });
    
    if (existing) {
      // Update existing goal
      const updated = await db.update(revenueGoals)
        .set({ goalAmount: parsed.goalAmount, updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(eq(revenueGoals.id, existing.id))
        .returning();
      return updated[0];
    } else {
      // Create new goal
      const created = await db.insert(revenueGoals)
        .values({ ...parsed, createdBy: data.createdBy })
        .returning();
      return created[0];
    }
  },

  async getMonthlyGoal(month: string) {
    return db.query.revenueGoals.findFirst({
      where: eq(revenueGoals.month as any, month)
    });
  },

  // Google OAuth Token operations
  async getGoogleToken() {
    try {
      const config = await db.query.configurations.findFirst({
        where: eq(configurations.key, 'googleOAuthToken')
      });
      return config ? JSON.parse(config.value) : null;
    } catch (error) {
      console.error('Error getting Google OAuth token:', error);
      return null;
    }
  },

  async setGoogleToken(tokens: any, updatedBy?: string) {
    try {
      await db.insert(configurations)
        .values({
          key: 'googleOAuthToken',
          value: JSON.stringify(tokens),
          updatedBy: updatedBy || 'system'
        })
        .onConflictDoUpdate({
          target: configurations.key,
          set: {
            value: JSON.stringify(tokens),
            updatedBy: updatedBy || 'system',
            updatedAt: sql`(CURRENT_TIMESTAMP)`
          }
        });
      console.log('✅ Google OAuth tokens saved to database');
      return true;
    } catch (error) {
      console.error('Error saving Google OAuth token:', error);
      throw error;
    }
  },

  async getRevenueProgress(month: string) {
    // Get the goal for the month
    const goal = await this.getMonthlyGoal(month);
    if (!goal) return { goal: null, currentRevenue: 0, progress: 0 };

    // Calculate current NET revenue for the month from bookings (same logic as getDailyRevenue)
    // Use proper month range calculation (same as frontend)
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of the month
    
    // Use local-date strings (avoid UTC shift) to match frontend range
    const toLocalYmd = (d: Date) => {
      const tz = d.getTimezoneOffset();
      const local = new Date(d.getTime() - tz * 60000);
      return local.toISOString().split('T')[0];
    };
    const startDateStr = toLocalYmd(startDate);
    const endDateStr = toLocalYmd(endDate);
    
    // Get all bookings for the month
    const monthBookings = await db.query.bookings.findMany({
      where: and(
        gte(bookings.bookingDate, startDateStr),
        lte(bookings.bookingDate, endDateStr)
      )
    });

    // Helper to compute net amounts (same as getDailyRevenue)
    const computeNet = (b: any) => {
      const total = Number(b.totalAmount || 0);
      const isRefunded = (b.refundStatus === 'approved');
      const refund = isRefunded ? Math.max(0, Math.min(Number(b.refundAmount || 0), total)) : 0;
      const netTotal = Math.max(0, total - refund);
      return { netTotal };
    };

    // Calculate net revenue (after refunds)
    const currentRevenue = monthBookings.reduce((sum, b) => {
      const { netTotal } = computeNet(b);
      return sum + netTotal;
    }, 0);

    const progress = goal.goalAmount > 0 ? (currentRevenue / goal.goalAmount) * 100 : 0;

    return {
      goal,
      currentRevenue,
      progress: Math.min(progress, 100) // Cap at 100%
    };
  },

  async checkAndCreateRevenueNotifications(month: string) {
    const progress = await this.getRevenueProgress(month);
    if (!progress.goal) return { created: 0 };

    const today = new Date();
    const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    
    // Only check for current month
    if (month !== currentMonth) return { created: 0 };

    const dayOfMonth = today.getDate();
    const isMiddleOfMonth = dayOfMonth >= 14 && dayOfMonth <= 16; // Mid-month check

    let created = 0;

    // Check if revenue is below 50% by mid-month
    if (isMiddleOfMonth && progress.progress < 50) {
      const admins = await db.query.users.findMany({ where: eq(users.role as any, 'admin') as any });
      
      // Check if notification already exists for this month
      const existingNotification = await db.query.notifications.findFirst({
        where: and(
          eq(notifications.type as any, 'revenue-alert'),
          eq(notifications.relatedId as any, `${month}-midmonth`)
        )
      });

      if (!existingNotification) {
        for (const admin of admins as any[]) {
          await db.insert(notifications).values({
            userId: admin.id,
            title: 'Revenue Below Target',
            body: `Revenue below 50% of target at mid-month (${progress.progress.toFixed(1)}%). Please review strategy.`,
            type: 'revenue-alert',
            relatedType: 'revenue',
            relatedId: `${month}-midmonth`,
          });
          created++;
        }
      }
    }

    return { created };
  },

  async checkCancellationRate() {
    // Get bookings from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const totalBookings = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(bookings)
      .where(gte(bookings.bookingDate, startDate));

    const cancelledBookings = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(bookings)
      .where(and(
        gte(bookings.bookingDate, startDate),
        eq(bookings.refundStatus as any, 'approved')
      ));

    const total = totalBookings[0]?.count || 0;
    const cancelled = cancelledBookings[0]?.count || 0;
    const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;

    let created = 0;

    // If cancellation rate > 20%, notify admins
    if (cancellationRate > 20) {
      const admins = await db.query.users.findMany({ where: eq(users.role as any, 'admin') as any });
      
      // Check if notification already exists for today
      const today = new Date().toISOString().split('T')[0];
      const existingNotification = await db.query.notifications.findFirst({
        where: and(
          eq(notifications.type as any, 'cancellation-alert'),
          eq(notifications.relatedId as any, today)
        )
      });

      if (!existingNotification) {
        for (const admin of admins as any[]) {
          await db.insert(notifications).values({
            userId: admin.id,
            title: 'High Cancellation Rate Detected',
            body: `Cancellation rate is ${cancellationRate.toFixed(1)}% (${cancelled}/${total} bookings). Investigate immediately.`,
            type: 'cancellation-alert',
            relatedType: 'bookings',
            relatedId: today,
          });
          created++;
        }
      }
    }

    return { created, cancellationRate, total, cancelled };
  },

  async markNotificationAsRead(notificationId: string, userId: string) {
    // Verify the notification belongs to the user
    const notification = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const updated = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning();

    return updated[0];
  },
};
