import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Bookings from "@/pages/bookings";
import Analytics from "@/pages/analytics";
import Expenses from "@/pages/expenses";
import AdSpendPage from "@/pages/ad-spend";
import AdAnalyticsPage from "@/pages/ad-analytics";
import DailyIncomePage from "@/pages/daily-income";
import LeaveManagement from "@/pages/leave-management";
import UserManagement from "@/pages/user-management";
import Configuration from "@/pages/configuration";
import CRM from "@/pages/crm";
import FollowUps from "@/pages/follow-ups";
import FeedbackManagement from "@/pages/feedback-management";
import RefundsPage from "@/pages/refunds";
import AdminSettings from "@/pages/admin-settings";
import LoginTrackerPage from "@/pages/login-tracker";
import NotFound from "@/pages/not-found";
import CustomerTicketsPage from "@/pages/customer-tickets";
import AdminLeavePage from "@/pages/admin-leave";
import NotificationsPage from "@/pages/notifications";
import LeadInfoPage from "@/pages/lead-info";
// Public pages
import QuickSigninPage from "@/pages/quick-signin";
import MyBookingsPage from "@/pages/my-bookings";
import ReviewsPage from "@/pages/reviews";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-neutral-700 border-t-rosae-red animate-spin" />
            <img src="/rosae-logo.jpg" alt="ROSAE" className="w-8 h-8 rounded absolute inset-0 m-auto shadow" />
          </div>
          <p className="mt-4 text-neutral-400 text-sm tracking-wide">Please wait…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/quick-signin" component={QuickSigninPage} />
        <Route path="/my-bookings" component={MyBookingsPage} />
        <Route path="/reviews" component={ReviewsPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/bookings" component={Bookings} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/ad-spend" component={AdSpendPage} />
      <Route path="/ad-analytics" component={AdAnalyticsPage} />
      <Route path="/daily-income" component={DailyIncomePage} />
      <Route path="/leave-management" component={LeaveManagement} />
      <Route path="/admin/leave" component={AdminLeavePage} />
      <Route path="/user-management" component={UserManagement} />
      <Route path="/configuration" component={Configuration} />
      <Route path="/crm" component={CRM} />
      <Route path="/follow-ups" component={FollowUps} />
      <Route path="/feedback-management" component={FeedbackManagement} />
      <Route path="/refunds" component={RefundsPage} />
      <Route path="/admin-settings" component={AdminSettings} />
      <Route path="/customer-tickets" component={CustomerTicketsPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/lead-info" component={LeadInfoPage} />
      <Route path="/login-tracker" component={LoginTrackerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </SidebarProvider>
    </QueryClientProvider>
  );
}

export default App;
