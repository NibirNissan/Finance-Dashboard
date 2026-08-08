import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/landing";
import Profile from "@/pages/profile";
import Pricing from "@/pages/pricing";
import Admin from "@/pages/admin";
import { useLocalUser } from "@/hooks/use-local-user";

// ── Clerk config (copy verbatim — resolved at runtime from hostname) ──────────
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#1C1917",
    colorForeground: "#1C1917",
    colorMutedForeground: "#78716c",
    colorDanger: "#EF4444",
    colorBackground: "#ffffff",
    colorInput: "#F5F0E8",
    colorInputForeground: "#1C1917",
    colorNeutral: "#E7E5E4",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-stone-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-stone-900 font-semibold",
    headerSubtitle: "text-stone-500",
    socialButtonsBlockButtonText: "text-stone-900 font-medium",
    formFieldLabel: "text-stone-700 font-medium text-xs uppercase tracking-wide",
    footerActionLink: "text-stone-900 font-semibold",
    footerActionText: "text-stone-500",
    dividerText: "text-stone-400 text-xs",
    identityPreviewEditButton: "text-stone-600",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-stone-800",
    logoBox: "flex justify-center pb-1",
    logoImage: "h-9 w-auto",
    socialButtonsBlockButton:
      "border border-stone-200 hover:bg-stone-50 transition-colors rounded-xl",
    formButtonPrimary:
      "bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl",
    formFieldInput:
      "bg-[#F5F0E8] border-stone-200 text-stone-900 rounded-xl focus:border-stone-400",
    footerAction: "bg-stone-50 border-t border-stone-100",
    dividerLine: "bg-stone-200",
    alert: "bg-amber-50 border border-amber-200 rounded-xl",
    otpCodeFieldInput:
      "bg-[#F5F0E8] border-stone-200 text-stone-900 rounded-xl",
    formFieldRow: "",
    main: "",
  },
};

const queryClient = new QueryClient();

// ── Sign-in / sign-up page wrappers ──────────────────────────────────────────
function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F0E8] px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F0E8] px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

// ── Cache invalidation on user change ────────────────────────────────────────
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// ── Route guards ──────────────────────────────────────────────────────────────
function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate("/dashboard");
  }, [isSignedIn, isLoaded, navigate]);

  if (!isLoaded) return null;
  if (isSignedIn) return null;
  return <Landing />;
}

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate("/");
  }, [isSignedIn, isLoaded, navigate]);

  if (!isLoaded || !isSignedIn) return null;
  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useLocalUser();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { navigate("/"); return; }
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [isSignedIn, isLoaded, user, navigate]);

  if (!isLoaded || !isSignedIn || !user || user.role !== "admin") return null;
  return <Component />;
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/pricing" component={Pricing} />
      {/* REQUIRED: /*? optional wildcard handles Clerk's OAuth sub-paths */}
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/dashboard">
        {() => <PrivateRoute component={Dashboard} />}
      </Route>
      <Route path="/profile">
        {() => <PrivateRoute component={Profile} />}
      </Route>
      <Route path="/admin">
        {() => <AdminRoute component={Admin} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// ── ClerkProvider must be inside WouterRouter to use useLocation ──────────────
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
