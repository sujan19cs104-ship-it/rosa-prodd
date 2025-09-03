import { Sidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, Clock, User, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function LayoutContent({ children }: LayoutProps) {
  const { isOpen, toggle } = useSidebar();
  const { user, isAuthenticated } = useAuth();
  const [now, setNow] = useState(Date.now());
  const { data: notifications } = useQuery<any[]>({ queryKey: ["/api/notifications"], queryFn: async () => {
    const res = await fetch('/api/notifications', { credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }});
  const unreadCount = (notifications || []).filter((n: any) => !n.isRead).length;

  // Ensure login start is set when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const key = "loginStart";
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, Date.now().toString());
      }
    }
  }, [isAuthenticated]);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessionTime = useMemo(() => {
    const start = Number(localStorage.getItem("loginStart"));
    if (!start) return "00:00:00";
    return formatDuration(now - start);
  }, [now]);

  const username = useMemo(() => {
    const email = user?.email || "";
    return email.includes("@") ? email.split("@")[0] : email || "User";
  }, [user?.email]);

  return (
    <div className="flex min-h-screen bg-rosae-black">
      <Sidebar />
      <main className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        "lg:ml-0",
        isOpen ? "lg:ml-0" : "lg:ml-0"
      )}>
        {/* Mobile header with hamburger menu */}
        <div className="lg:hidden bg-rosae-dark-gray border-b border-gray-600 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className="text-white hover:bg-gray-700"
            data-testid="button-open-sidebar"
          >
            <Menu className="w-6 h-6" />
          </Button>
        </div>

        {/* Top bar: brand + username + session timer + notifications */}
        <div className="w-full bg-rosae-dark-gray border-b border-gray-600 px-4 py-2 flex items-center justify-between gap-4">
          {/* Brand (click to dashboard) */}
          <a href="/" className="flex items-center gap-2 group" title="Go to Dashboard">
            <img src="/rosae-logo.jpg" alt="ROSAE" className="w-8 h-8 object-contain rounded shadow ring-1 ring-rosae-red/40 group-hover:ring-rosae-red/70" />
            <span className="hidden sm:block font-semibold tracking-wide text-white group-hover:text-rosae-red">ROSAE</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/notifications" className="relative text-gray-300 hover:text-white" title="Notifications">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </a>
            <div className="flex items-center text-gray-300 text-sm gap-2">
              <User className="w-4 h-4" />
              <span className="font-medium">{username}</span>
            </div>
            <div className="flex items-center text-gray-300 text-sm gap-2">
              <Clock className="w-4 h-4" />
              <span title="Session duration">{sessionTime}</span>
            </div>
          </div>
        </div>

        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}

export default Layout;