type PaymentAccent = 'amber' | 'emerald' | 'blue' | 'indigo' | 'red';

export const paymentPageTheme = {
  pageShell:
    'min-h-screen bg-white text-slate-950 dark:bg-background dark:text-foreground flex flex-col relative overflow-hidden selection:bg-[#f0b90b] selection:text-black',
  darkAmbientTop:
    'pointer-events-none fixed top-[-20%] right-[-10%] hidden h-[50%] w-[50%] rounded-full bg-[#f0b90b]/5 blur-[120px] dark:block',
  darkAmbientBottom:
    'pointer-events-none fixed bottom-[-20%] left-[-10%] hidden h-[50%] w-[50%] rounded-full bg-blue-500/5 blur-[120px] dark:block',
  primarySurface:
    'rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_18px_52px_rgba(15,23,42,0.08)] dark:border-violet-300/22 dark:bg-slate-950/[0.008] dark:backdrop-blur-[2px] dark:shadow-[0_0_0_1px_rgba(196,181,253,0.12)]',
  secondarySurface:
    'rounded-2xl border border-slate-200/80 bg-white/92 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-violet-300/22 dark:bg-slate-950/[0.006] dark:backdrop-blur-[2px] dark:shadow-[0_0_0_1px_rgba(196,181,253,0.12)]',
  mutedSurface:
    'rounded-2xl border border-slate-200/70 bg-slate-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-violet-300/22 dark:bg-slate-950/[0.005] dark:backdrop-blur-[2px] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  subSurface:
    'rounded-xl border border-slate-200/70 bg-white/85 shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:border-violet-300/22 dark:bg-slate-950/[0.004] dark:backdrop-blur-[2px] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
  ghostButton:
    'border border-slate-200/80 bg-white/90 text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-violet-300/22 dark:bg-slate-950/[0.003] dark:text-slate-200 dark:backdrop-blur-[2px] dark:hover:bg-white/[0.02] dark:hover:text-white',
  subtleText: 'text-slate-500 dark:text-muted-foreground',
  strongSubtleText: 'text-slate-600 dark:text-slate-300/80',
  codePill:
    'inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 dark:bg-slate-950/[0.03] dark:text-slate-300',
  inputSurface:
    'border border-slate-200/80 bg-white text-slate-950 placeholder:text-slate-400 shadow-[0_4px_16px_rgba(15,23,42,0.05)] dark:border-violet-300/22 dark:bg-slate-950/[0.005] dark:text-foreground dark:placeholder:text-white/35 dark:backdrop-blur-[2px] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
} as const;

const accentPanels: Record<PaymentAccent, string> = {
  amber:
    'rounded-2xl border border-amber-200/80 bg-amber-50/95 dark:border-amber-300/28 dark:bg-amber-400/[0.08] dark:backdrop-blur-sm dark:shadow-[0_0_0_1px_rgba(252,211,77,0.12)]',
  emerald:
    'rounded-2xl border border-emerald-200/80 bg-emerald-50/95 dark:border-emerald-300/28 dark:bg-emerald-400/[0.08] dark:backdrop-blur-sm dark:shadow-[0_0_0_1px_rgba(110,231,183,0.12)]',
  blue:
    'rounded-2xl border border-blue-200/80 bg-blue-50/95 dark:border-cyan-300/28 dark:bg-cyan-400/[0.07] dark:backdrop-blur-sm dark:shadow-[0_0_0_1px_rgba(103,232,249,0.12)]',
  indigo:
    'rounded-2xl border border-indigo-200/80 bg-indigo-50/95 dark:border-violet-300/28 dark:bg-violet-400/[0.07] dark:backdrop-blur-sm dark:shadow-[0_0_0_1px_rgba(196,181,253,0.12)]',
  red:
    'rounded-2xl border border-red-200/80 bg-red-50/95 dark:border-red-300/28 dark:bg-red-500/[0.08] dark:backdrop-blur-sm dark:shadow-[0_0_0_1px_rgba(252,165,165,0.12)]',
};

export function getPaymentAccentPanelClass(accent: PaymentAccent): string {
  return accentPanels[accent];
}
