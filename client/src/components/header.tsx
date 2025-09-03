import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BookingModal } from "./booking-modal";
import { Bell, Ticket } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const pageMetadata = {
  "/": {
    title: "Dashboard Overview",
    description: "Welcome back, manage your theatre operations"
  },
  "/bookings": {
    title: "Theatre Bookings",
    description: "Manage and view all theatre bookings"
  },
  "/analytics": {
    title: "Analytics Dashboard", 
    description: "Comprehensive data visualization and business insights"
  },
  "/expenses": {
    title: "Expense Management",
    description: "Track and manage all business expenses"
  },
  "/leave-management": {
    title: "Leave Management",
    description: "Manage leave applications and approvals"
  },
  "/user-management": {
    title: "User Management",
    description: "Manage users and their access permissions"
  },
  "/lead-info": {
    title: "Lead Info",
    description: "Record shifts and analyze lead quality & calls"
  }
};

export default function Header() {
  const [location] = useLocation();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const { data: notifications } = useQuery<any[]>({ queryKey: ["/api/notifications"] });
  const unreadCount = (notifications || []).filter(n => !n.isRead).length;
  const markAllRead = useMutation({
    mutationFn: async () => {
      for (const n of notifications || []) {
        if (!n.isRead) await apiRequest("PATCH", `/api/notifications/${n.id}/read`, { isRead: true });
      }
    }
  });

  const currentPage = pageMetadata[location as keyof typeof pageMetadata] || pageMetadata["/"];

  return (
    <>
      <header className="bg-rosae-dark-gray shadow-sm border-b border-gray-600">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white" data-testid="text-page-title">
                {currentPage.title}
              </h2>
              <p className="text-gray-400" data-testid="text-page-description">
                {currentPage.description}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => setIsBookingModalOpen(true)}
                className="bg-rosae-red hover:bg-rosae-dark-red px-6 py-2 rounded-lg font-medium transition-colors"
                data-testid="button-header-quick-booking"
              >
                <Ticket className="mr-2 w-4 h-4" />
                Quick Booking
              </Button>
              <button 
                className="relative p-2 text-gray-400 hover:text-white transition-colors"
                data-testid="button-notifications"
                onClick={() => markAllRead.mutate()}
                title="Mark all notifications as read"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rosae-red text-xs rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

            </div>
          </div>
        </div>
      </header>

      <BookingModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)} 
      />
    </>
  );
}
