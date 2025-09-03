import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./devAuth";
import {
  insertBookingSchema,
  insertExpenseSchema,
  insertLeaveApplicationSchema,
  insertCustomerTicketSchema,
  insertLeadInfoSchema,
  type Booking,
} from "@shared/schema";
import session from "express-session";
import bcrypt from "bcryptjs";
import { syncGoogleCalendarToBookings } from "./jobs/sync-google-calendar";
import { google } from 'googleapis';
import fs from 'fs';

// Receiver: Google Calendar push or custom webhook to create bookings
// POST /api/webhooks/booking { title, startTime, endTime, theatreName?, guests?, customerName?, phoneNumber? }
// GET /api/webhooks/booking?code=... (OAuth callback)
export function registerWebhookRoutes(app: Express) {
  // Handle Google OAuth callback (GET request with code parameter)
  app.get('/api/webhooks/booking', async (req: any, res) => {
    try {
      const code = req.query.code;
      const error = req.query.error;
      
      if (error) {
        console.error('OAuth error:', error);
        return res.status(400).send(`OAuth error: ${error}`);
      }
      
      if (!code) {
        return res.status(400).send('Missing authorization code');
      }
      
      // Load credentials from environment variables
      const client_id = process.env.GOOGLE_CLIENT_ID;
      const client_secret = process.env.GOOGLE_CLIENT_SECRET;
      const redirect_uri = process.env.GOOGLE_REDIRECT_URI;
      
      if (!client_id || !client_secret || !redirect_uri) {
        return res.status(500).send('Missing Google OAuth configuration');
      }
      
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
      
      try {
        const { tokens } = await oAuth2Client.getToken({ code, redirect_uri });
        
        // Save tokens to token.json
        fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
        console.log('✅ Google OAuth token saved successfully');
        
        res.status(200).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: green;">✅ Authorization Complete!</h2>
              <p>Google Calendar sync has been successfully configured.</p>
              <p>You can now close this window and return to your application.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      } catch (tokenError) {
        console.error('Error exchanging code for tokens:', tokenError);
        res.status(500).send('Failed to exchange authorization code for tokens');
      }
    } catch (e) {
      console.error('OAuth callback error:', e);
      res.status(500).send('Internal server error during OAuth callback');
    }
  });

  // Handle booking creation (POST request)
  app.post('/api/webhooks/booking', async (req: any, res) => {
    try {
      const body = req.body || {};
      const startIso = body.startTime;
      const endIso = body.endTime;
      if (!startIso || !endIso) return res.status(400).json({ message: 'startTime and endTime required' });

      const pad = (n: number) => String(n).padStart(2, '0');
      const start = new Date(startIso);
      const end = new Date(endIso);
      const bookingDate = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
      const timeSlot = `${pad(start.getHours())}:${pad(start.getMinutes())}-${pad(end.getHours())}:${pad(end.getMinutes())}`;

      // Optional mapping from title if provided
      let theatreName = body.theatreName || 'Screen-1';
      let guests = typeof body.guests === 'number' ? body.guests : 2;
      let customerName = body.customerName || 'Walk-in';
      let phoneNumber = body.phoneNumber || undefined;

      if (body.title && !body.theatreName) {
        try {
          const parts = String(body.title).split(' - ').map((s: string) => s.trim());
          if (parts[0]) theatreName = parts[0];
          if (parts[1] && /\d+/.test(parts[1])) guests = parseInt(parts[1].match(/\d+/)![0], 10);
          if (parts[2] && !body.customerName) {
            customerName = parts[2].replace(/\((.*?)\)/, (m: any, p1: string) => { phoneNumber = phoneNumber || p1; return ''.trim(); }).trim();
          }
        } catch {}
      }

      // Deduplicate if phone provided
      if (phoneNumber) {
        const exists = await storage.getBookingByPhoneDateAndSlot(phoneNumber, bookingDate, timeSlot);
        if (exists) return res.json({ ok: true, deduped: true, bookingId: exists.id });
      }

      const booking = await storage.createBooking({
        theatreName,
        timeSlot,
        guests,
        customerName,
        phoneNumber,
        totalAmount: 0,
        cashAmount: 0,
        upiAmount: 0,
        snacksAmount: 0,
        snacksCash: 0,
        snacksUpi: 0,
        bookingDate,
        isEighteenPlus: true,
        visited: true,
        repeatCount: 0,
        createdBy: null,
      });
      res.json({ ok: true, booking });
    } catch (e) {
      console.error('booking webhook error', e);
      res.status(500).json({ ok: false });
    }
  });
}

// Calendar webhook helper function
async function createCalendarEvent(booking: Booking) {
  const startTime = new Date(
    `${booking.bookingDate}T${booking.timeSlot.split("-")[0]}:00`,
  );
  const endTime = new Date(
    `${booking.bookingDate}T${booking.timeSlot.split("-")[1]}:00`,
  );

  // Include phone number in description if available
  const phoneInfo = booking.phoneNumber
    ? ` Phone: ${booking.phoneNumber}.`
    : "";

  const calendarEvent = {
    bookingId: booking.id,
    title: `${booking.theatreName} Booking - ${booking.guests} guests`,
    description: `Theatre booking for ${booking.guests} guests. Total: ₹${booking.totalAmount}.${phoneInfo} Created by: ${booking.createdBy}`,
    startTime,
    endTime,
    location: booking.theatreName,
  };

  const created = await storage.createCalendarEvent(calendarEvent);

  // Notify external calendar integration (include phone explicitly)
  try {
    await sendWebhookNotification("create", {
      bookingId: booking.id,
      eventData: {
        ...calendarEvent,
        phoneNumber: booking.phoneNumber || null,
      },
    });
  } catch {}

  return created;
}

// Webhook endpoint for calendar integration
async function sendWebhookNotification(action: string, data: any) {
  // This would integrate with external calendar APIs like Google Calendar
  // For now, we'll just log the webhook data
  console.log(`Calendar webhook: ${action}`, data);
}



