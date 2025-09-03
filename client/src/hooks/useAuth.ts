import { useQuery } from "@tanstack/react-query";
import React from "react";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string | null;
  role?: 'admin' | 'employee';
  createdAt?: string;
}

import { apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const { data: authStatus, isLoading, error } = useQuery<{ authenticated: boolean; user?: User }>({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/status");
      return await res.json();
    },
    retry: false,
  });

  return {
    user: authStatus?.user,
    isLoading,
    isAuthenticated: authStatus?.authenticated || false,
  };
}
