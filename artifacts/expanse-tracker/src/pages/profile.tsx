import { useState } from "react";
import { useLocation } from "wouter";
import { useLocalUser } from "@/hooks/use-local-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, Save, User } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Profile() {
  const { user, logout, updateUser } = useLocalUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/user/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      updateUser(data);
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <div className="bg-stone-900 text-white px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>
        <span className="text-white/20">·</span>
        <span className="text-sm font-medium">Profile</span>
      </div>

      <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center text-white text-xl font-bold">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">{user.name}</h1>
            <p className="text-sm text-stone-500">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  user.subscriptionPlan === "free"
                    ? "bg-stone-100 text-stone-500"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {user.subscriptionPlan === "free" ? "Free" : user.subscriptionPlan}
              </span>
              {user.role === "admin" && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Edit form */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4" /> Personal details
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Full name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-stone-200 focus:border-stone-400 bg-[#F5F0E8]"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Email
            </Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed"
            />
            <p className="text-xs text-stone-400">Email is managed by your sign-in provider.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Phone (optional)
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border-stone-200 focus:border-stone-400 bg-[#F5F0E8]"
              placeholder="+880 1XXX XXX XXX"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Account type
            </Label>
            <div className="text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
              {user.accountType}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white rounded-xl"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-4">
            Account
          </h2>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
