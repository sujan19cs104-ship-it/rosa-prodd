import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Theater, BarChart3, Users, Calendar } from "lucide-react";

export default function Landing() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rosae-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rosae-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-rosae-red rounded-2xl flex items-center justify-center mr-4">
              <Theater className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-5xl font-bold text-white">ROSAE</h1>
              <p className="text-gray-400 text-lg">Theatre Management System</p>
            </div>
          </div>
          <h2 className="text-3xl font-semibold mb-4">
            Streamline Your Theatre Operations
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Comprehensive theatre rental business management with detailed booking entry, 
            financial tracking, analytics, and employee management features.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            className="bg-rosae-red hover:bg-rosae-dark-red px-8 py-3 text-lg"
            data-testid="button-login"
          >
            Sign In to Continue
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6 text-center">
              <BarChart3 className="w-12 h-12 text-rosae-red mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Analytics</h3>
              <p className="text-gray-400">
                Comprehensive data visualization with multiple chart types and financial insights.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6 text-center">
              <Theater className="w-12 h-12 text-rosae-red mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Bookings</h3>
              <p className="text-gray-400">
                Easy booking entry with comprehensive form validation and payment tracking.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6 text-center">
              <Users className="w-12 h-12 text-rosae-red mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Team Management</h3>
              <p className="text-gray-400">
                User management with role-based access and activity logging.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-rosae-dark-gray border-gray-600">
            <CardContent className="p-6 text-center">
              <Calendar className="w-12 h-12 text-rosae-red mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Leave Management</h3>
              <p className="text-gray-400">
                Complete leave application system with calendar interface and approvals.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-gray-400 mb-4">
            Trusted by theatre businesses for comprehensive operational management
          </p>
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
            <span>✓ Real-time Analytics</span>
            <span>✓ Financial Tracking</span>
            <span>✓ Multi-user Support</span>
            <span>✓ Mobile Responsive</span>
          </div>
        </div>
      </div>
    </div>
  );
}
