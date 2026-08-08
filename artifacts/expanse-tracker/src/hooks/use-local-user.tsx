import { useAuth, useClerk } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface LocalUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  accountType: "Single Person" | "Family" | null;
  role: "user" | "admin";
  subscriptionPlan: string;
  subscriptionExpiry: string | null;
  status: "active" | "suspended";
}

export function useLocalUser() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const {
    data: user = null,
    isPending: isProfilePending,
  } = useQuery<LocalUser>({
    queryKey: ["local-user-profile"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/user/profile`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 60_000,
    retry: false,
  });

  const logout = () =>
    signOut({ redirectUrl: `${window.location.origin}${basePath || "/"}` });

  const updateUser = (updated: LocalUser) => {
    queryClient.setQueryData(["local-user-profile"], updated);
  };

  // isLoading: true until BOTH Clerk and the profile query have resolved
  const isLoading = !isLoaded || (!!isSignedIn && isProfilePending);

  return {
    user,
    isAuthenticated: !!isSignedIn && isLoaded,
    isLoading,
    logout,
    updateUser,
  };
}
