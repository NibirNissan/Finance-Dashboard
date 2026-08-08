import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronRight,
  FileText,
  PenLine,
  Shield,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";

const slides = [
  {
    label: "Monthly Overview",
    subtitle: "See everything at a glance",
    color: "from-slate-800 to-slate-900",
    accent: "bg-amber-400",
    lines: [
      { w: "w-3/4", h: "h-8", c: "bg-white/20" },
      { w: "w-1/2", h: "h-4", c: "bg-white/10" },
      { w: "w-full", h: "h-20", c: "bg-amber-400/30 rounded-xl" },
      { w: "w-2/3", h: "h-4", c: "bg-white/10" },
    ],
  },
  {
    label: "Smart Categories",
    subtitle: "Utilities · Bazar · One-Time",
    color: "from-emerald-900 to-slate-900",
    accent: "bg-emerald-400",
    lines: [
      { w: "w-1/2", h: "h-4", c: "bg-white/20" },
      { w: "w-full", h: "h-6", c: "bg-emerald-400/40 rounded" },
      { w: "w-4/5", h: "h-6", c: "bg-white/10 rounded" },
      { w: "w-3/5", h: "h-6", c: "bg-white/10 rounded" },
    ],
  },
  {
    label: "Monthly Reports",
    subtitle: "PDF in one click",
    color: "from-violet-900 to-slate-900",
    accent: "bg-violet-400",
    lines: [
      { w: "w-2/3", h: "h-4", c: "bg-white/20" },
      { w: "w-full", h: "h-12", c: "bg-violet-400/30 rounded-xl" },
      { w: "w-3/4", h: "h-4", c: "bg-white/10" },
      { w: "w-full", h: "h-10", c: "bg-white/5 rounded-xl border border-white/10" },
    ],
  },
];

