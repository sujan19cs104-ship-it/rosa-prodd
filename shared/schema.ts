import { sql } from "drizzle-orm";
import {
  index,
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: text("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Users
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .default(
      sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' ||
           substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
    ),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  passwordHash: text("password_hash"),
  role: text("role").default("employee"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Bookings
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  theatreName: text("theatre_name").notNull(),
  timeSlot: text("time_slot").notNull(),
  guests: integer("guests").notNull(),
  customerName: text("customer_name").notNull(),
  phoneNumber: text("phone_number"),
  age: integer("age"),
  totalAmount: real("total_amount").notNull().default(0),
  cashAmount: real("cash_amount").notNull().default(0),
  upiAmount: real("upi_amount").notNull().default(0),
  snacksAmount: real("snacks_amount").notNull().default(0),
  snacksCash: real("snacks_cash").notNull().default(0),
  snacksUpi: real("snacks_upi").notNull().default(0),
  bookingDate: text("booking_date").notNull(),
  isEighteenPlus: integer("is_eighteen_plus", { mode: "boolean" }).notNull().default(true),
  eighteenPlusReason: text("eighteen_plus_reason"),
  eighteenPlusDescription: text("eighteen_plus_description"),
  visited: integer("visited", { mode: "boolean" }).notNull().default(true),
  visitedReason: text("visited_reason"),
  visitedDescription: text("visited_description"),
  repeatCount: integer("repeat_count").notNull().default(0),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
  // Refund fields
  refundStatus: text("refund_status").default('none'), // none | pending | approved | rejected
  refundAmount: real("refund_amount").notNull().default(0),
  refundReason: text("refund_reason"),
  refundedAt: text("refunded_at"),
  refundRequestedBy: text("refund_requested_by").references(() => users.id),
  refundApprovedBy: text("refund_approved_by").references(() => users.id),
  // Review flag to indicate customer has confirmed leaving a review
  reviewFlag: integer("review_flag", { mode: "boolean" }).notNull().default(false),
});

// Expenses
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  expenseDate: text("expense_date").notNull(),
  // Optional payment breakdown
  paidCash: real("paid_cash"),
  paidUpi: real("paid_upi"),
  // Explicit paid method label: 'cash' | 'upi' | 'both'
  paidVia: text("paid_via"),
  // Name entered in the form for who created this expense
  creatorName: text("creator_name"),
  // Authenticated user id who saved the expense
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Ad Spends
export const adSpends = sqliteTable("ad_spends", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  date: text("date").notNull(), // stored as YYYY-MM-DD
  platform: text("platform").notNull().default('Meta Ads'),
  campaignName: text("campaign_name").notNull(),
  adSetName: text("ad_set_name"),
  adName: text("ad_name"),
  adSpend: real("ad_spend").notNull().default(0),
  totalLeads: integer("total_leads").notNull().default(0),
  goodLeads: integer("good_leads").notNull().default(0),
  badLeads: integer("bad_leads").notNull().default(0),
  salesCount: integer("sales_count"), // optional
  revenue: real("revenue"), // optional
  impressions: integer("impressions"), // optional (for funnel)
  clicks: integer("clicks"), // optional (for funnel)
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Leave Applications (enhanced)
export const leaveApplications = sqliteTable("leave_applications", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  userId: text("user_id").references(() => users.id).notNull(),
  leaveType: text("leave_type").notNull().default('PTO'),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  partialDay: text("partial_day"), // e.g., 'AM', 'PM', 'HOURS' or null for full day
  reason: text("reason").notNull(),
  // Coverage and keys holder - either id or free text
  keysHolderId: text("keys_holder_id").references(() => users.id),
  keysHolderName: text("keys_holder_name"),
  coverageById: text("coverage_by_id").references(() => users.id),
  coverageByName: text("coverage_by_name"),
  // Attachments and flags
  attachDocumentUrl: text("attach_document_url"),
  compOffUsed: integer("comp_off_used", { mode: "boolean" }).default(false),
  // Approvals and overrides
  status: text("status").default("pending"),
  overrideOneDayRule: integer("override_one_day_rule", { mode: "boolean" }).default(false),
  overrideReason: text("override_reason"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Leave Types
export const leaveTypes = sqliteTable("leave_types", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  code: text("code").notNull(), // e.g., 'SICK', 'CASUAL', 'PTO', 'COMPOFF'
  name: text("name").notNull(),
  defaultAnnual: integer("default_annual").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// Leave Balances (per user, per type, per year)
export const leaveBalances = sqliteTable("leave_balances", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  userId: text("user_id").references(() => users.id).notNull(),
  leaveTypeCode: text("leave_type_code").notNull(),
  year: integer("year").notNull(),
  allocated: real("allocated").notNull().default(0),
  used: real("used").notNull().default(0),
  carriedOver: real("carried_over").notNull().default(0),
});

// Notifications
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  userId: text("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type").default('leave'),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Activity Logs
export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  userId: text("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: text("details"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Calendar Events
export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  bookingId: text("booking_id").references(() => bookings.id).notNull(),
  googleCalendarEventId: text("google_calendar_event_id"),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  location: text("location"),
  status: text("status").default("confirmed"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Sales Reports
export const salesReports = sqliteTable("sales_reports", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  reportDate: text("report_date").notNull(),
  totalRevenue: real("total_revenue").notNull().default(0),
  foodSales: real("food_sales").notNull().default(0),
  screenSales: real("screen_sales").notNull().default(0),
  totalBookings: integer("total_bookings").notNull().default(0),
  totalGuests: integer("total_guests").notNull().default(0),
  avgBookingValue: real("avg_booking_value").notNull().default(0),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Revenue Goals (monthly)
export const revenueGoals = sqliteTable("revenue_goals", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  month: text("month").notNull(), // YYYY-MM
  goalAmount: integer("goal_amount").notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Daily Income
export const dailyIncome = sqliteTable("daily_income", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) ||
         substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  date: text("date").notNull(), // stored as YYYY-MM-DD
  numberOfShows: integer("number_of_shows").notNull(),
  cashReceived: real("cash_received").notNull().default(0),
  upiReceived: real("upi_received").notNull().default(0),
  otherPayments: real("other_payments").notNull().default(0),
  notes: text("notes"),
  // Aggregates that consider refunds (optional computed/denormalized fields)
  adjustedShows: integer("adjusted_shows"),
  adjustedRevenue: real("adjusted_revenue"),
  refundTotal: real("refund_total"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Customer Tickets
export const customerTickets = sqliteTable("customer_tickets", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  bookingId: text("booking_id").references(() => bookings.id).notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  // Optional denormalized time slot for easier filtering without join
  timeSlot: text("time_slot"),
  status: text("status").default("open"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
  deletedAt: text("deleted_at"),
});

// Reviews table for customer review collection
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  bookingId: text("booking_id").references(() => bookings.id).notNull(),
  phone: text("phone"),
  name: text("name"),
  token: text("token").notNull(),
  status: text("status").default("pending"), // pending | submitted | verified | expired
  requestedAt: text("requested_at").default(sql`(CURRENT_TIMESTAMP)`),
  submittedAt: text("submitted_at"),
  verifiedAt: text("verified_at"),
  verificationMethod: text("verification_method"), // 'gmaps' | 'manual'
  gmapsPlaceId: text("gmaps_place_id"),
  gmapsReviewId: text("gmaps_review_id"),
  note: text("note"),
});

// Lead Info (daily shift-based lead tracking)
export const leadInfos = sqliteTable("lead_infos", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  date: text("date").notNull(), // YYYY-MM-DD
  shift: text("shift").notNull(), // 'morning' | 'evening'
  source: text("source").notNull(), // Instagram | Facebook | Website | GMaps | Others
  totalLeads: integer("total_leads").notNull().default(0),
  goodLeads: integer("good_leads").notNull().default(0),
  badLeads: integer("bad_leads").notNull().default(0),
  callsMade: integer("calls_made").notNull().default(0),
  description: text("description"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const insertLeadInfoSchema = createInsertSchema(leadInfos).omit({
  id: true,
  createdAt: true,
  createdBy: true,
}).extend({
  date: z.string().min(1),
  shift: z.enum(["morning", "evening"]),
  source: z.enum(["Instagram", "Facebook", "Website", "GMaps", "Others"]),
  totalLeads: z.coerce.number().min(0),
  goodLeads: z.coerce.number().min(0),
  badLeads: z.coerce.number().min(0),
  callsMade: z.coerce.number().min(0),
  description: z.string().optional(),
});

// Feedbacks
export const feedbacks = sqliteTable("feedbacks", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  bookingId: text("booking_id").references(() => bookings.id).notNull(),
  // Denormalized helpers for filtering without heavy joins
  bookingDate: text("booking_date"),
  timeSlot: text("time_slot"),
  theatreName: text("theatre_name"),
  // Denormalized customer info to ensure display even if booking is missing
  customerName: text("customer_name"),
  phoneNumber: text("phone_number"),
  collected: integer("collected", { mode: "boolean" }).notNull().default(true),
  reason: text("reason"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Follow Ups
export const followUps = sqliteTable("follow_ups", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  bookingId: text("booking_id").references(() => bookings.id),
  customerName: text("customer_name"),
  phoneNumber: text("phone_number"),
  reason: text("reason"),
  type: text("type").default('feedback'),
  status: text("status").default('pending'),
  dueAt: text("due_at"),
  completedAt: text("completed_at"),
  notifiedOverdueAt: text("notified_overdue_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Configurations
export const configurations = sqliteTable("configurations", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Login Tracker
export const loginTracker = sqliteTable("login_tracker", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`
  ),
  userId: text("user_id").references(() => users.id).notNull(),
  email: text("email"),
  loginTime: text("login_time").notNull(),
  logoutTime: text("logout_time"),
  sessionDurationSec: integer("session_duration_sec"),
  deviceType: text("device_type"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

// Refund Requests
export const refundRequests = sqliteTable("refund_requests", {
  id: text("id").primaryKey().default(
    sql`(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)) )`
  ),
  bookingId: text("booking_id").references(() => bookings.id).notNull(),
  amount: real("amount").notNull().default(0),
  reason: text("reason").notNull(),
  status: text("status").notNull().default('pending'), // pending | approved | rejected
  requestedBy: text("requested_by").references(() => users.id).notNull(),
  approvedBy: text("approved_by").references(() => users.id),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

/* ---------------- SCHEMAS ---------------- */

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  repeatCount: true,
  // Refund fields are server-managed
  refundStatus: true,
  refundAmount: true,
  refundReason: true,
  refundedAt: true,
  refundRequestedBy: true,
  refundApprovedBy: true,
}).extend({
  guests: z.coerce.number().min(1),
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().min(10).max(15).optional(),
  age: z.coerce.number().min(1).max(120).optional(),
  totalAmount: z.coerce.number().min(0),
  cashAmount: z.coerce.number().min(0),
  upiAmount: z.coerce.number().min(0),
  snacksAmount: z.coerce.number().min(0).optional(),
  snacksCash: z.coerce.number().min(0).optional(),
  snacksUpi: z.coerce.number().min(0).optional(),
  isEighteenPlus: z.boolean().default(true),
  eighteenPlusReason: z.string().optional(),
  eighteenPlusDescription: z.string().optional(),
  visited: z.boolean().default(true),
  visitedReason: z.string().optional(),
  visitedDescription: z.string().optional(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdBy: true,
  createdAt: true,
}).extend({
  amount: z.coerce.number().min(0),
  creatorName: z.string().optional(),
  paidCash: z.coerce.number().optional(),
  paidUpi: z.coerce.number().optional(),
  paidVia: z.enum(['cash','upi','both']).optional(),
});

// Ad Spend insert schema
export const insertAdSpendSchema = createInsertSchema(adSpends).omit({
  id: true,
  createdBy: true,
  createdAt: true,
}).extend({
  date: z.string().min(1), // YYYY-MM-DD
  platform: z.string().min(1).default('Meta Ads'),
  campaignName: z.string().min(1),
  adSetName: z.string().optional(),
  adName: z.string().optional(),
  adSpend: z.coerce.number().min(0),
  totalLeads: z.coerce.number().min(0),
  goodLeads: z.coerce.number().min(0),
  badLeads: z.coerce.number().min(0),
  salesCount: z.coerce.number().min(0).optional(),
  revenue: z.coerce.number().min(0).optional(),
  impressions: z.coerce.number().min(0).optional(),
  clicks: z.coerce.number().min(0).optional(),
});

export const insertLeaveApplicationSchema = createInsertSchema(leaveApplications).omit({
  id: true,
  userId: true, // server injects from session
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
}).extend({
  leaveType: z.string().min(1),
  partialDay: z.string().optional(),
  // Either ID or Name may be provided, but not mandatory now
  keysHolderId: z.string().optional(),
  keysHolderName: z.string().optional(),
  coverageById: z.string().optional(),
  coverageByName: z.string().optional(),
  attachDocumentUrl: z.string().url().optional(),
  // Removed comp-off and override requirements
  compOffUsed: z.boolean().optional(),
  overrideOneDayRule: z.boolean().optional(),
  overrideReason: z.string().optional(),
}).superRefine((data, ctx) => {
  // Relaxed: no mandatory keys holder / coverage
  // Relaxed: no 1-day advance enforcement
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,   // ✅ fixed camelCase
  lastName: true,    // ✅ fixed camelCase
  profileImageUrl: true,
  role: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesReportSchema = createInsertSchema(salesReports).omit({
  id: true,
  createdBy: true,
  createdAt: true,
});

// Daily Income insert schema
export const insertDailyIncomeSchema = createInsertSchema(dailyIncome).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  adjustedShows: true,
  adjustedRevenue: true,
  refundTotal: true,
}).extend({
  date: z.string().min(1), // YYYY-MM-DD
  numberOfShows: z.coerce.number().min(1),
  cashReceived: z.coerce.number().min(0),
  upiReceived: z.coerce.number().min(0),
  otherPayments: z.coerce.number().min(0),
  notes: z.string().optional(),
});

export const insertConfigurationSchema = createInsertSchema(configurations).omit({
  updatedAt: true,
});

export const insertCustomerTicketSchema = createInsertSchema(customerTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  createdBy: true,
});

export const insertRevenueGoalSchema = createInsertSchema(revenueGoals).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  goalAmount: z.coerce.number().min(1, "Goal amount must be greater than 0"),
});

/* ---------------- TYPES ---------------- */
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertLeadInfo = z.infer<typeof insertLeadInfoSchema>;
export type LeadInfo = typeof leadInfos.$inferSelect;
export type InsertAdSpend = z.infer<typeof insertAdSpendSchema>;
export type AdSpend = typeof adSpends.$inferSelect;
export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;
export type Configuration = typeof configurations.$inferSelect;
export type InsertLeaveApplication = z.infer<typeof insertLeaveApplicationSchema>;
export type LeaveApplication = typeof leaveApplications.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertSalesReport = z.infer<typeof insertSalesReportSchema>;
export type SalesReport = typeof salesReports.$inferSelect;
export type InsertDailyIncome = z.infer<typeof insertDailyIncomeSchema>;
export type DailyIncome = typeof dailyIncome.$inferSelect;
export type InsertCustomerTicket = z.infer<typeof insertCustomerTicketSchema>;
export type CustomerTicket = typeof customerTickets.$inferSelect;
export type InsertRevenueGoal = z.infer<typeof insertRevenueGoalSchema>;
export type RevenueGoal = typeof revenueGoals.$inferSelect;
export type RefundRequest = typeof refundRequests.$inferSelect;
