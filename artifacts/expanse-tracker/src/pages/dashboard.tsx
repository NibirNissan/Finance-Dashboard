import { useMemo, useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateExpense,
  useDeleteExpense,
  useGetMonthlySummary,
  useListExpenses,
  useUpdateExpense,
  getListExpensesQueryKey,
  getGetMonthlySummaryQueryKey,
} from "@workspace/api-client-react";
import type { Expense, ExpenseInput } from "@workspace/api-client-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Download,
  Loader2,
  Moon,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";

const categories = ["Utilities", "Bazar", "One-Time"] as const;
type Category = (typeof categories)[number];
const categoryColor: Record<Category, string> = {
  Utilities: "#42647b",
  Bazar: "#c49435",
  "One-Time": "#bf6654",
};
const currentMonth = new Date().toISOString().slice(0, 7);
const money = (amount: number) =>
  `৳${new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
const pdfMoney = (amount: number) =>
  `BDT ${new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
const dateOnly = (date: string) => date.slice(0, 10);
const prettyDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${dateOnly(date)}T12:00:00`),
  );
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00`));
const shiftMonth = (month: string, amount: number) => {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + amount);
  return date.toISOString().slice(0, 7);
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ExpenseForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Expense;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const [form, setForm] = useState<ExpenseInput>({
    title: initial?.title ?? "",
    amount: initial?.amount ?? 0,
    category: initial?.category ?? "Bazar",
    date: initial ? dateOnly(initial.date) : new Date().toISOString().slice(0, 10),
    type: initial?.type ?? "one-time",
  });
  const set = (key: keyof ExpenseInput, value: string | number) =>
    setForm((valueBefore) => ({ ...valueBefore, [key]: value }));
  const pending = create.isPending || update.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || Number(form.amount) <= 0) return;
    const data = {
      data: { ...form, title: form.title.trim(), amount: Number(form.amount) },
    };
    if (initial) {
      update.mutate({ id: initial.id, ...data }, { onSuccess: onDone });
    } else {
      create.mutate(data, { onSuccess: onDone });
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl">
          {initial ? "Edit expense" : "Add an expense"}
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close form"
            data-testid="button-close-form"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <Field label="What was it?">
        <input
          autoFocus
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="e.g. Electric bill"
          data-testid="input-expense-title"
          className="h-11 rounded-lg border bg-background px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground">৳</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount || ""}
              onChange={(event) => set("amount", Number(event.target.value))}
              placeholder="0.00"
              data-testid="input-expense-amount"
              className="h-11 w-full rounded-lg border bg-background pl-7 pr-3 outline-none focus:border-primary"
            />
          </div>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={form.date}
            onChange={(event) => set("date", event.target.value)}
            data-testid="input-expense-date"
            className="h-11 rounded-lg border bg-background px-3 outline-none focus:border-primary"
          />
        </Field>
      </div>
      <Field label="Category">
        <div className="grid grid-cols-3 gap-2">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => set("category", category)}
              data-testid={`button-category-${category}`}
              className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${
                form.category === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Frequency">
        <div className="grid grid-cols-2 gap-2">
          {(["one-time", "recurring"] as const).map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => set("type", type)}
              data-testid={`button-type-${type}`}
              className={`rounded-lg border px-3 py-2.5 text-sm capitalize transition ${
                form.type === type
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </Field>
      <button
        disabled={pending}
        data-testid="button-save-expense"
        className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {initial ? "Save changes" : "Add to ledger"}
      </button>
    </form>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense>();
  const [deleting, setDeleting] = useState<number>();
  const [filter, setFilter] = useState<Category | "All">("All");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [darkMode, setDarkMode] = useState(false);
  const list = useListExpenses({
    query: { queryKey: getListExpensesQueryKey() },
  });
  const summary = useGetMonthlySummary(
    { month: selectedMonth },
    {
      query: {
        queryKey: getGetMonthlySummaryQueryKey({ month: selectedMonth }),
      },
    },
  );
  const remove = useDeleteExpense();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("expanse-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enabled = savedTheme ? savedTheme === "dark" : prefersDark;
    setDarkMode(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("expanse-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const expenses = useMemo(
    () =>
      (list.data ?? [])
        .filter((expense) => dateOnly(expense.date).startsWith(selectedMonth))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [list.data, selectedMonth],
  );
  const visible = filter === "All" ? expenses : expenses.filter((expense) => expense.category === filter);
  const total =
    summary.data?.total ?? expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const count = summary.data?.transactionCount ?? expenses.length;
  const grouped = useMemo(
    () =>
      categories.map((category) => ({
        category,
        total:
          summary.data?.byCategory?.find((item) => item.category === category)?.total ??
          expenses
            .filter((expense) => expense.category === category)
            .reduce((sum, expense) => sum + expense.amount, 0),
      })),
    [summary.data, expenses],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: getGetMonthlySummaryQueryKey({ month: selectedMonth }),
    });
  };
  const done = () => {
    setShowForm(false);
    setEditing(undefined);
    refresh();
  };
  const toggleTheme = () => setDarkMode((enabled) => !enabled);
  const downloadReport = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(33, 53, 73);
    doc.rect(0, 0, pageWidth, 115, "F");
    doc.setTextColor(250, 248, 242);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("expanse", 42, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Monthly spending report", 42, 76);
    doc.text(monthLabel(selectedMonth), pageWidth - 42, 76, { align: "right" });
    doc.setTextColor(33, 53, 73);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL SPENT", 42, 153);
    doc.setFontSize(26);
    doc.text(pdfMoney(total), 42, 185);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 110, 118);
    doc.text(`${count} transactions recorded`, 42, 205);
    doc.setTextColor(33, 53, 73);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("CATEGORY BREAKDOWN", 42, 250);
    autoTable(doc, {
      startY: 264,
      head: [["Category", "Total"]],
      body: grouped.map((item) => [item.category, pdfMoney(item.total)]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 10, textColor: [33, 53, 73], cellPadding: 7 },
      headStyles: { fillColor: [238, 232, 214], textColor: [33, 53, 73], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
    });
    const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 350;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ITEMIZED EXPENSES", 42, tableEnd + 40);
    autoTable(doc, {
      startY: tableEnd + 54,
      head: [["Date", "Expense", "Category", "Type", "Amount"]],
      body: expenses.map((expense) => [
        prettyDate(expense.date),
        expense.title,
        expense.category,
        expense.type === "one-time" ? "One-time" : "Recurring",
        pdfMoney(expense.amount),
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 9, textColor: [33, 53, 73], cellPadding: 6 },
      headStyles: { fillColor: [33, 53, 73], textColor: [250, 248, 242], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 246, 239] },
      columnStyles: { 4: { halign: "right" } },
    });
    doc.setFontSize(8);
    doc.setTextColor(120, 125, 128);
    doc.text("Generated by expanse · a calmer view of spending", 42, doc.internal.pageSize.getHeight() - 28);
    doc.save(`expanse-${selectedMonth}-report.pdf`);
  };

  return (
    <div className="grain min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[238px] flex-col bg-sidebar px-6 py-7 text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <CircleDollarSign size={19} />
          </div>
          <span className="font-serif text-[25px] tracking-tight">expanse</span>
        </div>
        <div className="mt-16 text-[10px] font-semibold uppercase tracking-[.18em] text-sidebar-foreground/45">
          Your money, clearly
        </div>
        <nav className="mt-4 grid gap-1">
          <button data-testid="nav-dashboard" className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-3 text-left text-sm font-semibold">
            <ReceiptText size={17} className="text-sidebar-primary" />
            Overview
          </button>
        </nav>
        <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <Sparkles size={16} className="mb-3 text-sidebar-primary" />
          <p className="text-sm leading-5">Small entries make a steady picture.</p>
          <p className="mt-2 text-xs text-sidebar-foreground/50">Keep going, one day at a time.</p>
        </div>
      </aside>
      <main className="md:ml-[238px]">
        <header className="border-b border-border/70 px-5 py-5 md:px-10 md:py-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Personal ledger</p>
              <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">
                Good morning, Alex<span className="text-accent">.</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                data-testid="button-theme-toggle"
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                className="rounded-full border bg-card p-2.5 text-muted-foreground transition hover:text-foreground"
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                onClick={refresh}
                data-testid="button-refresh"
                aria-label="Refresh expenses"
                className="hidden rounded-full border bg-card p-2.5 text-muted-foreground transition hover:-rotate-12 hover:text-foreground sm:block"
              >
                <RefreshCw size={17} />
              </button>
              <button
                onClick={() => {
                  setEditing(undefined);
                  setShowForm(true);
                }}
                data-testid="button-quick-add"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5"
              >
                <Plus size={17} /> <span className="hidden sm:inline">Quick add</span>
              </button>
            </div>
          </div>
          <div className="mx-auto mt-6 flex max-w-[1240px] flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-sm">
              <button
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                data-testid="button-previous-month"
                aria-label="Previous month"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft size={15} />
              </button>
              <span data-testid="text-selected-month" className="min-w-[140px] text-center font-mono text-xs font-medium">
                {monthLabel(selectedMonth)}
              </span>
              <button
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                data-testid="button-next-month"
                aria-label="Next month"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ArrowRight size={15} />
              </button>
            </div>
            <button
              onClick={downloadReport}
              data-testid="button-download-report"
              className="flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted"
            >
              <Download size={16} />
              <span>Download Monthly Report (PDF)</span>
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1240px] px-5 py-7 md:px-10 md:py-10">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <section className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg md:p-8 rise">
              <div className="absolute -right-10 -top-16 size-64 rounded-full border-[28px] border-accent/20" />
              <div className="absolute -bottom-24 right-28 size-56 rounded-full border border-sidebar-primary/20" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-primary-foreground/65">Spent in {monthLabel(selectedMonth)}</p>
                  <CalendarDays size={18} className="text-accent" />
                </div>
                <p data-testid="text-total-expenses" className="mt-7 font-mono text-5xl tracking-[-.08em] md:text-6xl">
                  {money(total)}
                </p>
                <div className="mt-7 flex items-end justify-between">
                  <p className="text-sm text-primary-foreground/60">
                    <span data-testid="text-transaction-count" className="font-semibold text-primary-foreground">{count}</span> transactions recorded
                  </p>
                  <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                    <ArrowUpRight size={14} /> {selectedMonth === currentMonth ? "this month" : "selected month"}
                  </span>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-6 shadow-sm md:p-8 rise delay-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">The shape of it</p>
                  <h2 className="mt-1 font-serif text-2xl">By category</h2>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{selectedMonth.replace("-", " / ")}</span>
              </div>
              <div className="mt-6 grid gap-4">
                {grouped.map(({ category, total: amount }) => {
                  const percentage = total ? (amount / total) * 100 : 0;
                  return (
                    <div key={category} data-testid={`category-row-${category}`}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="font-medium">{category}</span>
                        <span className="font-mono text-xs text-muted-foreground">{money(amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%`, backgroundColor: categoryColor[category] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <section className="mt-8 rise delay-2">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">The paper trail</p>
                <h2 className="mt-1 font-serif text-3xl">Recent expenses</h2>
              </div>
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                {(["All", ...categories] as const).map((category) => (
                  <button
                    key={category}
                    onClick={() => setFilter(category)}
                    data-testid={`button-filter-${category}`}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${filter === category ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              {list.isLoading ? (
                <div className="grid gap-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
              ) : list.isError ? (
                <div className="grid place-items-center gap-2 p-14 text-center">
                  <p className="font-serif text-2xl">Couldn’t open the ledger</p>
                  <p className="text-sm text-muted-foreground">Something interrupted the connection.</p>
                  <button onClick={() => list.refetch()} data-testid="button-retry-expenses" className="mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted">
                    <RefreshCw size={14} /> Try again
                  </button>
                </div>
              ) : visible.length === 0 ? (
                <div className="grid place-items-center gap-3 p-14 text-center">
                  <div className="grid size-12 place-items-center rounded-full bg-accent/25 text-primary"><ReceiptText size={22} /></div>
                  <p className="font-serif text-2xl">{filter === "All" ? "A clean page." : `No ${filter.toLowerCase()} yet.`}</p>
                  <p className="max-w-xs text-sm text-muted-foreground">Add the first expense and your month will start to take shape.</p>
                  <button onClick={() => setShowForm(true)} data-testid="button-empty-add" className="mt-1 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                    <Plus size={15} /> Add expense
                  </button>
                </div>
              ) : (
                <div>
                  {visible.slice(0, 8).map((expense) => (
                    <div key={expense.id} data-testid={`row-expense-${expense.id}`} className="group flex items-center gap-3 border-b px-4 py-4 last:border-0 md:px-6">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{ backgroundColor: `${categoryColor[expense.category]}18`, color: categoryColor[expense.category] }}>
                        {expense.title.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{expense.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{expense.category}</span><span className="size-1 rounded-full bg-border" /><span>{prettyDate(expense.date)}</span>
                          {expense.type === "recurring" && <><span className="size-1 rounded-full bg-border" /><span className="text-primary">Recurring</span></>}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-medium">{money(expense.amount)}</span>
                      <div className="flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                        <button onClick={() => { setEditing(expense); setShowForm(true); }} aria-label={`Edit ${expense.title}`} data-testid={`button-edit-expense-${expense.id}`} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /></button>
                        <button onClick={() => setDeleting(expense.id)} aria-label={`Delete ${expense.title}`} data-testid={`button-delete-expense-${expense.id}`} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          <footer className="mt-8 flex items-center justify-between border-t border-border/70 pt-5 text-xs text-muted-foreground">
            <span>Expanse · a calmer view of spending</span><span className="font-mono">{expenses.length} in {monthLabel(selectedMonth)}</span>
          </footer>
        </div>
      </main>
      {showForm && (
        <div className="fixed inset-0 z-30 grid items-end bg-primary/20 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="w-full rounded-t-2xl border bg-card p-6 shadow-lg sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <ExpenseForm initial={editing} onDone={done} onCancel={() => { setShowForm(false); setEditing(undefined); }} />
          </div>
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-primary/25 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg">
            <div className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 size={20} /></div>
            <h3 className="mt-4 font-serif text-2xl">Remove this entry?</h3>
            <p className="mt-1 text-sm text-muted-foreground">This can’t be undone, but your other entries will stay right where they are.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setDeleting(undefined)} data-testid="button-cancel-delete" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">Keep it</button>
              <button disabled={remove.isPending} onClick={() => remove.mutate({ id: deleting }, { onSuccess: () => { setDeleting(undefined); refresh(); } })} data-testid="button-confirm-delete" className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60">
                {remove.isPending && <Loader2 size={14} className="animate-spin" />}Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}