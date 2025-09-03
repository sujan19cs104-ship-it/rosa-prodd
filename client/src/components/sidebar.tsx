import { useLocation } from "wouter";
import { useAuth, type User } from "@/hooks/useAuth";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  Theater,
  BarChart3, 
  Plus, 
  Ticket, 
  PieChart, 
  Wallet, 
  Calendar, 
  Users,
  LogOut,
  Shield,
  ClipboardCheck,
  X,
  MoreHorizontal,
  TrendingUp,
  Target,
  IndianRupee,
  UserCheck,
  CalendarDays,
  Bell
} from "lucide-react";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Expenses", href: "/expenses", icon: Wallet },
  { name: "Analytics", href: "/analytics", icon: PieChart },
  { name: "CRM", href: "/crm", icon: UserCheck },
  { name: "New Booking", href: "/bookings", icon: Plus, action: "new-booking" },
  { name: "All Bookings", href: "/bookings", icon: Ticket },
  { name: "Daily Income", href: "/daily-income", icon: IndianRupee },
  { name: "Feedback Management", href: "/feedback-management", icon: Calendar },
  { name: "Follow-ups", href: "/follow-ups", icon: CalendarDays },
  { name: "LeadInfo", href: "/lead-info", icon: CalendarDays },
  { name: "Customer Tickets", href: "/customer-tickets", icon: Ticket },
  { name: "Refunds", href: "/refunds", icon: Wallet },
  { name: "Leave Management", href: "/leave-management", icon: Calendar },
];

const adminOnlyItems = [
  { name: "Ad Spend", href: "/ad-spend", icon: Target },
  { name: "Ad Analytics", href: "/ad-analytics", icon: TrendingUp },
  { name: "User Management", href: "/user-management", icon: Users },
];

const adminNavigationItems = [
  { name: "Leave Admin", href: "/admin/leave", icon: Calendar, adminOnly: true },
  { name: "Login Tracker", href: "/login-tracker", icon: Users, adminOnly: true },
  { name: "Others", href: "/admin-settings", icon: MoreHorizontal, adminOnly: true },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOpen, close } = useSidebar();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast({
          title: "Logged out successfully",
          description: "You have been logged out of the system",
        });
        window.location.reload();
      } else {
        toast({
          title: "Logout failed",
          description: "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={close}
          data-testid="sidebar-overlay"
        />
      )}
      
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-rosae-dark-gray shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out z-50",
          "lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar-panel"
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center space-x-3 group" title="Go to Dashboard">
              <img src="/rosae-logo.jpg" alt="ROSAE logo" className="w-10 h-10 object-contain rounded shadow-md ring-1 ring-rosae-red/40 group-hover:ring-rosae-red/70 transition" />
              <div className="leading-tight">
                <h1 className="text-xl font-extrabold tracking-wide text-white group-hover:text-rosae-red transition-colors" data-testid="text-brand-name">ROSAE</h1>
                <p className="text-gray-400 text-xs">Theatre Management</p>
              </div>
            </a>
            <button
              onClick={close}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
              data-testid="button-close-sidebar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

      {/* Navigation */}
      <nav className="mt-6 flex-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || 
            (item.href === "/" && location === "/") ||
            (item.href !== "/" && location.startsWith(item.href));

          // Handle special actions like new-booking
          if (item.action === "new-booking") {
            return (
              <button
                key={item.name}
                onClick={(e) => {
                  e.preventDefault();
                  // Navigate to the bookings page and set a URL parameter to trigger the modal
                  window.location.href = `${item.href}?action=new`;
                }}
                className={cn(
                  "flex items-center px-6 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors w-full text-left",
                  isActive && "text-white bg-rosae-red/20 border-r-4 border-rosae-red"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="mr-3 w-5 h-5" />
                {item.name}
              </button>
            );
          }

          return (
            <a
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-6 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors",
                isActive && "text-white bg-rosae-red/20 border-r-4 border-rosae-red"
              )}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon className="mr-3 w-5 h-5" />
              {item.name}
            </a>
          );
        })}
        
        {/* Admin-only navigation */}
        {user && user.role === 'admin' && (
          <div className="mt-6 border-t border-gray-600 pt-6">
            {adminOnlyItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-6 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors",
                    isActive && "text-white bg-rosae-red/20 border-r-4 border-rosae-red"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="mr-3 w-5 h-5" />
                  {item.name}
                </a>
              );
            })}
            {adminNavigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-6 py-3 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors",
                    isActive && "text-white bg-rosae-red/20 border-r-4 border-rosae-red"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="mr-3 w-5 h-5" />
                  {item.name}
                </a>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Profile Section */}
      <div className="p-6 border-t border-gray-600">
        <div className="flex items-center space-x-3">
          {user && user.profileImageUrl ? (
            <img 
              src={user.profileImageUrl} 
              alt="User Avatar" 
              className="w-10 h-10 rounded-full object-cover"
              data-testid="img-user-avatar"
            />
          ) : (
            <div className="w-10 h-10 bg-rosae-red/20 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-rosae-red" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-white" data-testid="text-user-name">
              {user && (user.firstName || user.lastName) ? 
                `${user.firstName || ''} ${user.lastName || ''}`.trim() : 
                'User'
              }
            </p>
            <p className="text-xs text-gray-400" data-testid="text-user-role">
              {user && user.role === 'admin' ? 'Admin' : 'Employee'}
            </p>
          </div>
          <a href="/notifications" className="text-gray-300 hover:text-white transition-colors" title="Notifications">
            <Bell className="w-5 h-5" />
          </a>
          <button 
            onClick={() => {
              // Reset session timer on logout
              try { localStorage.removeItem("loginStart"); } catch {}
              handleLogout();
            }}
            className="text-gray-400 hover:text-white transition-colors"
            title="Sign Out"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
