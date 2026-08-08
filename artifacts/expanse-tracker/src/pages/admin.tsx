import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalUser } from "@/hooks/use-local-user";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
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
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
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
  id: number; announcementText: string;
  isAnnouncementActive: boolean; allowRegistrations: boolean;
  bkashNumber: string; nagadNumber: string;
}
interface AdminLog {
  id: number; adminId: number; actionType: string; description: string; createdAt: string;
}
interface PaymentRequest {
  id: number; userId: number; planId: number;
  paymentMethod: string; senderNumber: string; trxId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  userName: string | null; userEmail: string | null;
  planName: string | null; planSlug: string | null; durationInMonths: number | null;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const planBadge: Record<string, string> = {
  free: "bg-stone-100 text-stone-500",
  monthly: "bg-blue-100 text-blue-700",
  yearly: "bg-amber-100 text-amber-700",
};
const statusBadge = { active: "bg-emerald-100 text-emerald-700", suspended: "bg-red-100 text-red-600" };
const logBadge: Record<string, string> = {
  suspend_user: "bg-red-100 text-red-600",
  unban_user: "bg-emerald-100 text-emerald-700",
  upgrade_user: "bg-amber-100 text-amber-700",
  approve_payment: "bg-emerald-100 text-emerald-700",
  reject_payment: "bg-red-100 text-red-600",
};

type AdminTab = "users" | "payments" | "pricing" | "categories" | "settings" | "logs";
const TABS: { key: AdminTab; label: string; icon: typeof Users }[] = [
  { key: "users",      label: "Users",              icon: Users },
  { key: "payments",   label: "Verification Queue",  icon: Clock },
  { key: "pricing",    label: "Pricing Manager",     icon: Crown },
  { key: "categories", label: "Category Manager",    icon: Pencil },
  { key: "settings",   label: "Global Settings",     icon: Shield },
  { key: "logs",       label: "Activity Logs",       icon: Activity },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function Admin() {
  const { user } = useLocalUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("users");

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
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
      <div className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.key
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-400 hover:text-stone-700",
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {tab === "users"      && <UsersTab toast={toast} qc={qc} />}
        {tab === "payments"   && <PaymentsTab toast={toast} qc={qc} />}
        {tab === "pricing"    && <PricingTab toast={toast} qc={qc} />}
        {tab === "categories" && <CategoriesTab toast={toast} qc={qc} />}
        {tab === "settings"   && <SettingsTab toast={toast} qc={qc} />}
        {tab === "logs"       && <ActivityLogsTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Users
// ══════════════════════════════════════════════════════════════════════════════

function downloadCSV(users: AdminUser[]) {
  const headers = ["ID", "Name", "Email", "Type", "Role", "Plan", "Status", "Joined"];
  const escape = (v: string | number) =>
    typeof v === "string" && (v.includes(",") || v.includes('"') || v.includes("\n"))
      ? `"${v.replace(/"/g, '""')}"`
      : String(v);
  const rows = users.map((u) => [
    u.id, u.name, u.email, u.accountType, u.role, u.subscriptionPlan, u.status,
    new Date(u.createdAt).toLocaleDateString(),
  ].map(escape));
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function UsersTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<AdminUser | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<"monthly" | "yearly">("monthly");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [planFilter, setPlanFilter] = useState<string>("all");

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
      toast({ title: "Status updated" }); setOpenMenu(null);
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
      toast({ title: "Plan upgraded" }); setUpgradeModal(null); setOpenMenu(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const availablePlans = useMemo(() => Array.from(new Set(users.map((u) => u.subscriptionPlan))).sort(), [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      const matchPlan = planFilter === "all" || u.subscriptionPlan === planFilter;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [users, search, statusFilter, planFilter]);

  const statCards = [
    { label: "Total Users", value: statsLoading ? "—" : stats?.totalUsers ?? 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Active Subscribers", value: statsLoading ? "—" : stats?.activeSubscribers ?? 0, icon: Crown, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Total Revenue", value: statsLoading ? "—" : `৳${(stats?.totalRevenue ?? 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bg)}>
              <Icon className={cn("w-6 h-6", color)} />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold text-stone-900 mt-0.5">{String(value)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-stone-900">User Management</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {filteredUsers.length === users.length ? `${users.length} registered users` : `${filteredUsers.length} of ${users.length} users`}
              </p>
            </div>
            <button onClick={() => downloadCSV(filteredUsers)} disabled={filteredUsers.length === 0}
              className="flex items-center gap-2 text-sm border border-stone-200 text-stone-700 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input type="text" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-[#F5F0E8]" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-[#F5F0E8] text-stone-700 focus:outline-none focus:border-stone-400">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-[#F5F0E8] text-stone-700 focus:outline-none focus:border-stone-400">
              <option value="all">All Plans</option>
              {availablePlans.map((slug) => (
                <option key={slug} value={slug}>{slug.charAt(0).toUpperCase() + slug.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {usersLoading ? (
          <div className="py-16 text-center text-stone-400 text-sm">Loading…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-sm">
            {users.length === 0 ? "No users yet." : "No users match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-stone-400 uppercase tracking-wide border-b border-stone-100 bg-stone-50/60">
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
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-stone-900">{u.name}</p>
                          {u.role === "admin" && <p className="text-xs text-amber-600 font-medium">Admin</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-stone-500">{u.email}</td>
                    <td className="px-4 py-4 text-stone-500">{u.accountType}</td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", planBadge[u.subscriptionPlan] ?? "bg-stone-100 text-stone-500")}>
                        {u.subscriptionPlan.charAt(0).toUpperCase() + u.subscriptionPlan.slice(1)}
                      </span>
                      {u.subscriptionExpiry && (
                        <p className="text-xs text-stone-400 mt-0.5">until {new Date(u.subscriptionExpiry).toLocaleDateString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusBadge[u.status as keyof typeof statusBadge] ?? statusBadge.active)}>
                        {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-stone-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4 relative">
                      {u.role !== "admin" && (
                        <div className="relative">
                          <button onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenu === u.id && (
                            <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-xl border border-stone-100 py-1 w-44">
                              <button onClick={() => toggleStatus.mutate(u.id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors">
                                {u.status === "active" ? <span className="text-red-600">Suspend user</span> : <span className="text-emerald-600">Unban user</span>}
                              </button>
                              <button onClick={() => { setUpgradeModal(u); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 text-stone-700 transition-colors">
                                Manually upgrade
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openMenu !== null && <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />}

      {upgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
            <h2 className="text-xl font-semibold text-stone-900 mb-1">Manually upgrade</h2>
            <p className="text-stone-500 text-sm mb-6">Upgrading <strong>{upgradeModal.name}</strong>'s plan.</p>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden mb-6">
              {(["monthly", "yearly"] as const).map((p) => (
                <button key={p} onClick={() => setUpgradePlan(p)}
                  className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", upgradePlan === p ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50")}>
                  {p === "monthly" ? "Monthly · ৳100" : "Yearly · ৳500"}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setUpgradeModal(null)} className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 text-sm font-medium transition-colors">Cancel</button>
              <button onClick={() => upgradeUser.mutate({ id: upgradeModal.id, plan: upgradePlan })} disabled={upgradeUser.isPending}
                className="flex-1 py-2.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-sm font-medium transition-colors disabled:opacity-60">
                {upgradeUser.isPending ? "Upgrading…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Payment Verification Queue
// ══════════════════════════════════════════════════════════════════════════════

const payStatusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

function PaymentsTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const { data: requests = [], isLoading } = useQuery<PaymentRequest[]>({
    queryKey: ["admin-payments"],
    queryFn: async () => { const r = await authFetch("/api/admin/payments"); return r.json(); },
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/admin/payments/${id}/approve`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast({ title: "Payment approved", description: "User subscription has been activated." });
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
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      toast({ title: "Payment rejected" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-stone-900">Verification Queue</h2>
          <p className="text-xs text-stone-400 mt-0.5">{pendingCount} pending · auto-refreshes every 15s</p>
        </div>
        <div className="flex rounded-lg border border-stone-200 overflow-hidden text-sm">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-4 py-2 font-medium transition-colors capitalize", statusFilter === s ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-stone-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Clock className="w-8 h-8 text-stone-200 mx-auto" />
            <p className="text-stone-400 text-sm">{statusFilter === "pending" ? "No pending requests — all clear!" : "No requests in this category."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-stone-400 uppercase tracking-wide border-b border-stone-100 bg-stone-50/60">
                  <th className="text-left px-6 py-3">User</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Sender #</th>
                  <th className="text-left px-4 py-3">Trx ID</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((pr) => (
                  <tr key={pr.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-stone-900">{pr.userName ?? `User #${pr.userId}`}</p>
                      <p className="text-xs text-stone-400">{pr.userEmail ?? ""}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", planBadge[pr.planSlug ?? ""] ?? "bg-stone-100 text-stone-500")}>
                        {pr.planName ?? `Plan #${pr.planId}`}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
                        pr.paymentMethod === "bKash" ? "bg-pink-100 text-pink-700" : "bg-orange-100 text-orange-700")}>
                        {pr.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-stone-600 font-mono text-xs">{pr.senderNumber}</td>
                    <td className="px-4 py-4 font-mono text-xs text-stone-800 select-all">{pr.trxId}</td>
                    <td className="px-4 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full capitalize", payStatusBadge[pr.status] ?? "bg-stone-100 text-stone-500")}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-stone-400 whitespace-nowrap">{new Date(pr.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      {pr.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => approve.mutate(pr.id)} disabled={approve.isPending || reject.isPending}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button onClick={() => reject.mutate(pr.id)} disabled={approve.isPending || reject.isPending}
                            className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
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
        <div><h2 className="font-semibold text-stone-900">Pricing Plans</h2><p className="text-xs text-stone-400">{plans.length} plans</p></div>
        <button onClick={() => setModal({ ...emptyPlan })} className="flex items-center gap-2 bg-stone-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors">
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      {isLoading ? <div className="py-16 text-center text-stone-400">Loading…</div> : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={cn("bg-white rounded-2xl border p-5 flex gap-4 items-start", plan.isActive ? "border-stone-100" : "border-stone-100 opacity-60")}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-stone-900">{plan.planName}</h3>
                  <span className="text-xs text-stone-400 font-mono bg-stone-100 px-2 py-0.5 rounded">{plan.slug}</span>
                  {!plan.isActive && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">Inactive</span>}
                </div>
                <p className="text-2xl font-bold text-stone-900">৳{plan.price} <span className="text-sm font-normal text-stone-400">/ {plan.durationInMonths} month{plan.durationInMonths > 1 ? "s" : ""}</span></p>
                <ul className="mt-2 space-y-0.5">{plan.features.map((f, i) => <li key={i} className="text-xs text-stone-500">• {f}</li>)}</ul>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => togglePlan.mutate({ id: plan.id, isActive: plan.isActive })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 transition-colors">
                  {plan.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => setModal({ ...plan, _edit: true })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => deletePlan.mutate(plan.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-stone-900 mb-5">{editing.id ? "Edit Plan" : "New Plan"}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-stone-500 block mb-1">Plan Name</label>
                  <input className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" value={editing.planName ?? ""} onChange={(e) => setModal({ ...editing, planName: e.target.value })} /></div>
                <div><label className="text-xs font-medium text-stone-500 block mb-1">Slug</label>
                  <input className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono" value={editing.slug ?? ""} onChange={(e) => setModal({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-stone-500 block mb-1">Price (৳)</label>
                  <input type="number" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" value={editing.price ?? 0} onChange={(e) => setModal({ ...editing, price: parseFloat(e.target.value) })} /></div>
                <div><label className="text-xs font-medium text-stone-500 block mb-1">Duration (months)</label>
                  <input type="number" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" value={editing.durationInMonths ?? 1} onChange={(e) => setModal({ ...editing, durationInMonths: parseInt(e.target.value) })} /></div>
              </div>
              <div><label className="text-xs font-medium text-stone-500 block mb-1">Features (one per line)</label>
                <textarea className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm h-28 resize-none" value={(editing.features ?? []).join("\n")} onChange={(e) => setModal({ ...editing, features: e.target.value.split("\n") })} /></div>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setModal({ ...editing, isActive: e.target.checked })} />
                Active (visible to users)
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium">Cancel</button>
              <button onClick={() => savePlan.mutate(editing as Plan)} disabled={savePlan.isPending} className="flex-1 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-medium disabled:opacity-60">
                {savePlan.isPending ? "Saving…" : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
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
        <div><h2 className="font-semibold text-stone-900">Expense Categories</h2><p className="text-xs text-stone-400">{cats.length} categories</p></div>
        <button onClick={() => setModal({ ...emptyCat })} className="flex items-center gap-2 bg-stone-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {isLoading ? <div className="py-16 text-center text-stone-400">Loading…</div> : (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-xs font-semibold text-stone-400 uppercase tracking-wide border-b border-stone-100 bg-stone-50/60">
              <th className="text-left px-6 py-3">Category</th>
              <th className="text-left px-4 py-3">Sort Order</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{c.icon ?? "📁"}</span>
                      <span className="font-medium text-stone-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-stone-500">{c.sortOrder}</td>
                  <td className="px-4 py-4">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400")}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleCat.mutate({ id: c.id, isActive: c.isActive })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 transition-colors">
                        {c.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => setModal({ ...c })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteCat.mutate(c.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-stone-900 mb-5">{editing.id ? "Edit Category" : "New Category"}</h2>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-stone-500 block mb-1">Name</label>
                <input className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" value={editing.name ?? ""} onChange={(e) => setModal({ ...editing, name: e.target.value })} /></div>
              <div><label className="text-xs font-medium text-stone-500 block mb-1">Icon (emoji)</label>
                <input className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 🛒" value={editing.icon ?? ""} onChange={(e) => setModal({ ...editing, icon: e.target.value })} /></div>
              <div><label className="text-xs font-medium text-stone-500 block mb-1">Sort Order</label>
                <input type="number" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" value={editing.sortOrder ?? 0} onChange={(e) => setModal({ ...editing, sortOrder: parseInt(e.target.value) })} /></div>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setModal({ ...editing, isActive: e.target.checked })} />
                Active (available in expense form)
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium">Cancel</button>
              <button onClick={() => saveCat.mutate(editing as Cat)} disabled={saveCat.isPending} className="flex-1 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-medium disabled:opacity-60">
                {saveCat.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Global Settings
// ══════════════════════════════════════════════════════════════════════════════

function SettingsTab({ toast, qc }: { toast: ReturnType<typeof useToast>["toast"]; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState<Partial<Settings> | null>(null);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["admin-settings"],
    queryFn: async () => { const r = await authFetch("/api/admin/settings"); const d = await r.json(); setForm(d); return d; },
  });

  const save = useMutation({
    mutationFn: async (s: Partial<Settings>) => {
      const r = await authFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify(s) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      return r.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      qc.invalidateQueries({ queryKey: ["payment-numbers"] });
      setForm(d);
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const current = form ?? settings ?? {};

  if (isLoading) return <div className="py-16 text-center text-stone-400">Loading…</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div><h2 className="font-semibold text-stone-900">Global Settings</h2><p className="text-xs text-stone-400 mt-0.5">Changes take effect immediately for all users.</p></div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-stone-900 mb-3">Announcement Banner</h3>
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <div onClick={() => setForm({ ...current, isAnnouncementActive: !current.isAnnouncementActive })}
              className={cn("w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer", current.isAnnouncementActive ? "bg-amber-400" : "bg-stone-200")}>
              <div className={cn("w-5 h-5 rounded-full bg-white shadow transition-transform", current.isAnnouncementActive ? "translate-x-4" : "translate-x-0")} />
            </div>
            <span className="text-sm text-stone-700">{current.isAnnouncementActive ? "Banner enabled" : "Banner disabled"}</span>
          </label>
          <textarea className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm h-20 resize-none" placeholder="Type your announcement message…"
            value={current.announcementText ?? ""} onChange={(e) => setForm({ ...current, announcementText: e.target.value })} />
        </div>

        <div className="border-t border-stone-100 pt-5">
          <h3 className="text-sm font-semibold text-stone-900 mb-3">Registration</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setForm({ ...current, allowRegistrations: !current.allowRegistrations })}
              className={cn("w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer", current.allowRegistrations ? "bg-emerald-400" : "bg-stone-200")}>
              <div className={cn("w-5 h-5 rounded-full bg-white shadow transition-transform", current.allowRegistrations ? "translate-x-4" : "translate-x-0")} />
            </div>
            <span className="text-sm text-stone-700">{current.allowRegistrations ? "New registrations allowed" : "Registrations disabled"}</span>
          </label>
        </div>

        <div className="border-t border-stone-100 pt-5">
          <h3 className="text-sm font-semibold text-stone-900 mb-1">Payment Settings</h3>
          <p className="text-xs text-stone-400 mb-4">These numbers are shown to users when they subscribe via bKash or Nagad.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide block mb-1.5">bKash Number</label>
              <input type="tel" placeholder="e.g. 01XXXXXXXXX" value={current.bkashNumber ?? ""}
                onChange={(e) => setForm({ ...current, bkashNumber: e.target.value })}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide block mb-1.5">Nagad Number</label>
              <input type="tel" placeholder="e.g. 01XXXXXXXXX" value={current.nagadNumber ?? ""}
                onChange={(e) => setForm({ ...current, nagadNumber: e.target.value })}
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-stone-400" />
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => save.mutate(current)} disabled={save.isPending}
        className="bg-stone-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-60">
        {save.isPending ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Activity Logs
// ══════════════════════════════════════════════════════════════════════════════

const ACTION_LABELS: Record<string, string> = {
  suspend_user: "Suspend User",
  unban_user: "Unban User",
  upgrade_user: "Upgrade User",
  approve_payment: "Approve Payment",
  reject_payment: "Reject Payment",
};

function ActivityLogsTab() {
  const { data: logs = [], isLoading } = useQuery<AdminLog[]>({
    queryKey: ["admin-logs"],
    queryFn: async () => { const r = await authFetch("/api/admin/logs"); return r.json(); },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-stone-900">Activity Logs</h2>
        <p className="text-xs text-stone-400 mt-0.5">{logs.length} recorded action{logs.length !== 1 ? "s" : ""} · auto-refreshes every 30s</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-stone-400 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Activity className="w-8 h-8 text-stone-200 mx-auto" />
            <p className="text-stone-400 text-sm">No admin actions logged yet.</p>
            <p className="text-stone-300 text-xs">Suspending, unbanning, upgrading or verifying payments will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-stone-400 uppercase tracking-wide border-b border-stone-100 bg-stone-50/60">
                  <th className="text-left px-6 py-3">Action</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-6 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap", logBadge[log.actionType] ?? "bg-stone-100 text-stone-500")}>
                        {ACTION_LABELS[log.actionType] ?? log.actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-600">{log.description}</td>
                    <td className="px-6 py-3.5 text-stone-400 text-xs text-right whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
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