const steps = [
  {
    icon: PenLine,
    title: "Log Expense",
    desc: "Add any expense in seconds — title, amount, category, and date.",
  },
  {
    icon: Tag,
    title: "Categorize",
    desc: "Expenses are sorted into Utilities, Bazar, and One-Time automatically.",
  },
  {
    icon: FileText,
    title: "Generate Monthly PDF",
    desc: "Download a clean, shareable report of your monthly spending.",
  },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F0E8] text-stone-900 font-sans">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-[#F5F0E8]/90 backdrop-blur border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-stone-900 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <span className="font-semibold tracking-tight text-stone-900">expanse</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/pricing")}
            className="text-sm text-stone-600 hover:text-stone-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-200/60"
          >
            Pricing
          </button>
          <button
            onClick={() => navigate("/sign-in")}
            className="text-sm text-stone-600 hover:text-stone-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-200/60"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/sign-up")}
            className="text-sm bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 flex flex-col lg:flex-row gap-16 items-center">
        {/* Left: copy */}
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Personal finance, simplified
          </div>
          <h1 className="text-5xl lg:text-6xl font-serif font-bold leading-tight text-stone-900">
            Your money,
            <br />
            <span className="text-amber-500">clearly.</span>
          </h1>
          <p className="text-lg text-stone-600 max-w-md leading-relaxed">
            Expanse Tracker helps you log daily expenses, understand monthly
            spending patterns, and stay on top of recurring bills — all in one
            clean dashboard.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={() => navigate("/sign-up")}
              className="flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-xl hover:bg-stone-800 transition-colors font-medium"
            >
              Start for free <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
            >
              See how it works ↓
            </button>
          </div>
          <div className="flex items-center gap-6 pt-4 text-sm text-stone-500">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-500" />
              Secure &amp; private
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Monthly insights
            </div>
          </div>
        </div>

        {/* Right: auth CTA card */}
        <div className="w-full lg:w-[400px] shrink-0">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-8 space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-stone-900">Start tracking today</h2>
              <p className="text-sm text-stone-500">Free forever. Upgrade when you're ready.</p>
            </div>

            {/* CTA buttons */}
            <button
              onClick={() => navigate("/sign-up")}
              className="w-full bg-stone-900 text-white py-3 rounded-xl font-semibold hover:bg-stone-800 transition-colors text-sm"
            >
              Create free account
            </button>
            <button
              onClick={() => navigate("/sign-in")}
              className="w-full bg-stone-50 text-stone-700 py-3 rounded-xl font-medium hover:bg-stone-100 transition-colors border border-stone-200 text-sm"
            >
              Sign in to your account
            </button>

            <p className="text-center text-xs text-stone-400">
              Supports Google OAuth · Email OTP · Email &amp; Password
            </p>

            {/* Mini dashboard preview */}
            <div className="bg-[#F5F0E8] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-stone-600">This month</span>
                <span className="text-xs font-mono font-bold text-stone-900">৳4,820</span>
              </div>
              {[
                { name: "Utilities", pct: 65, color: "#42647b" },
                { name: "Bazar", pct: 40, color: "#c49435" },
                { name: "One-Time", pct: 25, color: "#bf6654" },
              ].map(({ name, pct, color }) => (
                <div key={name} className="space-y-1">
                  <span className="text-xs text-stone-500">{name}</span>
                  <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="bg-stone-900 text-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-amber-400 text-sm font-medium uppercase tracking-widest mb-3">
            Why Expanse
          </p>
          <h2 className="text-3xl font-serif font-bold mb-12 max-w-lg">
            Everything you need to understand your spending
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: PenLine,
                title: "Quick Add",
                desc: "Log any expense in under 10 seconds with our minimal entry form.",
              },
              {
                icon: TrendingUp,
                title: "Live Totals",
                desc: "Watch your monthly totals update in real time as you log expenses.",
              },
              {
                icon: FileText,
                title: "PDF Reports",
                desc: "Download a clean PDF summary of any month at any time.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:bg-white/8 transition-colors"
              >
                <div className="w-10 h-10 bg-amber-400/20 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Slideshow ── */}
      <section className="py-24 px-6 bg-[#F5F0E8]">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-4">
            <p className="text-amber-600 text-sm font-medium uppercase tracking-widest">
              Live preview
            </p>
            <h2 className="text-3xl font-serif font-bold text-stone-900">
              Clean, focused design
            </h2>
            <p className="text-stone-600 text-base leading-relaxed">
              A dashboard that stays out of your way and surfaces exactly what
              you need — your spending, clearly laid out.
            </p>
            <div className="flex gap-2 pt-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === slide ? "bg-stone-900 w-6" : "bg-stone-300"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="w-full lg:w-[360px] shrink-0">
            <div
              className={`bg-gradient-to-br ${slides[slide].color} rounded-2xl p-6 h-56 flex flex-col gap-3 transition-all duration-500 shadow-2xl`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${slides[slide].accent}`} />
                <span className="text-white/80 text-xs font-medium">
                  {slides[slide].label}
                </span>
                <span className="text-white/40 text-xs ml-auto">
                  {slides[slide].subtitle}
                </span>
              </div>
              {slides[slide].lines.map((line, i) => (
                <div key={i} className={`${line.w} ${line.h} ${line.c} rounded`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6 bg-stone-100">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-amber-600 text-sm font-medium uppercase tracking-widest mb-3">
            Simple process
          </p>
          <h2 className="text-3xl font-serif font-bold text-stone-900">
            How it works
          </h2>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-px bg-stone-200" />
          <div className="hidden md:block absolute top-10 left-2/3 right-0 h-px bg-stone-200" />
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className="flex flex-col items-center text-center gap-4 relative"
            >
              <div className="w-20 h-20 rounded-2xl bg-stone-900 flex items-center justify-center shadow-lg relative z-10">
                <Icon className="w-9 h-9 text-amber-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-xs font-bold text-stone-900 z-20">
                {i + 1}
              </div>
              <h3 className="font-semibold text-lg text-stone-900">{title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed max-w-[200px]">
                {desc}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-14">
          <button
            onClick={() => navigate("/sign-up")}
            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl hover:bg-stone-800 transition-colors font-medium text-sm"
          >
            Get started free <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-stone-900 text-white/40 py-8 px-6 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
            <Wallet className="w-3 h-3 text-amber-400" />
          </div>
          <span className="text-white/70 font-medium">expanse</span>
        </div>
        <p>Your personal finance, clearly tracked.</p>
      </footer>
    </div>
  );
}
