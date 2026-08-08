import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalUser } from "@/hooks/use-local-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Clock, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Plan {
  id: number; planName: string; slug: string; price: number;
  durationInMonths: number; features: string[]; isActive: boolean; sortOrder: number;
}

interface PaymentNumbers { bkashNumber: string; nagadNumber: string; }
interface PendingStatus { hasPending: boolean; request: { id: number; paymentMethod: string; trxId: string } | null; }

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

type ModalStep = "instructions" | "form";

export default function Pricing() {
  const { isAuthenticated, user } = useLocalUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [modal, setModal] = useState<Plan | null>(null);
  const [step, setStep] = useState<ModalStep>("instructions");
  const [payMethod, setPayMethod] = useState<"bKash" | "Nagad">("bKash");
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["public-pricing-plans"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/pricing-plans`);
      return r.json();
    },
  });

  const { data: payNumbers } = useQuery<PaymentNumbers>({
    queryKey: ["payment-numbers"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/payments/numbers`);
      return r.json();
    },
    enabled: isAuthenticated,
  });

  const { data: pendingStatus, refetch: refetchPending } = useQuery<PendingStatus>({
    queryKey: ["payment-pending"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/payments/pending`);
      return r.json();
    },
    enabled: isAuthenticated,
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!modal) throw new Error("No plan selected");
      const r = await fetch(`${BASE_URL}/api/payments/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: modal.id, paymentMethod: payMethod, senderNumber, trxId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Submission failed");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payment-pending"] });
      void refetchPending();
      closeModal();
      toast({
        title: "Payment submitted!",
        description: "Your payment is pending admin verification. We'll upgrade your account once approved.",
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const allPlans: Plan[] = [FREE_PLAN as Plan, ...plans];
  const currentPlan = user?.subscriptionPlan ?? "free";
  const hasPending = pendingStatus?.hasPending ?? false;

  const openModal = (plan: Plan) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to subscribe." });
      navigate("/sign-in");
      return;
    }
    setModal(plan);
    setStep("instructions");
    setPayMethod("bKash");
    setSenderNumber("");
    setTrxId("");
  };

  const closeModal = () => {
    setModal(null);
    setSenderNumber("");
    setTrxId("");
  };

  const activeNumber = payMethod === "bKash" ? (payNumbers?.bkashNumber ?? "") : (payNumbers?.nagadNumber ?? "");

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
          <p className="text-stone-500 max-w-md mx-auto">Start free, upgrade when you're ready. Pay via bKash or Nagad — no card required.</p>
          {isAuthenticated && currentPlan !== "free" && (
            <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 inline-block px-4 py-2 rounded-full">
              ✓ You're on the <strong>{currentPlan}</strong> plan
              {user?.subscriptionExpiry && <> · expires {new Date(user.subscriptionExpiry).toLocaleDateString()}</>}
            </p>
          )}
          {hasPending && (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2.5 rounded-xl text-sm">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Your payment is pending verification. We'll upgrade your account once an admin approves it.</span>
            </div>
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
              const isDisabled = isFree || isCurrentPlan || hasPending;
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
                    onClick={() => !isDisabled && openModal(plan)}
                    disabled={isDisabled}
                    className={cn(
                      "w-full rounded-xl py-2.5 font-semibold",
                      highlighted ? "bg-amber-400 hover:bg-amber-300 text-stone-900"
                        : isCurrentPlan ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                        : isFree ? "bg-stone-100 text-stone-400 cursor-default"
                        : hasPending ? "bg-amber-50 text-amber-600 border border-amber-200 cursor-default"
                        : "bg-stone-900 hover:bg-stone-800 text-white",
                    )}
                  >
                    {isCurrentPlan ? "Current plan ✓"
                      : isFree ? "Always free"
                      : hasPending ? "Verification pending…"
                      : "Subscribe via bKash / Nagad"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-stone-400 mt-12">Pay via bKash or Nagad. Your subscription activates after manual verification by our team.</p>
      </div>

      {/* Payment Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">

            {step === "instructions" ? (
              <>
                <h2 className="text-xl font-semibold text-stone-900 mb-1">Pay to subscribe</h2>
                <p className="text-stone-500 text-sm mb-6">
                  Subscribe to <strong>{modal.planName}</strong> — ৳{modal.price}{" "}
                  / {modal.durationInMonths === 1 ? "month" : `${modal.durationInMonths} months`}
                </p>

                <div className="mb-5">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Pay via</p>
                  <div className="flex rounded-xl border border-stone-200 overflow-hidden">
                    {(["bKash", "Nagad"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPayMethod(m)}
                        className={cn(
                          "flex-1 py-2.5 text-sm font-semibold transition-colors",
                          payMethod === m ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 space-y-2 text-sm text-amber-900">
                  <p className="font-semibold">Send money and get verified</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-amber-800">
                    <li>Open your <strong>{payMethod}</strong> app</li>
                    <li>
                      Send <strong>৳{modal.price}</strong> to{" "}
                      <span className="font-mono font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                        {activeNumber || "—"}
                      </span>
                    </li>
                    <li>Copy your <strong>Transaction ID</strong></li>
                    <li>Click Next and fill in the form</li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={closeModal} className="flex-1 border-stone-200">Cancel</Button>
                  <Button onClick={() => setStep("form")} className="flex-1 bg-stone-900 hover:bg-stone-800 text-white">
                    I've sent the money →
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-stone-900 mb-1">Enter payment details</h2>
                <p className="text-stone-500 text-sm mb-6">We'll verify your transaction and activate your subscription.</p>

                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Payment method</p>
                    <div className="flex rounded-xl border border-stone-200 overflow-hidden">
                      {(["bKash", "Nagad"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPayMethod(m)}
                          className={cn(
                            "flex-1 py-2.5 text-sm font-semibold transition-colors",
                            payMethod === m ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide block mb-1.5">
                      Your {payMethod} number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 01XXXXXXXXX"
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide block mb-1.5">
                      Transaction ID (TrxID)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ABC123DEF456"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value.trim())}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-stone-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("instructions")} disabled={submitPayment.isPending} className="flex-1 border-stone-200">
                    ← Back
                  </Button>
                  <Button
                    onClick={() => submitPayment.mutate()}
                    disabled={submitPayment.isPending || !senderNumber.trim() || !trxId.trim()}
                    className="flex-1 bg-stone-900 hover:bg-stone-800 text-white"
                  >
                    {submitPayment.isPending ? "Submitting…" : "Submit for verification"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
