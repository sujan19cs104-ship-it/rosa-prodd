# ROSAE Theatre Management System

## Overview
A comprehensive theatre management system with booking management, customer tracking, analytics, and staff management features.

## Recent Changes
- **September 3, 2025**: Initial setup completed for Replit environment
  - Fixed TypeScript configuration issues with import.meta.dirname
  - Configured Vite dev server for host 0.0.0.0:5000
  - Set up workflow to run application
  - Database (SQLite) initialized successfully
  - Deployment configuration set for VM with npm build/start

## Project Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI
- **Backend**: Express.js + TypeScript + Drizzle ORM
- **Database**: SQLite with comprehensive schema for bookings, users, expenses, etc.
- **Authentication**: Custom auth system with sessions
- **Features**: 
  - Booking management
  - Customer tracking and reviews
  - Staff leave management  
  - Analytics and reporting
  - Expense tracking
  - Ad spend tracking

## Technical Setup
- **Development**: `npm run dev` - runs on port 5000
- **Production**: `npm run build && npm start`
- **Database**: SQLite file `rosae.db` with auto-migration support
- **Host Configuration**: Configured for Replit proxy environment

## Current State
✅ Fully functional and ready for development/production use
✅ Database initialized with sample data
✅ All dependencies installed and configured
✅ Development workflow active on port 5000