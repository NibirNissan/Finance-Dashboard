import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocalUser } from "@/hooks/use-local-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Plan {
  id: number; planName: string; slug: string; price: number;
  durationInMonths: number; features: string[]; isActive: boolean; sortOrder: number;
}

const PLAN_ICONS: Record<number, typeof Zap> = { 0: Zap, 1: Crown };
const DEFAULT_ICON = Crown;

const FREE_PLAN = {
  id: 0,
  planName: "Basic",
  slug: "free",
  price: 0,
  durationInMonths: 0,
  features: ["Up to 20 expenses / month", "3 categories", "Monthly summary view", "Manual PDF export"],
  isActive: true,
  sortOrder: -1,
};

export default function Pricing() {
  const { isAuthenticated, user, updateUser } = useLocalUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [modal, setModal] = useState<Plan | null>(null);
  const [paying, setPaying] = useState(false);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["public-pricing-plans"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/pricing-plans`);
      return r.json();
    },
  });

  const allPlans: Plan[] = [FREE_PLAN as Plan, ...plans];
  const currentPlan = user?.subscriptionPlan ?? "free";

  const handleSubscribe = (plan: Plan) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to subscribe." });
      navigate("/sign-in");
      return;
    }
    setModal(plan);
  };

  const confirmPayment = async () => {
    if (!modal) return;
    setPaying(true);
    try {
      const res = await fetch(`${BASE_URL}/api/subscription/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: modal.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      updateUser(data.user);
      setModal(null);
      toast({ title: "Subscription activated!", description: `You're now on the ${modal.planName} plan.` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Payment failed", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const isHighlighted = (plan: Plan) => plan === plans[plans.length - 1] && plans.length > 0;

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <div className="border-b border-stone-200 bg-[#F5F0E8]/90 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate(isAuthenticated ? "/dashboard" : "/")} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="font-semibold text-stone-900 tracking-tight">expanse · Pricing</span>
        {!isAuthenticated ? (
          <button onClick={() => navigate("/")} className="text-sm bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors">Sign in</button>
        ) : <div className="w-16" />}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-serif font-bold text-stone-900 mb-3">Choose your plan</h1>
          <p className="text-stone-500 max-w-md mx-auto">Start free, upgrade when you're ready. No hidden fees. Cancel any time.</p>
          {isAuthenticated && currentPlan !== "free" && (
            <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 inline-block px-4 py-2 rounded-full">
              ✓ You're on the <strong>{currentPlan}</strong> plan
              {user?.subscriptionExpiry && <> · expires {new Date(user.subscriptionExpiry).toLocaleDateString()}</>}
            </p>
          )}
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="text-center py-20 text-stone-400">Loading plans…</div>
        ) : (
          <div className={cn("grid gap-6 items-start", allPlans.length <= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4")}>
            {allPlans.map((plan, i) => {
              const highlighted = isHighlighted(plan);
              const isFree = plan.slug === "free";
              const isCurrentPlan = currentPlan === plan.slug;
              const Icon = PLAN_ICONS[i % Object.keys(PLAN_ICONS).length] ?? DEFAULT_ICON;

              return (
                <div key={plan.id} className={cn(
                  "relative rounded-2xl border p-7 flex flex-col gap-6 transition-shadow",
                  highlighted ? "bg-stone-900 text-white border-stone-700 shadow-2xl scale-[1.02] md:-mt-2 md:-mb-2" : "bg-white border-stone-200 shadow-sm hover:shadow-md",
                )}>
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-400 text-stone-900 text-xs font-bold px-3 py-1 rounded-full shadow">Best Value</span>
                    </div>
                  )}

                  <div>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", highlighted ? "bg-white/10" : "bg-stone-100")}>
                      <Icon className={cn("w-5 h-5", highlighted ? "text-amber-400" : "text-stone-700")} />
                    </div>
                    <h2 className={cn("text-lg font-semibold mb-1", highlighted ? "text-white" : "text-stone-900")}>{plan.planName}</h2>
                    <div className={cn("text-3xl font-bold", highlighted ? "text-white" : "text-stone-900")}>
                      {isFree ? "Free" : `৳${plan.price}`}
                    </div>
                    <div className={cn("text-xs mt-0.5", highlighted ? "text-white/50" : "text-stone-400")}>
                      {isFree ? "forever" : `per ${plan.durationInMonths === 1 ? "month" : `${plan.durationInMonths} months`}`}
                    </div>
                  </div>

                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className={cn("w-4 h-4 mt-0.5 flex-shrink-0", highlighted ? "text-amber-400" : "text-emerald-500")} />
                        <span className={highlighted ? "text-white/80" : "text-stone-600"}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => !isFree && !isCurrentPlan && handleSubscribe(plan)}
                    disabled={isFree || isCurrentPlan}
                    className={cn(
                      "w-full rounded-xl py-2.5 font-semibold",
                      highlighted ? "bg-amber-400 hover:bg-amber-300 text-stone-900"
                        : isCurrentPlan ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                        : isFree ? "bg-stone-100 text-stone-400 cursor-default"
                        : "bg-stone-900 hover:bg-stone-800 text-white",
                    )}
                  >
                    {isCurrentPlan ? "Current plan ✓" : isFree ? "Always free" : "Subscribe"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-stone-400 mt-12">Payments are simulated in this demo. No real charges are made.</p>
      </div>

      {/* Payment Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
            <h2 className="text-xl font-semibold text-stone-900 mb-1">Confirm payment</h2>
            <p className="text-stone-500 text-sm mb-6">You're subscribing to the <strong>{modal.planName}</strong> plan.</p>
            <div className="bg-stone-50 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide font-medium">Total due today</p>
                <p className="text-3xl font-bold text-stone-900 mt-1">৳{modal.price}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {modal.durationInMonths === 1 ? "Billed monthly" : `Billed every ${modal.durationInMonths} months`}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-stone-400 mb-4 text-center">🔒 Simulated payment — no real transaction.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setModal(null)} disabled={paying} className="flex-1 border-stone-200">Cancel</Button>
              <Button onClick={confirmPayment} disabled={paying} className="flex-1 bg-stone-900 hover:bg-stone-800 text-white">
                {paying ? "Processing…" : "Pay now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
