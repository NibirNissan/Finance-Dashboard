import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalUser } from "@/hooks/use-local-user";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle,
  ClipboardList,
  Clock,
  Crown,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function authFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: number; name: string; email: string; accountType: string;
  role: string; subscriptionPlan: string; subscriptionExpiry: string | null;
  status: string; createdAt: string;
}
interface Stats { totalUsers: number; activeSubscribers: number; totalRevenue: number; }
interface Plan {
  id: number; planName: string; slug: string; price: number;
  durationInMonths: number; features: string[]; isActive: boolean; sortOrder: number;
}
interface Cat { id: number; name: string; icon: string | null; isActive: boolean; sortOrder: number; }
interface Settings {
  id: number; announcementText: string; isAnnouncementActive: boolean;
  allowRegistrations: boolean; bkashNumber: string; nagadNumber: string;
}
interface PaymentRequest {
  id: number; amount: number; paymentMethod: "bkash" | "nagad";
  senderNumber: string; transactionId: string; status: "pending" | "approved" | "rejected";
  createdAt: string; reviewedAt: string | null;
  userId: number; planId: number;
  userEmail: string | null; userName: string | null;
  planName: string | null; planSlug: string | null;
}
interface AdminLog { id: number; adminId: number; actionType: string; description: string; createdAt: string; }

// ── Shared helpers ────────────────────────────────────────────────────────────

const planBadge: Record<string, string> = {
  free: "bg-stone-100 text-stone-500",
  monthly: "bg-blue-100 text-blue-700",
  yearly: "bg-amber-100 text-amber-700",
};
const statusBadge = {
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-600",
};

// Shared modal backdrop + card — handles dark mode uniformly
function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-stone-100 dark:border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      {onClose && <div className="absolute inset-0 -z-10" onClick={onClose} />}
    </div>
  );
}

// Shared form input
function Input({
  label, type = "text", value, onChange, placeholder, className,
}: {
  label: string; type?: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; className?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-slate-400 block mb-1">{label}</label>
      <input
        type={type}
        className={cn(
          "w-full border border-stone-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400",
          className,
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// Cancel / confirm button pair
function ModalActions({
  onCancel, onConfirm, confirmLabel, loading, danger,
}: {
  onCancel: () => void; onConfirm: () => void; confirmLabel: string; loading?: boolean; danger?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-6 px-7 pb-7">
      <button
        onClick={onCancel}
        disabled={loading}
        className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-stone-800 dark:text-slate-200 text-sm font-medium hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className={cn(
          "flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60",
          danger
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-stone-900 dark:bg-amber-400 hover:bg-stone-800 dark:hover:bg-amber-300 text-white dark:text-stone-900",
        )}
      >
        {loading ? "Processing…" : confirmLabel}
      </button>
    </div>
  );
}

// ── Tab setup ─────────────────────────────────────────────────────────────────

type AdminTab = "users" | "payments" | "pricing" | "categories" | "settings" | "logs";
const TABS: { key: AdminTab; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "payments", label: "Verification Queue" },
  { key: "pricing", label: "Pricing Manager" },
  { key: "categories", label: "Category Manager" },
  { key: "settings", label: "Global Settings" },
  { key: "logs", label: "Activity Logs" },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user } = useLocalUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("users");

  return (
    <div className="min-h-screen bg-[#F5F0E8] dark:bg-slate-950">
      {/* Header */}
      <div className="bg-stone-900 text-white px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
        <span className="text-white/20">·</span>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium">Admin Panel</span>
        </div>
        <div className="ml-auto text-xs text-white/40">Signed in as {user?.name}</div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-stone-200 dark:border-slate-700 sticky top-0 z-20 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-6 flex min-w-max">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.key
                  ? "border-stone-900 dark:border-amber-400 text-stone-900 dark:text-amber-400"
                  : "border-transparent text-stone-400 dark:text-slate-500 hover:text-stone-700 dark:hover:text-slate-300",
              )}
            >
              {t.label}
              {t.key === "payments" && <PendingBadge />}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === "users"      && <UsersTab toast={toast} qc={qc} />}
        {tab === "payments"   && <VerificationQueueTab toast={toast} qc={qc} />}
        {tab === "pricing"    && <PricingTab toast={toast} qc={qc} />}
        {tab === "categories" && <CategoriesTab toast={toast} qc={qc} />}
        {tab === "settings"   && <SettingsTab toast={toast} qc={qc} />}
        {tab === "logs"       && <ActivityLogsTab />}
      </div>
    </div>
  );
}