export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "rosae-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Direct login endpoint for testing
  app.get("/api/direct-login", async (req: any, res) => {
    try {
      // Create a simple admin user
      const adminUser = {
        id: "admin-001",
        email: "admin@rosae.com",
        firstName: "Admin",
        lastName: "User",
        profileImageUrl: null,
        role: "admin",
      };

      // Create the user in the database using direct SQL
      try {
        console.log("Creating user in database:", adminUser);
        // Use direct SQL to insert or replace the admin user
        const db = require("./db").db;
        await db.execute(
          `
          INSERT OR REPLACE INTO users (id, email, first_name, last_name, profile_image_url, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
          [
            adminUser.id,
            adminUser.email,
            adminUser.firstName,
            adminUser.lastName,
            adminUser.profileImageUrl,
            adminUser.role,
          ],
        );
        console.log("User created successfully via SQL");
      } catch (dbError) {
        console.error("Error creating user in database:", dbError);
        // Continue anyway - the session will still work
      }

      // Set up the session directly
      req.session.user = {
        claims: {
          sub: adminUser.id,
          email: adminUser.email,
          first_name: adminUser.firstName,
          last_name: adminUser.lastName,
          profile_image_url: adminUser.profileImageUrl,
        },
        access_token: "dev-token",
      };

      // Save session explicitly before redirecting
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session save failed" });
        }
        console.log("Session saved successfully:", req.session);
        // Respond with JSON instead of redirect for testing
        res.json({
          success: true,
          message: "Logged in successfully",
          user: adminUser,
        });
      });
    } catch (error) {
      console.error("Direct login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Auth routes
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      // Check if user is authenticated via session
      const sessionUser = (req as any).session?.user;

      if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized - Please login" });
      }

      // Return the user data from session
      res.json({
        id: sessionUser.claims.sub,
        email: sessionUser.claims.email,
        firstName: sessionUser.claims.first_name,
        lastName: sessionUser.claims.last_name,
        profileImageUrl: sessionUser.claims.profile_image_url,
        role: "admin", // Default to admin for development
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt:", req.body);
      const { email, password } = req.body;

      if (!email || !password) {
        console.log("Missing email or password");
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      console.log("Checking credentials:", { email, password });

      // Helper to set session and log login
      const finalizeLogin = async (user: any) => {
        (req as any).session.user = {
          claims: {
            sub: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            profile_image_url: user.profileImageUrl || null,
          },
          access_token: "dev-token",
        };
        console.log("Session set:", (req as any).session);

        // Log login
        try {
          await storage.logLogin({
            userId: user.id,
            email: user.email,
            deviceType: (req.headers["sec-ch-ua-platform"] as string) || null,
            userAgent: req.headers["user-agent"] as string,
            ipAddress: (req.headers["x-forwarded-for"] as string) || (req.socket.remoteAddress || null) as any,
          });
        } catch (e) {
          console.error("Failed to log login event:", e);
        }

        return res.json(user);
      };

      // Check if it's admin login
      if (email === "admin@rosae.com" && password === "Rosae@spaces") {
        console.log("Admin credentials valid");
        const user = {
          id: "admin-001",
          email: "admin@rosae.com",
          firstName: "Admin",
          lastName: "User",
          role: "admin",
        };

        // Ensure admin user exists in database
        try {
          await storage.upsertUser({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: null,
            role: user.role,
            active: true,
          });
          console.log("Admin user created/updated in database");
        } catch (dbError) {
          console.error("Error creating admin user in database:", dbError);
        }

        return await finalizeLogin(user);
      } else {
        // Check for employee login
        try {
          console.log("=== EMPLOYEE LOGIN DEBUG ===");
          console.log("Email provided:", email);
          console.log("Password provided:", password);

          const user = await storage.getUserByEmail(email);
          console.log(
            "Database lookup result:",
            user
              ? {
                  id: user.id,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  role: user.role,
                  hasPasswordHash: !!user.passwordHash,
                  passwordHashLength: user.passwordHash
                    ? user.passwordHash.length
                    : 0,
                }
              : "User not found",
          );

          if (user && user.passwordHash) {
            console.log("Attempting password comparison...");
            const isValidPassword = await bcrypt.compare(
              password,
              user.passwordHash,
            );
            console.log("Password comparison result:", isValidPassword);

            if (isValidPassword) {
              console.log("✅ Employee login successful for:", user.email);

              return await finalizeLogin({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImageUrl: user.profileImageUrl,
                role: user.role,
              });
            } else {
              console.log("❌ Invalid password for employee:", user.email);
              res.status(401).json({ message: "Invalid credentials" });
            }
          } else {
            console.log("❌ User not found or missing password hash");
            res.status(401).json({ message: "Invalid credentials" });
          }
        } catch (error) {
          console.error("❌ Error during employee login:", error);
          res.status(401).json({ message: "Invalid credentials" });
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", async (req: any, res) => {
    try {
      const userId = req.session?.user?.claims?.sub;
      if (userId) {
        try { await storage.logLogout(userId); } catch (e) { console.error('Failed to log logout:', e); }
      }
    } catch {}

    req.session.destroy((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Quick sign-in endpoint for customers by name + phone
  app.post('/api/auth/quick-signin', async (req: any, res) => {
    try {
      const { name, phone } = req.body || {};
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ message: 'phone is required' });
      }
      // Basic rate limit by IP+phone (in-memory for now)
      (global as any).__qs ||= new Map<string, { count: number; ts: number }>();
      const key = `${req.ip}:${phone}`;
      const entry = (global as any).__qs.get(key) || { count: 0, ts: Date.now() };
      if (Date.now() - entry.ts < 60_000 && entry.count >= 5) {
        return res.status(429).json({ message: 'Too many attempts. Try again later.' });
      }
      entry.count = (Date.now() - entry.ts > 60_000) ? 1 : entry.count + 1;
      entry.ts = (Date.now() - entry.ts > 60_000) ? Date.now() : entry.ts;
      (global as any).__qs.set(key, entry);

      // Find bookings by phone
      const bookings = await storage.getBookingsByPhoneNumber(phone);
      if (!bookings?.length) {
        return res.status(404).json({ message: 'No bookings found for this phone' });
      }
      // Minimal pseudo-user session keyed by phone
      (req as any).session.user = {
        claims: {
          sub: `guest-${phone}`,
          email: `${phone}@guest.local`,
          first_name: name || 'Guest',
          last_name: '',
          profile_image_url: null,
        },
        access_token: 'guest-token'
      };
      res.json({ bookings });
    } catch (e) {
      console.error('quick-signin error', e);
      res.status(500).json({ message: 'Failed to quick sign-in' });
    }
  });

  // Debug endpoint to check session
  app.get("/api/debug/session", async (req, res) => {
    const sessionUser = (req as any).session?.user;
    res.json({
      hasSession: !!sessionUser,
      sessionData: sessionUser ? {
        email: sessionUser.claims?.email,
        role: sessionUser.claims?.role,
        sub: sessionUser.claims?.sub
      } : null
    });
  });

  // Example webhook receiver (external systems can POST here if configured)
  app.post('/api/integrations/reviews-webhook', async (req, res) => {
    try {
      const { type, data } = req.body || {};
      if (type === 'review.submitted' && data?.bookingId) {
        await storage.updateBooking(data.bookingId, { reviewFlag: true, updatedAt: new Date().toISOString() });
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('reviews webhook error', e);
      res.status(500).json({ ok: false });
    }
  });

  // Admin utility: clear all data except users and configurations
  app.post('/api/admin/clear-data', async (req: any, res) => {
    try {
      const sessionUser = req.session?.user;
      const email = sessionUser?.claims?.email as string | undefined;
      if (!email || email !== 'admin@rosae.com') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const result = await storage.clearAllDataExceptUsersAndConfig();
      res.json(result);
    } catch (e) {
      console.error('clear-data error', e);
      res.status(500).json({ message: 'Failed to clear data' });
    }
  });

  // Reviews API
  app.get('/api/reviews/config', async (req, res) => {
    try {
      // prevent caches from serving stale null
      res.set('Cache-Control', 'no-store');

      // Support multiple env names for flexibility
      const get = (k: string) => (process.env as any)?.[k];
      let reviewOverride = get('REVIEW_OVERRIDE') || get('GOOGLE_REVIEW_URL') || get('REVIEW_URL') || undefined;
      let placeId = get('PLACE_ID') || get('GOOGLE_PLACE_ID') || undefined;
      console.log(`[reviews/config] env reviewOverride=${reviewOverride || '<undefined>'} placeId=${placeId || '<undefined>'}`);

      // Fallback: read from .env using process.cwd() and dist-relative path
      if (!reviewOverride && !placeId) {
        try {
          const { fileURLToPath } = await import('url');
          const path = await import('path');
          const fs = await import('fs');
          const cwdEnv = path.resolve(process.cwd(), '.env');
          const here = fileURLToPath(import.meta.url);
          const hereDir = path.dirname(here);
          const distEnv = path.resolve(hereDir, '..', '.env');
          const candidates = [cwdEnv, distEnv];
          console.log(`[reviews/config] probing .env candidates: ${candidates.join(', ')}`);
          for (const p of candidates) {
            if (fs.existsSync(p)) {
              console.log(`[reviews/config] reading env from: ${p}`);
              const content = await fs.promises.readFile(p, 'utf-8');
              for (const line of content.split(/\r?\n/)) {
                const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
                if (m) {
                  const key = m[1];
                  const val = m[2].replace(/^['\"]|['\"]$/g, '');
                  if ((key === 'REVIEW_OVERRIDE' || key === 'GOOGLE_REVIEW_URL' || key === 'REVIEW_URL') && !reviewOverride) reviewOverride = val;
                  if ((key === 'PLACE_ID' || key === 'GOOGLE_PLACE_ID') && !placeId) placeId = val;
                }
              }
              if (reviewOverride || placeId) break;
            }
          }
        } catch (e) {
          console.log('[reviews/config] fallback .env read failed', e);
        }
      }

      const reviewUrl = reviewOverride
        ? reviewOverride
        : placeId
          ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
          : null;
      console.log(`[reviews/config] resolved reviewUrl=${reviewUrl || '<null>'}`);
      return res.json({ reviewUrl });
    } catch (e) {
      res.set('Cache-Control', 'no-store');
      console.log('[reviews/config] error', e);
      return res.json({ reviewUrl: null });
    }
  });

  app.post('/api/reviews/request', async (req: any, res) => {
    try {
      const { bookingId } = req.body || {};
      if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      const review = await storage.createReviewRequest({ bookingId, name: booking.customerName, phone: booking.phoneNumber });
      const base = process.env.PUBLIC_BASE_URL || (req.protocol + '://' + req.get('host'));
      const get = (k: string) => (process.env as any)?.[k];
      const reviewOverride = get('REVIEW_OVERRIDE') || get('GOOGLE_REVIEW_URL') || get('REVIEW_URL') || undefined;
      const placeId = get('PLACE_ID') || get('GOOGLE_PLACE_ID') || undefined;
      const reviewUrl = reviewOverride
        ? reviewOverride
        : placeId
          ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
          : `${base}/reviews?token=${encodeURIComponent(review.token)}`;
      return res.json({ token: review.token, reviewUrl, review });
    } catch (e) {
      console.error('reviews/request error', e);
      return res.status(500).json({ message: 'Failed to create review request' });
    }
  });

  app.post('/api/reviews/confirm', async (req: any, res) => {
    try {
      const { token, note } = req.body || {};
      if (!token) return res.status(400).json({ message: 'token is required' });
      // Defensive: trim and strip wrapping quotes to avoid copy/paste artifacts
      const t = String(token).trim().replace(/^['"]|['"]$/g, '');
      const review = await storage.getReviewByToken(t);
      if (!review) return res.status(404).json({ message: 'Invalid token' });
      // Token expiry: 72 hours
      const requestedAt = new Date(review.requestedAt || Date.now());
      if (Date.now() - requestedAt.getTime() > 72 * 60 * 60 * 1000) {
        return res.status(410).json({ message: 'Token expired' });
      }
      const updated = await storage.markReviewSubmitted(t, { note });
      // Mark booking flag
      if (review.bookingId) {
        await storage.updateBooking(review.bookingId, { reviewFlag: true, updatedAt: new Date().toISOString() });
      }
      // Emit internal webhook/event
      try {
        console.log('event: review.submitted', { reviewId: updated?.id, bookingId: review.bookingId });
        // Example webhook call (disabled by default)
        const webhook = process.env.REVIEWS_WEBHOOK_URL;
        if (webhook) {
          fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'review.submitted', data: { reviewId: updated?.id, bookingId: review.bookingId } }) }).catch(() => {});
        }
      } catch {}
      return res.json({ success: true });
    } catch (e) {
      console.error('reviews/confirm error', e);
      return res.status(500).json({ message: 'Failed to confirm review' });
    }
  });

  // Check auth status
  app.get("/api/auth/status", async (req, res) => {
    const sessionUser = (req as any).session?.user;

    if (sessionUser && sessionUser.claims) {
      try {
        // First try to get the user by ID (sub claim)
        let user = null;
        if (sessionUser.claims.sub) {
          user = await storage.getUser(sessionUser.claims.sub);
        }

        // If not found by ID, try by email
        if (!user && sessionUser.claims.email) {
          user = await storage.getUserByEmail(sessionUser.claims.email);
        }



        const userData = {
          id: sessionUser.claims.sub,
          email: sessionUser.claims.email,
          firstName: sessionUser.claims.first_name,
          lastName: sessionUser.claims.last_name,
          profileImageUrl: sessionUser.claims.profile_image_url,
          role:
            user?.role ||
            (sessionUser.claims.email === "admin@rosae.com" || sessionUser.claims.email === "rosaeleisure@gmail.com"
              ? "admin"
              : "employee"),
        };
        res.json({ authenticated: true, user: userData });
      } catch (error) {
        console.error("Error fetching user data:", error);
        // Fallback to session data
        const userData = {
          id: sessionUser.claims.sub,
          email: sessionUser.claims.email,
          firstName: sessionUser.claims.first_name,
          lastName: sessionUser.claims.last_name,
          profileImageUrl: sessionUser.claims.profile_image_url,
          role:
            sessionUser.claims.email === "admin@rosae.com" || sessionUser.claims.email === "rosaeleisure@gmail.com"
              ? "admin"
              : "employee",
        };
        res.json({ authenticated: true, user: userData });
      }
    } else {
      res.json({ authenticated: false });
    }
  });

  // Get users with pagination and filters (admin only)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;

      
      if (currentUser.claims.email !== "admin@rosae.com" && currentUser.claims.email !== "rosaeleisure@gmail.com") {
        return res
          .status(403)
          .json({ message: "Only admins can view all users" });
      }

      const { page = '1', pageSize = '20', email, role, active } = req.query as any;
      const p = Number(page) || 1;
      const ps = Math.min(100, Number(pageSize) || 20);
      const result = await storage.listUsers({ page: p, pageSize: ps, email: email || undefined, role: role || undefined, active: active === undefined ? undefined : active === 'true' });
      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update a user (admin only)
  app.patch('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;
      if (currentUser.claims.email !== 'admin@rosae.com') {
        return res.status(403).json({ message: 'Only admins can update users' });
      }
      const { id } = req.params as any;
      const update = req.body || {};
      // Prevent email duplication and protect admin account email change
      if (update.email && update.email !== 'admin@rosae.com') {
        const existing = await storage.getUserByEmail(update.email);
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: 'Email already in use' });
        }
      }
      if (update.role && !['admin','employee'].includes(update.role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      const saved = await storage.updateUser(id, update);
      res.json(saved);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // Soft delete / deactivate a user (admin only)
  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;
      if (currentUser.claims.email !== 'admin@rosae.com') {
        return res.status(403).json({ message: 'Only admins can delete users' });
      }
      const { id } = req.params as any;
      if (id === 'admin-001') return res.status(400).json({ message: 'Cannot delete primary admin' });
      await storage.deactivateUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Notifications
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rows = await storage.listNotifications(userId);
      res.json(rows);
    } catch (error) {
      console.error('Error listing notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params as any;
      const { isRead } = req.body || {};
      const result = await storage.markNotificationRead(id, Boolean(isRead));
      res.json(result);
    } catch (error) {
      console.error('Error updating notification:', error);
      res.status(500).json({ message: 'Failed to update notification' });
    }
  });

  // Login tracker routes (admin)
  app.get("/api/login-tracker", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;
      const isAdmin = currentUser.claims.email === "admin@rosae.com";

      let { startDate, endDate, userId, email, page, pageSize } = req.query as any;

      // Non-admins can only view their own login records
      if (!isAdmin) {
        userId = currentUser.claims.sub;
        email = currentUser.claims.email;
      }

      const result = await storage.listLogins({ startDate, endDate, userId, email, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
      res.json(result);
    } catch (error) {
      console.error("Error fetching login tracker:", error);
      res.status(500).json({ message: "Failed to fetch login tracker" });
    }
  });

  // Create new user (admin only)
  app.post("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;
      if (currentUser.claims.email !== "admin@rosae.com") {
        return res
          .status(403)
          .json({ message: "Only admins can create users" });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        role = "employee",
      } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res
          .status(400)
          .json({
            message: "Email, password, first name, and last name are required",
          });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      }

      // Create new user
      const newUser = await storage.createUser({
        email,
        password,
        firstName,
        lastName,
        role,
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Admin routes for admin panel
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;
      if (currentUser.claims.email !== "admin@rosae.com") {
        return res
          .status(403)
          .json({ message: "Only admins can access admin panel" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch(
    "/api/admin/users/:userId/role",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const currentUser = req.user;
        if (currentUser.claims.email !== "admin@rosae.com") {
          return res
            .status(403)
            .json({ message: "Only admins can update user roles" });
        }

        const { userId } = req.params;
        const { role } = req.body;

        if (!role || !["admin", "employee"].includes(role)) {
          return res.status(400).json({ message: "Valid role is required" });
        }

        const updatedUser = await storage.updateUserRole(userId, role);
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ message: "Failed to update user role" });
      }
    },
  );

  // Debug route to check all users (remove in production)
  app.get("/api/debug/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      console.log("=== DEBUG: All users in database ===");
      users.forEach((user) => {
        console.log({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          hasPassword: !!user.passwordHash,
          passwordLength: user.passwordHash ? user.passwordHash.length : 0,
        });
      });
      res.json(users);
    } catch (error) {
      console.error("Error fetching users for debug:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Manual Google Calendar sync route (any authenticated user)
  app.post("/api/calendar/sync", isAuthenticated, async (req: any, res) => {
    try {
      const { calendarId, timeMin, timeMax } = req.body || {};
      const result = await syncGoogleCalendarToBookings({ calendarId, timeMin, timeMax });
      return res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error("manual calendar sync failed", e);
      return res.status(500).json({ ok: false, message: e?.message || "Sync failed" });
    }
  });

  // Configuration management routes
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/config", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;

      // Check if user is admin by role or email
      const userRole = await storage.getUser(currentUser.claims.sub);
      if (
        !userRole ||
        (userRole.role !== "admin" &&
          currentUser.claims.email !== "admin@rosae.com")
      ) {
        return res
          .status(403)
          .json({ message: "Only admins can update configuration" });
      }

      const { theatres, timeSlots, expenseCategories, expenseCreators, integrationSettings } = req.body;
      const userId = currentUser.claims.sub;
      const config = await storage.updateConfig(
        { theatres, timeSlots, expenseCategories, expenseCreators, integrationSettings },
        userId,
      );
      res.json(config);
    } catch (error) {
      console.error("Error updating config:", error);
      res.status(500).json({ message: "Failed to update configuration" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user;
      if (currentUser.claims.email !== "admin@rosae.com") {
        return res
          .status(403)
          .json({ message: "Only admins can delete users" });
      }

      const { userId } = req.params;

      // Prevent deleting the main admin
      if (userId === "admin-001") {
        return res
          .status(400)
          .json({ message: "Cannot delete the main administrator" });
      }

      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Booking routes

  // Search bookings by phone (optionally filter client-side by date/time)
  app.get("/api/bookings/search", isAuthenticated, async (req: any, res) => {
    try {
      const phone = String(req.query.phone || '').trim();
      if (!phone) return res.json([]);
      const rows = await storage.getBookingsByPhoneNumber(phone);
      res.json(rows);
    } catch (error) {
      console.error('Error searching bookings by phone:', error);
      res.status(500).json({ message: 'Failed to search bookings' });
    }
  });

  // Create refund request (employee/admin)
  app.post("/api/bookings/:id/refund-request", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { id } = req.params as any;
      const { amount, reason } = req.body || {};
      if (typeof amount !== 'number' || amount < 0.01 || !reason) {
        return res.status(400).json({ message: 'amount (number) and reason are required' });
      }
      const booking = await storage.getBookingById(id);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      const created = await storage.createRefundRequest({ bookingId: id, amount, reason, requestedBy: requesterId });

      // Notify admins
      try {
        const admins = await storage.getAllUsers();
        for (const u of admins as any[]) {
          if ((u as any).role === 'admin') {
            await storage.createNotification({ userId: (u as any).id, title: 'Refund Request', body: `${booking.customerName} • ₹${amount} • ${reason}`, type: 'refund', relatedType: 'refund_request', relatedId: (created as any).id });
          }
        }
      } catch {}

      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating refund request:', error);
      res.status(500).json({ message: 'Failed to create refund request' });
    }
  });

  // List refund requests (optionally by status)
  app.get("/api/refund-requests", isAuthenticated, async (req: any, res) => {
    try {
      const status = (req.query.status as any) || undefined;
      const rows = await storage.listRefundRequests({ status });
      res.json(rows);
    } catch (error) {
      console.error('Error listing refund requests:', error);
      res.status(500).json({ message: 'Failed to list refund requests' });
    }
  });

  // Approve refund (admin only)
  app.patch("/api/refund-requests/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const isAdmin = user?.claims?.email === 'admin@rosae.com' || user?.claims?.role === 'admin';
      if (!isAdmin) return res.status(403).json({ message: 'Only admins can approve refunds' });

      const { id } = req.params as any;
      const updated = await storage.approveRefundRequest(id, user.claims.sub);
      if (!updated) return res.status(404).json({ message: 'Refund request not found' });
      res.json(updated);
    } catch (error) {
      console.error('Error approving refund request:', error);
      res.status(500).json({ message: 'Failed to approve refund request' });
    }
  });

  // Reject refund (admin only)
  app.patch("/api/refund-requests/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const isAdmin = user?.claims?.email === 'admin@rosae.com' || user?.claims?.role === 'admin';
      if (!isAdmin) return res.status(403).json({ message: 'Only admins can reject refunds' });

      const { id } = req.params as any;
      const updated = await storage.rejectRefundRequest(id, user.claims.sub);
      if (!updated) return res.status(404).json({ message: 'Refund request not found' });
      res.json(updated);
    } catch (error) {
      console.error('Error rejecting refund request:', error);
      res.status(500).json({ message: 'Failed to reject refund request' });
    }
  });

  // Daily Income routes
  app.get("/api/daily-income", isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate, paymentType } = req.query as any;
      const rows = await storage.listDailyIncome({ startDate, endDate, paymentType });
      res.json(rows);
    } catch (error) {
      console.error('Error listing daily income:', error);
      res.status(500).json({ message: 'Failed to list daily income' });
    }
  });
  app.post("/api/daily-income", isAuthenticated, async (req: any, res) => {
    try {
      const row = await storage.createDailyIncome(req.body);
      res.status(201).json(row);
    } catch (error) {
      console.error('Error creating daily income:', error);
      res.status(500).json({ message: 'Failed to create daily income' });
    }
  });
  app.put("/api/daily-income/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.updateDailyIncome(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating daily income:', error);
      res.status(500).json({ message: 'Failed to update daily income' });
    }
  });
  app.delete("/api/daily-income/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteDailyIncome(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting daily income:', error);
      res.status(500).json({ message: 'Failed to delete daily income' });
    }
  });

  // Sync Daily Income from bookings (compute adjustedRevenue and refundTotal)
  app.post("/api/daily-income/sync", isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate, mode } = req.body || {};
      const out = await storage.syncDailyIncomeFromBookings({ startDate, endDate, mode });
      res.json(out);
    } catch (error) {
      console.error('Error syncing daily income:', error);
      res.status(500).json({ message: 'Failed to sync daily income' });
    }
  });

  app.post("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      console.log("Session:", req.session);
      console.log("User from request:", req.user);
      const userId = req.user.claims.sub;
      console.log("User ID from session:", userId);
      console.log("Raw booking data:", req.body);
      const bookingData = insertBookingSchema.parse(req.body);
      console.log("Parsed booking data:", bookingData);

      // Calculate repeat customer count if phone number is provided
      let repeatCount = 0;
      if (bookingData.phoneNumber) {
        try {
          const existingBookings = await storage.getBookingsByPhoneNumber(
            bookingData.phoneNumber,
          );
          repeatCount = existingBookings.length;
          console.log(
            `Found ${repeatCount} existing bookings for phone number: ${bookingData.phoneNumber}`,
          );
        } catch (error) {
          console.warn("Error counting repeat bookings:", error);
          // Continue with repeatCount = 0 if there's an error
        }
      }

      // Add repeat count to booking data
      const bookingDataWithRepeat = {
        ...bookingData,
        repeatCount,
      };

      // Validate that cash + UPI equals total amount
      const totalPaid = bookingData.cashAmount + bookingData.upiAmount;
      const snacksPaid =
        (bookingData.snacksCash || 0) + (bookingData.snacksUpi || 0);

      if (Math.abs(totalPaid - bookingData.totalAmount) > 0.01) {
        return res
          .status(400)
          .json({ message: "Cash + UPI must equal total amount" });
      }

      if (Math.abs(snacksPaid - (bookingData.snacksAmount || 0)) > 0.01) {
        return res
          .status(400)
          .json({ message: "Snacks cash + UPI must equal snacks amount" });
      }

      // Always ensure the user exists in the database before creating a booking
      console.log("Ensuring user exists in database:", userId);

      // Create or update the user using storage API instead of direct SQL
      try {
        // Check if user already exists
        let existingUser = await storage.getUser(userId);

        if (!existingUser) {
          // Create the user if they don't exist
          await storage.upsertUser({
            id: userId,
            email: req.user.claims.email || "admin@rosae.com",
            firstName: req.user.claims.first_name || req.user.claims.firstName || "Admin",
            lastName: req.user.claims.last_name || req.user.claims.lastName || "User",
            profileImageUrl: req.user.claims.profile_image_url || req.user.claims.profileImageUrl || null,
            role: "admin",
          });
          console.log("User created successfully via storage API");
        } else {
          console.log("User already exists in database");
        }
      } catch (dbError) {
        console.error("Error creating user in database:", dbError);
        return res
          .status(500)
          .json({ message: "Failed to create booking - user account issue" });
      }

      // Use the session user ID as the creator
      let creatorId = userId;

      // Double-check that the user exists now
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        // If user still doesn't exist, check if there's any admin user we can use
        const adminUsers = await storage.getAllUsers();
        const adminUser = adminUsers.find((user) => user.role === "admin");

        if (adminUser) {
          creatorId = adminUser.id;
          console.log("Using existing admin user as creator:", creatorId);
        } else {
          // Create a default admin user as a fallback
          const defaultAdmin = {
            id: "admin-001",
            email: "admin@rosae.com",
            firstName: "Admin",
            lastName: "User",
            profileImageUrl: null,
            role: "admin",
          };

          const createdAdmin = await storage.upsertUser(defaultAdmin);
          creatorId = createdAdmin.id;
          console.log("Created default admin user as creator:", creatorId);
        }
      }

      // Include phone number in booking data with repeat count
      const booking = await storage.createBooking({
        ...bookingDataWithRepeat,
        createdBy: creatorId,
      } as any);

      // Create calendar event
      try {
        await createCalendarEvent(booking);
      } catch (calendarError) {
        console.error("Failed to create calendar event:", calendarError);
        // Don't fail the booking creation if calendar fails
      }

      await storage.logActivity(
        creatorId,
        "CREATE",
        "BOOKING",
        booking.id,
        `Created booking for ${bookingData.theatreName}`,
      );

      res.json(booking);
    } catch (error: any) {
      console.error("Error creating booking:", error);
      if (error.name === 'ZodError') {
        const details = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ message: 'Validation failed', details, errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create booking", details: error?.message });
    }
  });

  app.get("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10;

      // Extract filter parameters
      const filters = {
        dateFilter: req.query.dateFilter as string | undefined,
        phoneFilter: req.query.phoneFilter as string | undefined,
        bookingDateFilter: req.query.bookingDateFilter as string | undefined,
        repeatCountFilter: req.query.repeatCountFilter as string | undefined,
      };

      const result = await storage.getAllBookings(page, pageSize, filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/date-range", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ message: "Start date and end date are required" });
      }

      const bookings = await storage.getBookingsByDateRange(
        startDate as string,
        endDate as string,
      );
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings by date range:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Search bookings by phone number (must come before /:id route)
  app.get("/api/bookings/search", isAuthenticated, async (req, res) => {
    try {
      const { phone } = req.query;
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const bookings = await storage.getBookingsByPhoneNumber(phone as string);
      if (bookings.length === 0) {
        return res
          .status(404)
          .json({ message: "No bookings found for this phone number" });
      }
      res.json(bookings);
    } catch (error) {
      console.error("Error searching bookings by phone:", error);
      res.status(500).json({ message: "Failed to search bookings" });
    }
  });

  // Get single booking by ID
  app.get("/api/bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const booking = await storage.getBookingById(id);

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json(booking);
    } catch (error) {
      console.error("Error fetching booking by ID:", error);
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  });

  // Expense routes
  app.post("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Debug: log payload to verify paidCash/paidUpi values
      console.log("/api/expenses payload:", JSON.stringify(req.body));
      const expenseData = insertExpenseSchema.parse(req.body);

      const expense = await storage.createExpense({
        ...expenseData,
        createdBy: userId,
      } as any);

      // Debug: log created row
      console.log("/api/expenses created:", JSON.stringify(expense));

      await storage.logActivity(
        userId,
        "CREATE",
        "EXPENSE",
        expense.id,
        `Created expense: ${expenseData.description} by ${expenseData.creatorName || 'Unknown'}`,
      );

      res.json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  // Ad spend routes
  app.post("/api/ad-spends", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { insertAdSpendSchema } = await import("@shared/schema");
      
      // Debug logging
      console.log("Received ad spend data:", JSON.stringify(req.body, null, 2));
      
      // Validate the request body
      const data = insertAdSpendSchema.parse(req.body);

      const created = await storage.createAdSpend({ ...data, createdBy: userId });
      await storage.logActivity(userId, "CREATE", "AD_SPEND", created.id, `Created ad spend: ${data.campaignName}`);
      res.json(created);
    } catch (error: any) {
      console.error("Error creating ad spend:", error);
      
      // Handle validation errors specifically
      if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ 
          message: "Validation failed", 
          details: validationErrors,
          errors: error.errors 
        });
      }
      
      // Handle database constraint errors
      if (error.message && error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ 
          message: "A record with this data already exists" 
        });
      }
      
      // Handle foreign key constraint errors
      if (error.message && error.message.includes('FOREIGN KEY constraint')) {
        return res.status(400).json({ 
          message: "Invalid user reference" 
        });
      }
      
      // Generic error
      res.status(500).json({ 
        message: "Failed to create ad spend",
        details: error.message || "Unknown error occurred"
      });
    }
  });

  app.get("/api/ad-spends", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, campaignName, platform, maxCpl } = req.query as any;
      const rows = await storage.getAdSpends({
        startDate,
        endDate,
        campaignName,
        platform,
        maxCpl: typeof maxCpl !== 'undefined' ? Number(maxCpl) : undefined,
      });
      res.json(rows);
    } catch (error) {
      console.error("Error fetching ad spends:", error);
      res.status(500).json({ message: "Failed to fetch ad spends" });
    }
  });

  app.patch("/api/ad-spends/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as any;
      const { insertAdSpendSchema } = await import("@shared/schema");
      
      // Validate the request body
      const data = insertAdSpendSchema.parse(req.body);
      
      const updated = await storage.updateAdSpend(id, data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating ad spend:", error);
      
      // Handle validation errors specifically
      if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ 
          message: "Validation failed", 
          details: validationErrors,
          errors: error.errors 
        });
      }
      
      // Handle not found errors
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json({ 
          message: "Ad spend record not found" 
        });
      }
      
      // Generic error
      res.status(500).json({ 
        message: "Failed to update ad spend",
        details: error.message || "Unknown error occurred"
      });
    }
  });

  app.delete("/api/ad-spends/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as any;
      await storage.deleteAdSpend(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting ad spend:", error);
      res.status(500).json({ message: "Failed to delete ad spend" });
    }
  });

  // Daily Income routes
  app.get("/api/daily-income", isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate, paymentType } = req.query;
      const filters = {
        startDate: startDate as string,
        endDate: endDate as string,
        paymentType: paymentType as string
      };
      
      const dailyIncomes = await storage.getDailyIncomes(filters);
      res.json(dailyIncomes);
    } catch (error) {
      console.error("Error fetching daily incomes:", error);
      res.status(500).json({ message: "Failed to fetch daily incomes" });
    }
  });

  app.post("/api/daily-income", isAuthenticated, async (req: any, res) => {
    try {
      const { insertDailyIncomeSchema } = await import("@shared/schema");
      const userId = req.user.claims.sub;
      
      const data = insertDailyIncomeSchema.parse(req.body);
      const dailyIncomeData = {
        ...data,
        createdBy: userId
      };
      
      const result = await storage.createDailyIncome(dailyIncomeData);
      res.json(result);
    } catch (error) {
      console.error("Error creating daily income:", error);
      res.status(500).json({ message: "Failed to create daily income" });
    }
  });

  app.put("/api/daily-income/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { insertDailyIncomeSchema } = await import("@shared/schema");
      const { id } = req.params;
      
      const data = insertDailyIncomeSchema.parse(req.body);
      const result = await storage.updateDailyIncome(id, data);
      
      if (!result) {
        return res.status(404).json({ message: "Daily income record not found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error updating daily income:", error);
      res.status(500).json({ message: "Failed to update daily income" });
    }
  });

  app.delete("/api/daily-income/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.deleteDailyIncome(id);
      
      if (!result) {
        return res.status(404).json({ message: "Daily income record not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting daily income:", error);
      res.status(500).json({ message: "Failed to delete daily income" });
    }
  });

  // Sync daily income from bookings within a date range
  app.post("/api/daily-income/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate, mode } = req.body || {};
      const results = await storage.syncDailyIncomeFromBookings({ startDate, endDate, mode }, userId);
      res.json({ success: true, records: results });
    } catch (error) {
      console.error("Error syncing daily income:", error);
      res.status(500).json({ message: "Failed to sync daily income" });
    }
  });

  app.get("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const expenses = await storage.getAllExpenses(
        limit ? parseInt(limit as string) : undefined,
      );
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Lead Infos
  app.post('/api/lead-infos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const payload = insertLeadInfoSchema.parse(req.body);
      const created = await storage.createLeadInfo({ ...payload, createdBy: userId });
      res.json(created);
    } catch (error) {
      console.error('Error creating lead info:', error);
      res.status(500).json({ message: 'Failed to create lead info' });
    }
  });

  app.get('/api/lead-infos', isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate, source } = req.query as any;
      const rows = await storage.listLeadInfos({ startDate, endDate, source });
      res.json(rows);
    } catch (error) {
      console.error('Error listing lead infos:', error);
      res.status(500).json({ message: 'Failed to fetch lead infos' });
    }
  });

  app.get('/api/lead-infos/stats', isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query as any;
      const stats = await storage.getLeadStats({ startDate, endDate });
      res.json(stats);
    } catch (error) {
      console.error('Error fetching lead stats:', error);
      res.status(500).json({ message: 'Failed to fetch lead stats' });
    }
  });

  app.get('/api/lead-infos/export', isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate, source } = req.query as any;
      const csv = await storage.exportLeadInfosCSV({ startDate, endDate, source });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="lead_infos.csv"');
      res.send(csv);
    } catch (error) {
      console.error('Error exporting lead infos:', error);
      res.status(500).json({ message: 'Failed to export lead infos' });
    }
  });

  app.post('/api/lead-infos/notify-missing-yesterday', isAuthenticated, async (req: any, res) => {
    try {
      // Compute yesterday in YYYY-MM-DD
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      const ymd = `${y}-${m}-${day}`;
      const result = await storage.createLeadNotificationsIfMissing(ymd);
      res.json(result);
    } catch (error) {
      console.error('Error creating missing-yesterday notifications:', error);
      res.status(500).json({ message: 'Failed to trigger notifications' });
    }
  });

  // Revenue Goals API
  app.post('/api/revenue/goal', isAuthenticated, async (req: any, res) => {
    try {
      const sessionUser = req.user;
      
      // Get user role from database (consistent with auth status endpoint)
      let dbUser = null;
      if (sessionUser.claims.sub) {
        dbUser = await storage.getUser(sessionUser.claims.sub);
      }
      if (!dbUser && sessionUser.claims.email) {
        dbUser = await storage.getUserByEmail(sessionUser.claims.email);
      }
      
      const userRole = dbUser?.role || 
        (sessionUser.claims.email === "admin@rosae.com" || sessionUser.claims.email === "rosaeleisure@gmail.com" ? "admin" : "employee");
      
      if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const userId = sessionUser.claims.sub;
      const result = await storage.setMonthlyGoal({ ...req.body, createdBy: userId });
      res.json(result);
    } catch (error) {
      console.error('Error setting monthly goal:', error);
      res.status(500).json({ message: 'Failed to set monthly goal' });
    }
  });

  app.get('/api/revenue/progress', isAuthenticated, async (req: any, res) => {
    try {
      const { month } = req.query;
      if (!month) {
        return res.status(400).json({ message: 'Month parameter required (YYYY-MM format)' });
      }
      
      const progress = await storage.getRevenueProgress(month as string);
      res.json(progress);
    } catch (error) {
      console.error('Error getting revenue progress:', error);
      res.status(500).json({ message: 'Failed to get revenue progress' });
    }
  });

  app.post('/api/notifications/check-revenue', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (user.claims.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const { month } = req.body;
      if (!month) {
        return res.status(400).json({ message: 'Month parameter required (YYYY-MM format)' });
      }
      
      const result = await storage.checkAndCreateRevenueNotifications(month);
      res.json(result);
    } catch (error) {
      console.error('Error checking revenue notifications:', error);
      res.status(500).json({ message: 'Failed to check revenue notifications' });
    }
  });

  app.post('/api/notifications/check-cancellations', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (user.claims.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const result = await storage.checkCancellationRate();
      res.json(result);
    } catch (error) {
      console.error('Error checking cancellation rate:', error);
      res.status(500).json({ message: 'Failed to check cancellation rate' });
    }
  });

  // Mark notification as read
  app.post('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const result = await storage.markNotificationAsRead(id, userId);
      res.json(result);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  // Export expenses as CSV (optional category filter)
  app.get("/api/expenses/export", isAuthenticated, async (req: any, res) => {
    try {
      const category = (req.query.category as string) || "";
      const rows = category
        ? await storage.getExpensesByCategory(category)
        : await storage.getAllExpenses();

      // CSV helpers
      const q = (v: any) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
      const getPaidViaLabel = (r: any) => {
        const cash = Number(r.paidCash || 0);
        const upi = Number(r.paidUpi || 0);
        if (cash > 0 && upi > 0) return 'U&C';
        if (cash > 0) return 'Cash';
        if (upi > 0) return 'UPI';
        return '-';
      };

      const header = [
        'Date',
        'Category',
        'Description',
        'Created By',
        'Paid Via',
        'Paid Cash',
        'Paid UPI',
        'Amount',
      ];

      const lines = rows.map((r: any) => [
        q(r.expenseDate),
        q(r.category),
        q(r.description || ''),
        q(r.creatorName || ''),
        q(getPaidViaLabel(r)),
        q(r.paidCash ?? ''),
        q(r.paidUpi ?? ''),
        q(r.amount),
      ].join(','));

      const csv = [header.join(','), ...lines].join('\n');
      const filename = `expenses${category ? '_' + category : ''}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting expenses:", error);
      res.status(500).json({ message: "Failed to export expenses" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/daily-revenue", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, days: daysStr } = req.query as any;
      let dailyRevenue;
      if (startDate || endDate) {
        dailyRevenue = await storage.getDailyRevenue({ startDate, endDate });
      } else {
        const days = daysStr ? parseInt(daysStr as string, 10) : 7;
        dailyRevenue = await storage.getDailyRevenue(days);
      }
      res.json(dailyRevenue);
    } catch (error) {
      console.error("Error fetching daily revenue:", error);
      res.status(500).json({ error: "Failed to fetch daily revenue data" });
    }
  });

  app.get(
    "/api/analytics/payment-methods",
    isAuthenticated,
    async (req, res) => {
      try {
        const { startDate, endDate } = req.query as any;
        const paymentMethods = await storage.getPaymentMethodBreakdown({ startDate, endDate });
        res.json(paymentMethods);
      } catch (error) {
        console.error("Error fetching payment methods breakdown:", error);
        res.status(500).json({ error: "Failed to fetch payment methods data" });
      }
    },
  );

  app.get("/api/analytics/time-slots", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query as any;
      const timeSlots = await storage.getTimeSlotPerformance({ startDate, endDate });
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching time slot performance:", error);
      res.status(500).json({ error: "Failed to fetch time slot data" });
    }
  });

  // Leave management routes
  app.post(
    "/api/leave-applications",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const leaveData = insertLeaveApplicationSchema.parse(req.body);

        const leave = await storage.createLeaveApplication({
          ...leaveData,
          userId,
        });

        // Adjust leave balance on create (simple duration in days)
        try {
          const start = new Date(leaveData.startDate);
          const end = new Date(leaveData.endDate);
          const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const year = start.getFullYear();
          await storage.adjustLeaveUsed(userId, leaveData.leaveType, year, days);
        } catch (e) {
          console.warn('Could not adjust leave balance:', e);
        }

        await storage.logActivity(
          userId,
          "CREATE",
          "LEAVE_APPLICATION",
          leave.id,
          `Applied for ${leaveData.leaveType} from ${leaveData.startDate} to ${leaveData.endDate}`,
        );

        // Notify user
        try {
          await storage.createNotification({
            userId,
            title: `Leave request submitted (${leaveData.leaveType})`,
            body: `${leaveData.startDate} → ${leaveData.endDate}`,
            relatedType: 'leave_application',
            relatedId: leave.id,
          });
        } catch {}

        res.json(leave);
      } catch (error) {
        console.error("Error creating leave application:", error);
        res.status(500).json({ message: "Failed to create leave application" });
      }
    },
  );

  app.get("/api/leave-applications", isAuthenticated, async (req, res) => {
    try {
      const leaves = await storage.getLeaveApplications();
      res.json(leaves);
    } catch (error) {
      console.error("Error fetching leave applications:", error);
      res.status(500).json({ message: "Failed to fetch leave applications" });
    }
  });

  app.patch(
    "/api/leave-applications/:id/status",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { id } = req.params;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const updatedLeave = await storage.updateLeaveStatus(
          id,
          status,
          userId,
        );
        await storage.logActivity(
          userId,
          "UPDATE",
          "LEAVE_APPLICATION",
          id,
          `${status} leave application`,
        );

        // Notify applicant and adjust balance on approval/rejection
        try {
          // Find application to get applicant ID and dates
          const apps = await storage.getLeaveApplications();
          const app = apps.find((a: any) => a.id === id);
          if (app) {
            const title = `Leave ${status}`;
            const body = `${app.startDate} → ${app.endDate}`;
            await storage.createNotification({ userId: app.userId, title, body, relatedType: 'leave_application', relatedId: id });
            if (status === 'rejected') {
              const start = new Date(app.startDate);
              const end = new Date(app.endDate);
              const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
              const year = start.getFullYear();
              await storage.adjustLeaveUsed(app.userId, app.leaveType, year, -days);
            }
          }
        } catch (e) {
          console.warn('Notify/adjust on status error:', e);
        }

        res.json(updatedLeave);
      } catch (error) {
        console.error("Error updating leave status:", error);
        res.status(500).json({ message: "Failed to update leave status" });
      }
    },
  );

  // Leave types
  app.get("/api/leave-types", isAuthenticated, async (req, res) => {
    try {
      const types = await storage.getLeaveTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching leave types:", error);
      res.status(500).json({ message: "Failed to fetch leave types" });
    }
  });

  // Leave balances
  app.get("/api/leave-balances", isAuthenticated, async (req: any, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const userId = (req.query.userId as string) || req.user.claims.sub;
      const balances = await storage.getLeaveBalancesByUser(userId, year);
      res.json(balances);
    } catch (error) {
      console.error("Error fetching leave balances:", error);
      res.status(500).json({ message: "Failed to fetch leave balances" });
    }
  });

  app.post("/api/config/leave-type", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user?.claims?.email !== 'admin@rosae.com') {
        return res.status(403).json({ message: 'Only admins can manage leave types' });
      }
      const { id, code, name, defaultAnnual, active } = req.body || {};
      const saved = await storage.upsertLeaveType({ id, code, name, defaultAnnual, active });
      res.json(saved);
    } catch (error) {
      console.error("Error upserting leave type:", error);
      res.status(500).json({ message: "Failed to upsert leave type" });
    }
  });

  // Admin: Set per-user leave balance (allocation)
  app.post("/api/admin/leave-balance", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.claims.email !== 'admin@rosae.com' && req.user.claims.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can set leave balances' });
      }
      const { userId, leaveTypeCode, year, allocated } = req.body || {};
      if (!userId || !leaveTypeCode || typeof year !== 'number' || typeof allocated !== 'number') {
        return res.status(400).json({ message: 'userId, leaveTypeCode, year (number), allocated (number) are required' });
      }
      const saved = await storage.setLeaveBalance(userId, leaveTypeCode, year, allocated);
      res.json(saved);
    } catch (error) {
      console.error('Error setting leave balance:', error);
      res.status(500).json({ message: 'Failed to set leave balance' });
    }
  });

  // Notifications
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const list = await storage.listNotifications(userId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { isRead } = req.body as any;
      const updated = await storage.markNotificationRead(id, Boolean(isRead ?? true));
      res.json(updated);
    } catch (error) {
      console.error("Error updating notification:", error);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  // Feedback routes
  app.get("/api/feedbacks", isAuthenticated, async (req, res) => {
    try {
      const { collected, theatreName, date, timeSlot, page = '1', pageSize = '20' } = req.query as any;
      const result = await storage.listFeedbacks({
        collected: typeof collected === 'string' ? collected === 'true' : undefined,
        theatreName: theatreName || undefined,
        date: date || undefined,
        timeSlot: timeSlot || undefined,
      }, parseInt(page, 10), parseInt(pageSize, 10));
      res.json(result);
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
      res.status(500).json({ message: "Failed to fetch feedbacks" });
    }
  });

  app.get("/api/feedbacks/pending", isAuthenticated, async (req, res) => {
    try {
      const { theatreName, date, timeSlot, page = '1', pageSize = '20' } = req.query as any;
      const result = await storage.listBookingsNeedingFeedback({ theatreName, date, timeSlot }, parseInt(page, 10), parseInt(pageSize, 10));
      res.json(result);
    } catch (error) {
      console.error("Error fetching bookings needing feedback:", error);
      res.status(500).json({ message: "Failed to fetch pending feedbacks" });
    }
  });

  app.post("/api/feedbacks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bookingId, collected, reason } = req.body;
      if (!bookingId || typeof collected !== 'boolean') return res.status(400).json({ message: 'bookingId and collected are required' });

      // Load booking to denormalize
      const booking = await storage.getBookingById(bookingId);
      const fb = await storage.upsertFeedback({
        bookingId,
        bookingDate: booking?.bookingDate || null,
        timeSlot: booking?.timeSlot || null,
        theatreName: booking?.theatreName || null,
        // New: denormalize customer info
        customerName: booking?.customerName || null,
        phoneNumber: booking?.phoneNumber || null,
        collected,
        reason: collected ? null : (reason || null),
        createdBy: userId,
      });

      if (!collected) {
        // Auto-create follow-up when set to No
        await storage.createFollowUpForFeedback({
          bookingId,
          customerName: booking?.customerName || null,
          phoneNumber: booking?.phoneNumber || null,
          reason: reason || 'Feedback not collected',
          createdBy: userId
        });
      } else {
        // If flipping to Yes, close all pending follow-ups for this booking
        try { await storage.closePendingFollowUpsForBooking(bookingId); } catch {}
      }

      res.json(fb);
    } catch (error) {
      console.error("Error upserting feedback:", error);
      res.status(500).json({ message: "Failed to save feedback" });
    }
  });

  // Force-mark latest feedback collected for a booking and return updated row
  app.post("/api/feedbacks/mark-collected", isAuthenticated, async (req: any, res) => {
    try {
      const { bookingId } = req.body || {};
      if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });

      const latest = await storage.getLatestFeedbackForBooking(bookingId);
      if (latest) {
        const updated = await storage.upsertFeedback({ id: latest.id, bookingId, collected: true, reason: null });
        // Also close pending follow-ups for this booking
        try { await storage.closePendingFollowUpsForBooking(bookingId); } catch {}
        return res.json(updated);
      }

      // If no feedback exists yet, create a collected one using booking denorm
      const booking = await storage.getBookingById(bookingId);
      const created = await storage.upsertFeedback({
        bookingId,
        bookingDate: booking?.bookingDate || null,
        timeSlot: booking?.timeSlot || null,
        theatreName: booking?.theatreName || null,
        customerName: booking?.customerName || null,
        phoneNumber: booking?.phoneNumber || null,
        collected: true,
        reason: null,
      });
      try { await storage.closePendingFollowUpsForBooking(bookingId); } catch {}
      res.json(created);
    } catch (error) {
      console.error("Error marking feedback collected:", error);
      res.status(500).json({ message: "Failed to mark collected" });
    }
  });

  app.get("/api/feedbacks/export", isAuthenticated, async (req, res) => {
    try {
      const { collected, theatreName, date, timeSlot } = req.query as any;
      const csv = await storage.exportFeedbacksCSV({
        collected: typeof collected === 'string' ? collected === 'true' : undefined,
        theatreName: theatreName || undefined,
        date: date || undefined,
        timeSlot: timeSlot || undefined,
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="feedbacks.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting feedbacks:", error);
      res.status(500).json({ message: "Failed to export feedbacks" });
    }
  });

  // Follow-ups routes (for feedback follow-ups)
  app.get("/api/follow-ups", isAuthenticated, async (req, res) => {
    try {
      const { type, status } = req.query as any;
      const rows = await storage.listFollowUps({
        type: type || undefined,
        status: status || undefined,
      });
      res.json({ rows });
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      res.status(500).json({ message: "Failed to fetch follow-ups" });
    }
  });

  app.post("/api/follow-ups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const body = req.body || {};
      const created = await storage.createFollowUp({
        bookingId: body.bookingId || null,
        customerName: String(body.customerName || ''),
        phoneNumber: String(body.phoneNumber || ''),
        followUpDate: String(body.followUpDate || ''),
        note: String(body.note || ''),
        category: body.category || body.type || 'general',
        type: body.type || undefined,
        createdBy: userId,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating follow-up:", error);
      res.status(500).json({ message: "Failed to create follow-up" });
    }
  });

  app.patch("/api/follow-ups/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as any;
      const { status } = req.body as any;
      if (status === 'completed') {
        const updated = await storage.markFollowUpCompleted(id);
        let latestFeedback = null as any;
        try {
          if ((updated as any)?.bookingId) {
            latestFeedback = await storage.getLatestFeedbackForBooking((updated as any).bookingId);
          }
        } catch {}
        // Return the updated follow-up and the latest feedback state for immediate UI sync
        return res.json({ ...updated, latestFeedback });
      }
      if (status === 'cancelled') {
        const updated = await storage.cancelFollowUp(id);
        return res.json(updated);
      }
      return res.status(400).json({ message: 'Unsupported status update' });
    } catch (error) {
      console.error("Error updating follow-up:", error);
      res.status(500).json({ message: "Failed to update follow-up" });
    }
  });

  app.delete("/api/follow-ups/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as any;
      await storage.deleteFollowUp(id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting follow-up:", error);
      res.status(500).json({ message: "Failed to delete follow-up" });
    }
  });

  // Lead Info routes
  app.get("/api/lead-infos", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, source } = req.query as any;
      const rows = await storage.listLeadInfos({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        source: source || undefined,
      });
      res.json(rows);
    } catch (error) {
      console.error("Error fetching lead infos:", error);
      res.status(500).json({ message: "Failed to fetch lead infos" });
    }
  });

  app.post("/api/lead-infos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const body = req.body || {};
      // Basic normalization
      const payload = {
        date: String(body.date),
        shift: String(body.shift),
        source: String(body.source),
        totalLeads: Number(body.totalLeads || 0),
        goodLeads: Number(body.goodLeads || 0),
        badLeads: Number(body.badLeads || 0),
        callsMade: Number(body.callsMade || 0),
        description: body.description ? String(body.description) : null,
        createdBy: userId,
      } as any;
      const saved = await storage.createLeadInfo(payload);
      res.json(saved);
    } catch (error) {
      console.error("Error creating lead info:", error);
      res.status(500).json({ message: "Failed to save lead info" });
    }
  });

  app.get("/api/lead-infos/export", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, source } = req.query as any;
      const csv = await storage.exportLeadInfosCSV({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        source: source || undefined,
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="lead_infos.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting lead infos:", error);
      res.status(500).json({ message: "Failed to export lead infos" });
    }
  });

  // Trigger notifications if a date has no lead info entries
  app.post("/api/lead-infos/notify-missing", isAuthenticated, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date(Date.now() - 24*60*60*1000).toISOString().slice(0,10);
      const result = await storage.createLeadNotificationsIfMissing(date);
      res.json(result);
    } catch (error) {
      console.error("Error notifying missing lead infos:", error);
      res.status(500).json({ message: "Failed to trigger notifications" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/daily-revenue", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, days } = req.query as any;
      let data;
      if (startDate || endDate) {
        data = await storage.getDailyRevenue({ startDate, endDate });
      } else {
        data = await storage.getDailyRevenue(days ? parseInt(days) : 7);
      }
      res.json(data);
    } catch (error) {
      console.error("Error fetching daily revenue:", error);
      res.status(500).json({ message: "Failed to fetch daily revenue" });
    }
  });

  app.get(
    "/api/analytics/payment-methods",
    isAuthenticated,
    async (req, res) => {
      try {
        const { startDate, endDate } = req.query as any;
        const data = await storage.getPaymentMethodBreakdown({ startDate, endDate });
        res.json(data);
      } catch (error) {
        console.error("Error fetching payment method breakdown:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch payment method breakdown" });
      }
    },
  );

  app.get("/api/analytics/time-slots", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query as any;
      const data = await storage.getTimeSlotPerformance({ startDate, endDate });
      res.json(data);
    } catch (error) {
      console.error("Error fetching time slot performance:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch time slot performance" });
    }
  });

  // Customer ticket routes removed as requested

  // Customer ticket routes removed as requested

  // Expense export route - fixed duplicate route

  // Customer ticket routes removed as requested

  // Expense export routes
  app.get("/api/expenses/export", isAuthenticated, async (req, res) => {
    try {
      const { category, startDate, endDate } = req.query;
      let expenses;

      if (category) {
        expenses = await storage.getExpensesByCategory(category as string);
      } else if (startDate && endDate) {
        expenses = await storage.getExpensesByDateRange(
          startDate as string,
          endDate as string,
        );
      } else {
        expenses = await storage.getAllExpenses();
      }

      // Generate CSV format (including creator name)
      const csvHeaders = "Date,Category,Description,Created By,Amount\n";
      const csvData = expenses
        .map(
          (expense: any) =>
            `${expense.expenseDate},${expense.category},"${expense.description}",${expense.creatorName || ''},${expense.amount}`,
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="expenses.csv"',
      );
      res.send(csvHeaders + csvData);
    } catch (error) {
      console.error("Error exporting expenses:", error);
      res.status(500).json({ message: "Failed to export expenses" });
    }
  });

  // Calendar webhook routes
  app.post("/api/webhooks/calendar", async (req, res) => {
    try {
      const { action, bookingId, eventData } = req.body;

      switch (action) {
        case "update":
          if (eventData && bookingId) {
            const calendarEvent =
              await storage.getCalendarEventByBookingId(bookingId);
            if (calendarEvent) {
              await storage.updateCalendarEvent(calendarEvent.id, eventData);
            }
          }
          break;

        case "delete":
          if (bookingId) {
            await storage.deleteCalendarEvent(bookingId);
          }
          break;

        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      await sendWebhookNotification(action, { bookingId, eventData });
      res.json({ success: true });
    } catch (error) {
      console.error("Error handling calendar webhook:", error);
      res.status(500).json({ message: "Failed to handle webhook" });
    }
  });

  // Booking webhook endpoint for automatic booking creation
  app.post("/api/webhooks/booking", async (req, res) => {
    try {
      const bookingData = req.body;

      // Validate the booking data
      if (
        !bookingData.theatreName ||
        !bookingData.timeSlot ||
        !bookingData.guests ||
        !bookingData.totalAmount ||
        !bookingData.cashAmount ||
        !bookingData.upiAmount ||
        !bookingData.bookingDate
      ) {
        return res.status(400).json({
          message: "Missing required booking fields",
          requiredFields: [
            "theatreName",
            "timeSlot",
            "guests",
            "totalAmount",
            "cashAmount",
            "upiAmount",
            "bookingDate",
          ],
        });
      }

      // Add phone number if not provided
      if (!bookingData.phoneNumber) {
        console.log("No phone number provided in webhook booking");
      }

      // Validate that cash + UPI equals total amount
      const totalPaid = bookingData.cashAmount + bookingData.upiAmount;
      const snacksPaid =
        (bookingData.snacksCash || 0) + (bookingData.snacksUpi || 0);

      if (Math.abs(totalPaid - bookingData.totalAmount) > 0.01) {
        return res
          .status(400)
          .json({ message: "Cash + UPI must equal total amount" });
      }

      if (Math.abs(snacksPaid - (bookingData.snacksAmount || 0)) > 0.01) {
        return res
          .status(400)
          .json({ message: "Snacks cash + UPI must equal snacks amount" });
      }

      // Get an admin user to set as creator for webhook bookings
      let adminUsers = await storage.getAllUsers();
      let adminUser = adminUsers.find((user: any) => user.role === "admin");

      if (!adminUser) {
        // Create a default admin if none exists
        const defaultAdmin = {
          id: "admin-001",
          email: "admin@rosae.com",
          firstName: "Admin",
          lastName: "User",
          profileImageUrl: null,
          role: "admin",
          active: true,
        } as any;
        adminUser = await storage.upsertUser(defaultAdmin);
      }

      const booking = await storage.createBooking({
        ...bookingData,
        createdBy: (adminUser as any).id,
      } as any);

      // Create calendar event
      try {
        await createCalendarEvent(booking);
      } catch (calendarError) {
        console.error(
          "Failed to create calendar event from webhook:",
          calendarError,
        );
        // Don't fail the booking creation if calendar fails
      }

      await storage.logActivity(
        adminUser.id,
        "CREATE",
        "BOOKING",
        booking.id,
        `Created booking via webhook for ${bookingData.theatreName}`,
      );

      res.status(201).json({
        success: true,
        message: "Booking created successfully",
        bookingId: booking.id,
      });
    } catch (error) {
      console.error("Error creating booking via webhook:", error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  // Tickets routes
  app.post("/api/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Accept either bookingId OR (phoneNumber + bookingDate [+ timeSlot])
      const { bookingId: bodyBookingId, phoneNumber, bookingDate, timeSlot, reason, notes } = req.body || {};
      if (!reason) return res.status(400).json({ message: "Reason is required" });

      let bookingId = bodyBookingId as string | undefined;
      let resolvedTimeSlot: string | undefined = timeSlot;

      if (!bookingId) {
        if (!phoneNumber || !bookingDate) {
          return res.status(400).json({ message: "Provide bookingId or phoneNumber + bookingDate" });
        }
        // If timeSlot is provided, try exact booking lookup
        if (timeSlot) {
          const matched = await storage.getBookingByPhoneDateAndSlot(String(phoneNumber), String(bookingDate), String(timeSlot));
          if (!matched) return res.status(404).json({ message: "No booking found for given phone/date/slot" });
          bookingId = matched.id;
          resolvedTimeSlot = matched.timeSlot;
        } else {
          // Fallback: find latest booking by phone + date if multiple
          const bookingsForPhone = await storage.getBookingsByPhoneNumber(String(phoneNumber));
          const match = bookingsForPhone
            .filter(b => String(b.bookingDate).trim() === String(bookingDate).trim())
            .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
          if (!match) return res.status(404).json({ message: "No booking found for given phone/date" });
          bookingId = match.id;
          resolvedTimeSlot = match.timeSlot;
        }
      }

      // validate booking exists
      const booking = await storage.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const ticket = await storage.createTicket({ bookingId, reason, notes, timeSlot: resolvedTimeSlot ?? booking.timeSlot, createdBy: userId });
      res.status(201).json(ticket);
    } catch (error) {
      console.error("Create ticket error:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.get("/api/tickets", isAuthenticated, async (req, res) => {
    try {
      const { page, pageSize, bookingId, phoneNumber, reason, timeSlot, startDate, endDate } = req.query as any;

      const result = await storage.getTickets({
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
        bookingId: (bookingId as string) || undefined,
        phoneNumber: (phoneNumber as string) || undefined,
        reason: reason && reason !== 'all' ? reason : undefined,
        timeSlot: (timeSlot as string) || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("List tickets error:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.patch("/api/tickets/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as any;
      const { reason, notes, status } = req.body || {};
      if (!reason && !notes && !status) {
        return res.status(400).json({ message: "No fields to update" });
      }
      const updated = await storage.updateTicket(id, { reason, notes, status });
      if (!updated) return res.status(404).json({ message: "Ticket not found" });
      res.json(updated);
    } catch (error) {
      console.error("Update ticket error:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  app.delete("/api/tickets/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as any;
      const deleted = await storage.softDeleteTicket(id);
      if (!deleted) return res.status(404).json({ message: "Ticket not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete ticket error:", error);
      res.status(500).json({ message: "Failed to delete ticket" });
    }
  });

  // Sales report routes
  app.get("/api/sales-reports", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ message: "Start date and end date are required" });
      }

      const reports = await storage.getSalesReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching sales reports:", error);
      res.status(500).json({ message: "Failed to fetch sales reports" });
    }
  });

  app.post(
    "/api/sales-reports/generate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { date } = req.body;

        if (!date) {
          return res.status(400).json({ message: "Date is required" });
        }

        const report = await storage.generateDailySalesReport(date, {});
        await storage.logActivity(
          userId,
          "GENERATE",
          "SALES_REPORT",
          report.id,
          `Generated sales report for ${date}`,
        );

        res.json(report);
      } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({ message: "Failed to generate sales report" });
      }
    },
  );

  // Booking edit and delete routes
  app.patch("/api/bookings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Only validate the fields that can be updated
      const updateData = {
        guests: req.body.guests ? Number(req.body.guests) : undefined,
        phoneNumber: req.body.phoneNumber || null,
        totalAmount: req.body.totalAmount
          ? Number(req.body.totalAmount)
          : undefined,
        cashAmount: req.body.cashAmount
          ? Number(req.body.cashAmount)
          : undefined,
        upiAmount: req.body.upiAmount ? Number(req.body.upiAmount) : undefined,
        snacksAmount: req.body.snacksAmount
          ? Number(req.body.snacksAmount)
          : undefined,
        snacksCash: req.body.snacksCash
          ? Number(req.body.snacksCash)
          : undefined,
        snacksUpi: req.body.snacksUpi ? Number(req.body.snacksUpi) : undefined,
        isEighteenPlus:
          req.body.isEighteenPlus !== undefined
            ? req.body.isEighteenPlus
            : undefined,
        visited: req.body.visited !== undefined ? req.body.visited : undefined,
        reasonNotEighteen:
          req.body.reasonNotEighteen !== undefined
            ? req.body.reasonNotEighteen
            : undefined,
        reasonNotVisited:
          req.body.reasonNotVisited !== undefined
            ? req.body.reasonNotVisited
            : undefined,
        customerName:
          req.body.customerName !== undefined
            ? req.body.customerName
            : undefined,
      };

      // Remove undefined fields
      Object.keys(updateData).forEach((key) => {
        if ((updateData as any)[key] === undefined) {
          delete (updateData as any)[key];
        }
      });

      const updatedBooking = await storage.updateBooking(id, updateData);

      // Update calendar event if it exists
      try {
        const calendarEvent = await storage.getCalendarEventByBookingId(id);
        if (calendarEvent && updatedBooking) {
          const phoneInfo = updatedBooking.phoneNumber
            ? ` Phone: ${updatedBooking.phoneNumber}.`
            : "";
          await storage.updateCalendarEvent(calendarEvent.id, {
            title: `${updatedBooking.theatreName} Booking - ${updatedBooking.guests} guests`,
            description: `Theatre booking for ${updatedBooking.guests} guests. Total: ₹${updatedBooking.totalAmount}.${phoneInfo} Updated by: ${userId}`,
          });

          // Notify external calendar integration about update (include phone)
          try {
            await sendWebhookNotification("update", {
              bookingId: id,
              eventData: {
                title: `${updatedBooking.theatreName} Booking - ${updatedBooking.guests} guests`,
                description: `Theatre booking for ${updatedBooking.guests} guests. Total: ₹${updatedBooking.totalAmount}.${phoneInfo} Updated by: ${userId}`,
                phoneNumber: updatedBooking.phoneNumber || null,
              },
            });
          } catch {}
        }
      } catch (calendarError) {
        console.error("Failed to update calendar event:", calendarError);
      }

      await storage.logActivity(
        userId,
        "UPDATE",
        "BOOKING",
        id,
        `Updated booking details`,
      );

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { reason, comment } = req.body;

      if (!reason) {
        return res
          .status(400)
          .json({ message: "Reason for deletion is required" });
      }

      // Delete calendar event first
      try {
        const calendarEvent = await storage.getCalendarEventByBookingId(id);
        if (calendarEvent) {
          await storage.deleteCalendarEvent(calendarEvent.id);
        }
        await sendWebhookNotification("delete", {
          bookingId: id,
          reason,
          comment,
          // include last-known phone for downstream cleanup (if present)
          phoneNumber: (calendarEvent as any)?.description?.match(/Phone:\s*(\+?\d+)/)?.[1] || null,
        });
      } catch (calendarError) {
        console.error("Failed to delete calendar event:", calendarError);
      }

      await storage.deleteBooking(id);
      const logDetails = `Deleted booking - Reason: ${reason}${comment ? `, Comment: ${comment}` : ""}`;
      await storage.logActivity(userId, "DELETE", "BOOKING", id, logDetails);

      res.json({ success: true, message: "Booking deleted successfully" });
    } catch (error) {
      console.error("Error deleting booking:", error);
      res.status(500).json({ message: "Failed to delete booking" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch(
    "/api/admin/users/:id/role",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const currentUser = await storage.getUser(req.user.claims.sub);
        if (currentUser?.role !== "admin") {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { id } = req.params;
        const { role } = req.body;

        if (!["admin", "employee"].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }

        const updatedUser = await storage.updateUserRole(id, role);
        await storage.logActivity(
          req.user.claims.sub,
          "UPDATE",
          "USER_ROLE",
          id,
          `Updated user role to ${role}`,
        );

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ message: "Failed to update user role" });
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
