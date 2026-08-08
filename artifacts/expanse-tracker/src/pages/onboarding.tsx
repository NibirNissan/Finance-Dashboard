import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { User, Users, Loader2, ArrowRight } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type AccountType = "Single Person" | "Family";

const OPTIONS: {
  value: AccountType;
  icon: typeof User;
  label: string;
  description: string;
  accent: string;
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    value: "Single Person",
    icon: User,
    label: "Single Person",
    description: "Track my personal daily expenses and budgets.",
    accent: "from-amber-500 to-orange-500",
    bg: "bg-stone-900 dark:bg-slate-900",
    border: "border-stone-700 dark:border-slate-700 hover:border-amber-500/60",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
  {
    value: "Family",
    icon: Users,
    label: "Family",
    description: "Collaborate and track household expenses together.",
    accent: "from-emerald-500 to-teal-500",
    bg: "bg-stone-900 dark:bg-slate-900",
    border: "border-stone-700 dark:border-slate-700 hover:border-emerald-500/60",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
];

export default function Onboarding() {
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  async function confirm() {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/user/account-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save. Please try again.");
      }
      // Invalidate profile so the guard re-fetches with the new accountType
      await queryClient.invalidateQueries({ queryKey: ["local-user-profile"] });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-stone-950 px-4 py-12">
      {/* Logo mark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
          <span className="text-xl font-black text-white">E</span>
        </div>
        <span className="text-sm font-semibold tracking-widest text-stone-500 uppercase">
          Expanse Tracker
        </span>
      </div>

      {/* Heading */}
      <div className="mb-10 max-w-lg text-center">
        <h1 className="mb-3 font-serif text-3xl font-semibold text-white sm:text-4xl">
          Welcome! How will you use this app?
        </h1>
        <p className="text-stone-400">
          We'll personalise your experience based on how you plan to track expenses.
        </p>
      </div>

      {/* Cards */}
      <div className="mb-8 grid w-full max-w-lg gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ value, icon: Icon, label, description, accent, border, iconBg, iconColor }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelected(value)}
              className={`group relative flex flex-col items-start gap-4 rounded-2xl border-2 bg-stone-900 p-6 text-left transition-all duration-200 focus:outline-none ${border} ${
                isSelected
                  ? "ring-2 ring-offset-2 ring-offset-stone-950 " +
                    (value === "Single Person"
                      ? "border-amber-500 ring-amber-500/40"
                      : "border-emerald-500 ring-emerald-500/40")
                  : ""
              }`}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <span
                  className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ${accent}`}
                >
                  <svg
                    viewBox="0 0 12 10"
                    className="h-2.5 w-2.5 stroke-white"
                    strokeWidth="2"
                    fill="none"
                  >
                    <polyline points="1,5 4,8 11,1" />
                  </svg>
                </span>
              )}

              {/* Icon */}
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} transition-transform duration-200 group-hover:scale-105`}>
                <Icon size={22} className={iconColor} />
              </span>

              {/* Text */}
              <div>
                <p className="mb-1 text-base font-semibold text-white">{label}</p>
                <p className="text-sm leading-snug text-stone-400">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 rounded-lg bg-red-900/30 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={confirm}
        disabled={!selected || saving}
        className="flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 font-semibold text-stone-950 shadow-lg shadow-amber-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            Get started <ArrowRight size={16} />
          </>
        )}
      </button>

      <p className="mt-6 text-xs text-stone-600">
        You can change this later in your profile settings.
      </p>
    </div>
  );
}
