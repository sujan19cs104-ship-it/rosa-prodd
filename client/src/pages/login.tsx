import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIsLoading(false);
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setIsLoading(false);
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const user = await response.json();
        toast({
          title: "Welcome back",
          description: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
        });
        
        // Invalidate the auth query to force a refresh
        queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
        setLocation('/');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Invalid email or password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-neutral-900 border-neutral-800 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rosae-red to-rosae-dark-red flex items-center justify-center shadow-lg mb-3">
                <span className="text-white text-2xl font-bold">r</span>
              </div>
              <CardTitle className="text-2xl font-bold text-white">ROSAE</CardTitle>
              <CardDescription className="text-neutral-400">Theatre Management System</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-red-200">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-neutral-300">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-rosae-red focus:ring-rosae-red/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-neutral-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 pr-12 focus:border-rosae-red focus:ring-rosae-red/20"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-200"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-rosae-red hover:bg-rosae-dark-red text-white font-medium shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    <span>Signing in…</span>
                  </div>
                ) : (
                  <span>Sign in</span>
                )}
              </Button>

              {/* Helper text removed as requested */}
            </form>

            <div className="text-center">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent mb-4" />
              <p className="text-sm text-neutral-400">
                Need access? <span className="text-rosae-red">Contact your administrator</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-[11px] text-neutral-400/90 tracking-wide select-none">
            <span className="opacity-90">Copyright</span>
            <span className="mx-1">©</span>
            <span className="opacity-95">2024</span>
            <span className="mx-1">by</span>
            <span className="font-medium text-neutral-300">QUANTELLOVENTURES PRIVATE LIMITED</span>
          </p>
        </div>
      </div>
    </div>
  );
}