// Small badge showing pending payment count
function PendingBadge() {
  const { data = [] } = useQuery<PaymentRequest[]>({
    queryKey: ["admin-payments"],
    queryFn: async () => { const r = await authFetch("/api/admin/payments"); return r.json(); },
    staleTime: 30_000,
  });
  const count = data.filter((p) => p.status === "pending").length;
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-amber-400 text-stone-900">
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Users
// ══════════════════════════════════════════════════════════════════════════════

function UsersTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<AdminUser | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<"monthly" | "yearly">("monthly");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => { const r = await authFetch("/api/admin/stats"); return r.json(); },
  });
  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => { const r = await authFetch("/api/admin/users"); return r.json(); },
  });

  const toggleStatus = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/admin/user/${id}/toggle-status`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast({ title: "Status updated" });
      setOpenMenu(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const upgradeUser = useMutation({
    mutationFn: async ({ id, plan }: { id: number; plan: string }) => {
      const r = await authFetch(`/api/admin/user/${id}/upgrade`, { method: "POST", body: JSON.stringify({ plan }) });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast({ title: "Plan upgraded" });
      setUpgradeModal(null);
      setOpenMenu(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const matchPlan = planFilter === "all" || u.subscriptionPlan === planFilter;
    return matchSearch && matchStatus && matchPlan;
  });

  const uniquePlans = [...new Set(users.map((u) => u.subscriptionPlan))];

  const handleCSV = () => {
    const header = ["Name", "Email", "Account Type", "Plan", "Status", "Joined"];
    const rows = filtered.map((u) => [
      `"${u.name.replace(/"/g, '""')}"`,
      u.email,
      u.accountType,
      u.subscriptionPlan,
      u.status,
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Total Users", value: statsLoading ? "—" : stats?.totalUsers ?? 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950" },
    { label: "Active Subscribers", value: statsLoading ? "—" : stats?.activeSubscribers ?? 0, icon: Crown, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950" },
    { label: "Total Revenue", value: statsLoading ? "—" : `৳${(stats?.totalRevenue ?? 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-100 dark:border-slate-700 shadow-sm p-6 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bg)}>
              <Icon className={cn("w-6 h-6", color)} />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-slate-100 mt-0.5">{String(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-52 border border-stone-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-stone-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-stone-700 dark:text-slate-300">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="border border-stone-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-stone-700 dark:text-slate-300">
          <option value="all">All plans</option>
          {uniquePlans.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <button onClick={handleCSV} className="flex items-center gap-1.5 border border-stone-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-slate-700">
          <h2 className="font-semibold text-stone-900 dark:text-slate-100">User Management</h2>
          <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">
            {filtered.length === users.length ? `${users.length} users` : `${filtered.length} of ${users.length} users`}
          </p>
        </div>
        {usersLoading ? (
          <div className="py-16 text-center text-stone-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-stone-400 dark:text-slate-500 uppercase tracking-wide border-b border-stone-100 dark:border-slate-700 bg-stone-50/60 dark:bg-slate-800/40">
                  <th className="text-left px-6 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-stone-50 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-stone-900 dark:bg-amber-400 flex items-center justify-center text-white dark:text-stone-900 text-xs font-bold flex-shrink-0">
                          {u.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-stone-900 dark:text-slate-100">{u.name}</p>
                          {u.role === "admin" && <p className="text-xs text-amber-600 font-medium">Admin</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-stone-500 dark:text-slate-400">{u.email}</td>
                    <td className="px-4 py-4 text-stone-500 dark:text-slate-400">{u.accountType}</td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", planBadge[u.subscriptionPlan] ?? "bg-stone-100 text-stone-500")}>
                        {u.subscriptionPlan.charAt(0).toUpperCase() + u.subscriptionPlan.slice(1)}
                      </span>
                      {u.subscriptionExpiry && <p className="text-xs text-stone-400 mt-0.5">until {new Date(u.subscriptionExpiry).toLocaleDateString()}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusBadge[u.status as keyof typeof statusBadge] ?? statusBadge.active)}>
                        {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-stone-400 dark:text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4 relative">
                      {u.role !== "admin" && (
                        <div className="relative">
                          <button onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 text-stone-400 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenu === u.id && (
                            <div className="absolute right-0 top-10 z-20 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-stone-100 dark:border-slate-700 py-1 w-44">
                              <button onClick={() => toggleStatus.mutate(u.id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors">
                                {u.status === "active"
                                  ? <span className="text-red-600">Suspend user</span>
                                  : <span className="text-emerald-600">Unban user</span>}
                              </button>
                              <button onClick={() => { setUpgradeModal(u); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 transition-colors">
                                Manually upgrade
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-16 text-center text-stone-400 text-sm">No users match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openMenu !== null && <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />}

      {upgradeModal && (
        <Modal onClose={() => setUpgradeModal(null)}>
          <div className="p-7">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-slate-100 mb-1">Manually upgrade</h2>
            <p className="text-stone-500 dark:text-slate-400 text-sm mb-6">Upgrading <strong>{upgradeModal.name}</strong>'s plan.</p>
            <div className="flex rounded-lg border border-stone-200 dark:border-slate-600 overflow-hidden mb-6">
              {(["monthly", "yearly"] as const).map((p) => (
                <button key={p} onClick={() => setUpgradePlan(p)} className={cn(
                  "flex-1 py-2.5 text-sm font-medium transition-colors",
                  upgradePlan === p
                    ? "bg-stone-900 dark:bg-amber-400 text-white dark:text-stone-900"
                    : "text-stone-500 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800",
                )}>
                  {p === "monthly" ? "Monthly · ৳100" : "Yearly · ৳500"}
                </button>
              ))}
            </div>
          </div>
          <ModalActions
            onCancel={() => setUpgradeModal(null)}
            onConfirm={() => upgradeUser.mutate({ id: upgradeModal.id, plan: upgradePlan })}
            confirmLabel="Confirm Upgrade"
            loading={upgradeUser.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Verification Queue
// ══════════════════════════════════════════════════════════════════════════════

const payMethodBadge = {
  bkash:  "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  nagad:  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};
const payStatusBadge = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
};

function VerificationQueueTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const { data: payments = [], isLoading, refetch, isFetching } = useQuery<PaymentRequest[]>({
    queryKey: ["admin-payments"],
    queryFn: async () => { const r = await authFetch("/api/admin/payments"); return r.json(); },
    refetchInterval: 60_000,
  });

  const approve = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/admin/payments/${id}/approve`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "Payment approved", description: "User's subscription has been activated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/admin/payments/${id}/reject`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      toast({ title: "Payment rejected." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-stone-900 dark:text-slate-100">Verification Queue</h2>
          <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">
            {pendingCount > 0 ? `${pendingCount} payment${pendingCount > 1 ? "s" : ""} awaiting review` : "No pending payments"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-stone-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-stone-700 dark:text-slate-300"
          >
            <option value="all">All requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 border border-stone-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-100 dark:border-slate-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-stone-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <ClipboardList className="w-10 h-10 text-stone-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-stone-400 dark:text-slate-500 text-sm">No {statusFilter === "all" ? "" : statusFilter} payment requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-stone-400 dark:text-slate-500 uppercase tracking-wide border-b border-stone-100 dark:border-slate-700 bg-stone-50/60 dark:bg-slate-800/40">
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Sender Number</th>
                  <th className="text-left px-4 py-3">Trx ID</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Submitted</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-stone-50 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-stone-900 dark:text-slate-100 truncate max-w-[140px]">{p.userName ?? "Unknown"}</p>
                      <p className="text-xs text-stone-400 dark:text-slate-500 truncate max-w-[140px]">{p.userEmail ?? "—"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-medium text-stone-700 dark:text-slate-300 bg-stone-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                        {p.planName ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full uppercase", payMethodBadge[p.paymentMethod])}>
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-stone-600 dark:text-slate-300">{p.senderNumber}</td>
                    <td className="px-4 py-4 font-mono text-xs text-stone-600 dark:text-slate-300">{p.transactionId}</td>
                    <td className="px-4 py-4 font-semibold text-stone-900 dark:text-slate-100">৳{p.amount}</td>
                    <td className="px-4 py-4 text-xs text-stone-400 dark:text-slate-500 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString()}<br />
                      <span className="text-stone-300 dark:text-slate-600">{new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full capitalize", payStatusBadge[p.status])}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {p.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approve.mutate(p.id)}
                            disabled={approve.isPending || reject.isPending}
                            title="Approve"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => reject.mutate(p.id)}
                            disabled={approve.isPending || reject.isPending}
                            title="Reject"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                      {p.status === "approved" && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                      {p.status === "rejected" && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Pricing Manager
// ══════════════════════════════════════════════════════════════════════════════

const emptyPlan = { planName: "", slug: "", price: 0, durationInMonths: 1, features: [""], isActive: true, sortOrder: 0 };

function PricingTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [modal, setModal] = useState<Partial<Plan> & { _edit?: boolean } | null>(null);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["admin-pricing-plans"],
    queryFn: async () => { const r = await authFetch("/api/admin/pricing-plans"); return r.json(); },
  });

  const savePlan = useMutation({
    mutationFn: async (p: Partial<Plan>) => {
      const isEdit = !!p.id;
      const r = await authFetch(isEdit ? `/api/admin/pricing-plans/${p.id}` : "/api/admin/pricing-plans", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify({ planName: p.planName, slug: p.slug, price: Number(p.price), durationInMonths: Number(p.durationInMonths), features: p.features?.filter(Boolean), isActive: p.isActive, sortOrder: p.sortOrder }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pricing-plans"] }); toast({ title: "Plan saved" }); setModal(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePlan = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await authFetch(`/api/admin/pricing-plans/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pricing-plans"] }); toast({ title: "Plan updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/admin/pricing-plans/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pricing-plans"] }); toast({ title: "Plan deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editing = modal ?? { ...emptyPlan };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-stone-900 dark:text-slate-100">Pricing Plans</h2>
          <p className="text-xs text-stone-400 dark:text-slate-500">{plans.length} plans</p>
        </div>
        <button onClick={() => setModal({ ...emptyPlan })} className="flex items-center gap-2 bg-stone-900 dark:bg-amber-400 text-white dark:text-stone-900 text-sm px-4 py-2 rounded-lg hover:bg-stone-800 dark:hover:bg-amber-300 transition-colors">
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      {isLoading ? <div className="py-16 text-center text-stone-400 text-sm">Loading…</div> : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={cn("bg-white dark:bg-slate-900 rounded-2xl border p-5 flex gap-4 items-start", plan.isActive ? "border-stone-100 dark:border-slate-700" : "border-stone-100 dark:border-slate-700 opacity-60")}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-stone-900 dark:text-slate-100">{plan.planName}</h3>
                  <span className="text-xs text-stone-400 font-mono bg-stone-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-0.5 rounded">{plan.slug}</span>
                  {!plan.isActive && <span className="text-xs text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Inactive</span>}
                </div>
                <p className="text-2xl font-bold text-stone-900 dark:text-slate-100">৳{plan.price} <span className="text-sm font-normal text-stone-400">/ {plan.durationInMonths} month{plan.durationInMonths > 1 ? "s" : ""}</span></p>
                <ul className="mt-2 space-y-0.5">
                  {plan.features.map((f, i) => <li key={i} className="text-xs text-stone-500 dark:text-slate-400">• {f}</li>)}
                </ul>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => togglePlan.mutate({ id: plan.id, isActive: plan.isActive })} title={plan.isActive ? "Deactivate" : "Activate"} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 text-stone-400 transition-colors">
                  {plan.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => setModal({ ...plan, _edit: true })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 text-stone-400 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deletePlan.mutate(plan.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-stone-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <Modal onClose={() => setModal(null)}>
          <div className="p-7">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-slate-100 mb-5">{editing.id ? "Edit Plan" : "New Plan"}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Plan Name" value={editing.planName ?? ""} onChange={(v) => setModal({ ...editing, planName: v })} />
                <Input label="Slug" value={editing.slug ?? ""} onChange={(v) => setModal({ ...editing, slug: v.toLowerCase().replace(/\s+/g, "-") })} className="font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Price (৳)" type="number" value={editing.price ?? 0} onChange={(v) => setModal({ ...editing, price: parseFloat(v) })} />
                <Input label="Duration (months)" type="number" value={editing.durationInMonths ?? 1} onChange={(v) => setModal({ ...editing, durationInMonths: parseInt(v) })} />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 dark:text-slate-400 block mb-1">Features (one per line)</label>
                <textarea
                  className="w-full border border-stone-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm h-28 resize-none bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={(editing.features ?? []).join("\n")}
                  onChange={(e) => setModal({ ...editing, features: e.target.value.split("\n") })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setModal({ ...editing, isActive: e.target.checked })} />
                Active (visible to users)
              </label>
            </div>
          </div>
          <ModalActions
            onCancel={() => setModal(null)}
            onConfirm={() => savePlan.mutate(editing as Plan)}
            confirmLabel={editing.id ? "Save Changes" : "Create Plan"}
            loading={savePlan.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Category Manager
// ══════════════════════════════════════════════════════════════════════════════

const emptyCat = { name: "", icon: "", isActive: true, sortOrder: 0 };

function CategoriesTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [modal, setModal] = useState<Partial<Cat> | null>(null);

  const { data: cats = [], isLoading } = useQuery<Cat[]>({
    queryKey: ["admin-categories"],
    queryFn: async () => { const r = await authFetch("/api/admin/categories"); return r.json(); },
  });

  const saveCat = useMutation({
    mutationFn: async (c: Partial<Cat>) => {
      const isEdit = !!c.id;
      const r = await authFetch(isEdit ? `/api/admin/categories/${c.id}` : "/api/admin/categories", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify({ name: c.name, icon: c.icon || null, isActive: c.isActive, sortOrder: Number(c.sortOrder ?? 0) }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast({ title: "Category saved" }); setModal(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleCat = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await authFetch(`/api/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast({ title: "Category updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCat = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast({ title: "Category deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editing = modal ?? { ...emptyCat };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-stone-900 dark:text-slate-100">Expense Categories</h2>
          <p className="text-xs text-stone-400 dark:text-slate-500">{cats.length} categories</p>
        </div>
        <button onClick={() => setModal({ ...emptyCat })} className="flex items-center gap-2 bg-stone-900 dark:bg-amber-400 text-white dark:text-stone-900 text-sm px-4 py-2 rounded-lg hover:bg-stone-800 dark:hover:bg-amber-300 transition-colors">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {isLoading ? <div className="py-16 text-center text-stone-400 text-sm">Loading…</div> : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-stone-400 dark:text-slate-500 uppercase tracking-wide border-b border-stone-100 dark:border-slate-700 bg-stone-50/60 dark:bg-slate-800/40">
                <th className="text-left px-6 py-3">Category</th>
                <th className="text-left px-4 py-3">Sort Order</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-b border-stone-50 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{c.icon ?? "📁"}</span>
                      <span className="font-medium text-stone-900 dark:text-slate-100">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-stone-500 dark:text-slate-400">{c.sortOrder}</td>
                  <td className="px-4 py-4">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400 dark:bg-slate-700 dark:text-slate-500")}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleCat.mutate({ id: c.id, isActive: c.isActive })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 text-stone-400 transition-colors">
                        {c.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => setModal({ ...c })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 text-stone-400 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCat.mutate(c.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-stone-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <Modal onClose={() => setModal(null)}>
          <div className="p-7">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-slate-100 mb-5">{editing.id ? "Edit Category" : "New Category"}</h2>
            <div className="space-y-4">
              <Input label="Name" value={editing.name ?? ""} onChange={(v) => setModal({ ...editing, name: v })} />
              <Input label="Icon (emoji)" value={editing.icon ?? ""} onChange={(v) => setModal({ ...editing, icon: v })} placeholder="e.g. 🛒" />
              <Input label="Sort Order" type="number" value={editing.sortOrder ?? 0} onChange={(v) => setModal({ ...editing, sortOrder: parseInt(v) })} />
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setModal({ ...editing, isActive: e.target.checked })} />
                Active (available in expense form)
              </label>
            </div>
          </div>
          <ModalActions
            onCancel={() => setModal(null)}
            onConfirm={() => saveCat.mutate(editing as Cat)}
            confirmLabel={editing.id ? "Save Changes" : "Create Category"}
            loading={saveCat.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Global Settings
// ══════════════════════════════════════════════════════════════════════════════

type SettingsForm = Partial<Settings>;

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
      <div className={cn("w-10 h-6 rounded-full transition-colors flex items-center px-0.5", on ? "bg-amber-400" : "bg-stone-200 dark:bg-slate-600")}>
        <div className={cn("w-5 h-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0")} />
      </div>
      <span className="text-sm text-stone-700 dark:text-slate-300">{label}</span>
    </label>
  );
}

function SettingsTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState<SettingsForm | null>(null);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const r = await authFetch("/api/admin/settings");
      const d = await r.json();
      setForm(d);
      return d;
    },
  });

  const save = useMutation({
    mutationFn: async (s: SettingsForm) => {
      const r = await authFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify(s) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      return r.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      setForm(d);
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const current = form ?? settings ?? {};

  if (isLoading) return <div className="py-16 text-center text-stone-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="font-semibold text-stone-900 dark:text-slate-100">Global Settings</h2>
        <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">Changes take effect immediately for all users.</p>
      </div>

      {/* Announcement + Registration */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-100 dark:border-slate-700 shadow-sm p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100 mb-3">Announcement Banner</h3>
          <Toggle
            on={!!current.isAnnouncementActive}
            onToggle={() => setForm({ ...current, isAnnouncementActive: !current.isAnnouncementActive })}
            label={current.isAnnouncementActive ? "Banner enabled" : "Banner disabled"}
          />
          <textarea
            className="mt-3 w-full border border-stone-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm h-20 resize-none bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Type your announcement message…"
            value={current.announcementText ?? ""}
            onChange={(e) => setForm({ ...current, announcementText: e.target.value })}
          />
        </div>

        <div className="border-t border-stone-100 dark:border-slate-700 pt-5">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100 mb-3">Registration</h3>
          <Toggle
            on={!!current.allowRegistrations}
            onToggle={() => setForm({ ...current, allowRegistrations: !current.allowRegistrations })}
            label={current.allowRegistrations ? "New registrations allowed" : "Registrations disabled"}
          />
        </div>
      </div>

      {/* Payment Numbers */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-100 dark:border-slate-700 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100 mb-0.5">Payment Numbers</h3>
          <p className="text-xs text-stone-400 dark:text-slate-500">These numbers are shown to users during checkout so they know where to send money.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-slate-400 block mb-1.5">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" /> bKash Number
              </span>
            </label>
            <input
              type="tel"
              placeholder="e.g. 01712345678"
              value={current.bkashNumber ?? ""}
              onChange={(e) => setForm({ ...current, bkashNumber: e.target.value })}
              className="w-full border border-stone-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-slate-400 block mb-1.5">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Nagad Number
              </span>
            </label>
            <input
              type="tel"
              placeholder="e.g. 01898765432"
              value={current.nagadNumber ?? ""}
              onChange={(e) => setForm({ ...current, nagadNumber: e.target.value })}
              className="w-full border border-stone-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        <p className="text-xs text-stone-400 dark:text-slate-500 flex items-start gap-1.5">
          <span className="mt-0.5">💡</span>
          Leave blank to show a placeholder. Users will see exactly these numbers in the checkout modal.
        </p>
      </div>

      <button
        onClick={() => save.mutate(current)}
        disabled={save.isPending}
        className="bg-stone-900 dark:bg-amber-400 text-white dark:text-stone-900 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save All Settings"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Activity Logs
// ══════════════════════════════════════════════════════════════════════════════

const logActionColor: Record<string, string> = {
  suspend:  "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  unban:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  upgrade:  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  approve:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  reject:   "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

function ActivityLogsTab() {
  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AdminLog[]>({
    queryKey: ["admin-logs"],
    queryFn: async () => { const r = await authFetch("/api/admin/logs"); return r.json(); },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-stone-900 dark:text-slate-100">Activity Logs</h2>
          <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">All admin actions — newest first · auto-refreshes every 30 s</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 border border-stone-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-colors">
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-100 dark:border-slate-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-stone-400 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center">
            <Clock className="w-10 h-10 text-stone-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-stone-400 dark:text-slate-500 text-sm">No admin actions recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-stone-400 dark:text-slate-500 uppercase tracking-wide border-b border-stone-100 dark:border-slate-700 bg-stone-50/60 dark:bg-slate-800/40">
                  <th className="text-left px-6 py-3">Action</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-stone-50 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full capitalize", logActionColor[log.actionType] ?? "bg-stone-100 text-stone-600")}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-600 dark:text-slate-300">{log.description}</td>
                    <td className="px-4 py-3.5 text-stone-400 dark:text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString()} · {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
