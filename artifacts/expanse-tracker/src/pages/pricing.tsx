import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalUser } from "@/hooks/use-local-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Crown, Zap, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Plan {
  id: number; planName: string; slug: string; price: number;
  durationInMonths: number; features: string[]; isActive: boolean; sortOrder: number;
}

interface Settings {
  announcementText: string;
  isAnnouncementActive: boolean;
  allowRegistrations: boolean;
  bkashNumber: string;
  nagadNumber: string;
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

type PaymentMethod = "bkash" | "nagad";

interface PaymentForm {
  paymentMethod: PaymentMethod;
  senderNumber: string;
  transactionId: string;
}

export default function Pricing() {
  const { isAuthenticated, user } = useLocalUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [modal, setModal] = useState<Plan | null>(null);
  const [form, setForm] = useState<PaymentForm>({
    paymentMethod: "bkash",
    senderNumber: "",
    transactionId: "",
  });
  const [errors, setErrors] = useState<Partial<PaymentForm>>({});

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["public-pricing-plans"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/pricing-plans`);
      return r.json();
    },
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/settings`);
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
    setForm({ paymentMethod: "bkash", senderNumber: "", transactionId: "" });
    setErrors({});
    setModal(plan);
  };

  const submitMutation = useMutation({
    mutationFn: async (payload: { planId: number; paymentMethod: PaymentMethod; senderNumber: string; transactionId: string }) => {
      const res = await fetch(`${BASE_URL}/api/payments/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      return data;
    },
    onSuccess: () => {
      setModal(null);
      qc.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Payment submitted!",
        description: "Your request is under review. We'll activate your plan once verified.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<PaymentForm> = {};
    if (!form.senderNumber.trim()) newErrors.senderNumber = "Sender number is required";
    if (!form.transactionId.trim()) newErrors.transactionId = "Transaction ID is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!modal || !validate()) return;
    submitMutation.mutate({
      planId: modal.id,
      paymentMethod: form.paymentMethod,
      senderNumber: form.senderNumber.trim(),
      transactionId: form.transactionId.trim(),
    });
  };

  const isHighlighted = (plan: Plan) => plan === plans[plans.length - 1] && plans.length > 0;

  // Pick the number to display based on selected payment method
  const adminNumber = form.paymentMethod === "bkash"
    ? (settings?.bkashNumber || "01XXXXXXXXX")
    : (settings?.nagadNumber || "01XXXXXXXXX");

  const methodLabel = form.paymentMethod === "bkash" ? "bKash" : "Nagad";

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
          <p className="text-stone-500 max-w-md mx-auto">Start free, upgrade when you're ready. Pay via bKash or Nagad — verified manually by our team.</p>
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

        <p className="text-center text-xs text-stone-400 mt-12">Payments are verified manually. Your plan activates within a few hours of admin review.</p>
      </div>

      {/* Payment Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-100 dark:border-slate-700 p-8 w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-stone-900">Complete your payment</h2>
              <button
                onClick={() => !submitMutation.isPending && setModal(null)}
                className="text-stone-400 hover:text-stone-600 transition-colors text-sm"
              >✕</button>
            </div>
            <p className="text-stone-500 text-sm mb-5">
              Subscribing to <strong>{modal.planName}</strong> — <strong>৳{modal.price}</strong>
              {modal.durationInMonths === 1 ? " / month" : ` / ${modal.durationInMonths} months`}
            </p>

            {/* Send-money instruction banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                Step 1 — Send Money
              </p>
              <p className="text-sm text-amber-900">
                Send <strong>৳{modal.price}</strong> to the {methodLabel === "bKash" ? "bKash" : "Nagad"} number below, then fill in the details.
              </p>
              <p className="mt-2 text-lg font-bold text-amber-900 tracking-wider">
                {methodLabel}: <span className="font-mono">{adminNumber}</span>
              </p>
            </div>

            {/* Step 2 label */}
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Step 2 — Enter payment details
            </p>

            {/* Payment Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Payment Method</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => {
                  setForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }));
                  setErrors(err => ({ ...err, paymentMethod: undefined }));
                }}
                disabled={submitMutation.isPending}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
              </select>
            </div>

            {/* Sender Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Your {methodLabel} Number <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. 01712345678"
                value={form.senderNumber}
                onChange={(e) => {
                  setForm(f => ({ ...f, senderNumber: e.target.value }));
                  setErrors(err => ({ ...err, senderNumber: undefined }));
                }}
                disabled={submitMutation.isPending}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-sm text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50",
                  errors.senderNumber ? "border-red-300 bg-red-50" : "border-stone-200",
                )}
              />
              {errors.senderNumber && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3 h-3" /> {errors.senderNumber}
                </p>
              )}
            </div>

            {/* Transaction ID */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Transaction ID (TrxID) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 8AB12C3D4E"
                value={form.transactionId}
                onChange={(e) => {
                  setForm(f => ({ ...f, transactionId: e.target.value }));
                  setErrors(err => ({ ...err, transactionId: undefined }));
                }}
                disabled={submitMutation.isPending}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-sm text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50",
                  errors.transactionId ? "border-red-300 bg-red-50" : "border-stone-200",
                )}
              />
              {errors.transactionId && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3 h-3" /> {errors.transactionId}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setModal(null)}
                disabled={submitMutation.isPending}
                className="flex-1 border-stone-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white"
              >
                {submitMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                  </span>
                ) : "Submit for Verification"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
