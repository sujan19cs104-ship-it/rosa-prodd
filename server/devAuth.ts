import type { Express, RequestHandler } from "express";
import session from "express-session";
import { storage } from "./storage";

// Development mode authentication bypass
export async function setupDevAuth(app: Express) {
  // Set up session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'rosae-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  }));

  // Development login endpoint
  app.get("/api/login", (req, res) => {
    // In dev mode, redirect to a dev login page that sets up a session
    res.redirect("/api/dev-login");
  });

  app.get("/api/dev-login", async (req, res) => {
    try {
      // Create a simple admin user
      const adminUser = {
        id: "admin-001", // Match the ID used in the session
        email: "rosaeleisure@gmail.com",
        first_name: "ROSAE",
        last_name: "Admin",
        profile_image_url: null,
        role: "admin",
      };

      // Create the user in the database
      try {
        console.log("Creating user in database:", adminUser);
        const createdUser = await storage.upsertUser(adminUser);
        console.log("User created successfully:", createdUser);
      } catch (dbError) {
        console.error("Error creating user in database:", dbError);
        // Continue anyway - the session will still work
      }

      // Set up a mock session
      (req as any).session.user = {
        claims: {
          sub: adminUser.id,
          email: adminUser.email,
          first_name: adminUser.first_name,
          last_name: adminUser.last_name,
          profile_image_url: adminUser.profile_image_url,
          role: adminUser.role, // Add role to claims
        },
        access_token: "dev-token",
        refresh_token: "dev-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      res.redirect("/?logged_in=true");
    } catch (error) {
      console.error("Dev login error:", error);
      res.status(500).json({ message: "Dev login failed" });
    }
  });

  app.get("/api/logout", (req, res) => {
    if ((req as any).session) {
      (req as any).session.destroy();
    }
    res.redirect("/");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check if user is authenticated via session
  const sessionUser = (req as any).session?.user;

  if (!sessionUser) {
    return res.status(401).json({ message: "Unauthorized - Please login" });
  }

  // Attach user to request
  (req as any).user = sessionUser;
  next();
};

// Role-based access control middleware
export const requireRole = (allowedRoles: string[]): RequestHandler => {
  return async (req, res, next) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - Please login" });
    }

    // Get user role from database
    try {
      const dbUser = await storage.getUserById(user.claims.sub);
      const userRole = dbUser?.role || 'employee';
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}` 
        });
      }
      
      // Attach role to request for easy access
      (req as any).userRole = userRole;
      next();
    } catch (error) {
      console.error("Error checking user role:", error);
      return res.status(500).json({ message: "Error verifying user permissions" });
    }
  };
};

// Convenience middleware for admin-only access
export const requireAdmin: RequestHandler = requireRole(['admin']);