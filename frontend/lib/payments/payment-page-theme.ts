type PaymentAccent = 'amber' | 'emerald' | 'blue' | 'indigo' | 'red';

export const paymentPageTheme = {
  pageShell:
    'min-h-screen bg-transparent text-slate-950 dark:bg-transparent dark:text-foreground flex flex-col relative overflow-hidden selection:bg-[#f0b90b] selection:text-black',
  darkAmbientTop:
    'pointer-events-none fixed top-[-20%] right-[-10%] hidden h-[50%] w-[50%] rounded-full bg-[#f0b90b]/5 blur-[120px] dark:block',
  darkAmbientBottom:
    'pointer-events-none fixed bottom-[-20%] left-[-10%] hidden h-[50%] w-[50%] rounded-full bg-blue-500/5 blur-[120px] dark:block',
  primarySurface:
    'rounded-3xl border border-violet-300/70 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.26),0_0_30px_rgba(167,139,250,0.08)] dark:border-violet-300/70 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.28),0_0_34px_rgba(196,181,253,0.12)]',
  secondarySurface:
    'rounded-2xl border border-violet-300/65 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.22),0_0_24px_rgba(167,139,250,0.06)] dark:border-violet-300/65 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.24),0_0_28px_rgba(196,181,253,0.1)]',
  mutedSurface:
    'rounded-2xl border border-violet-300/55 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.18)] dark:border-violet-300/55 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.2)]',
  subSurface:
    'rounded-xl border border-violet-300/55 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.18)] dark:border-violet-300/55 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.2)]',
  ghostButton:
    'border border-violet-300/65 bg-transparent text-slate-700 hover:border-violet-300/80 hover:text-slate-950 dark:border-violet-300/65 dark:bg-transparent dark:text-slate-200 dark:hover:border-violet-200/90 dark:hover:text-white',
  subtleText: 'text-slate-500 dark:text-muted-foreground',
  strongSubtleText: 'text-slate-600 dark:text-slate-300/80',
  codePill:
    'inline-block rounded border border-violet-300/55 bg-transparent px-2 py-1 font-mono text-xs text-slate-600 dark:border-violet-300/55 dark:bg-transparent dark:text-slate-300',
  inputSurface:
    'border border-violet-300/65 bg-transparent text-slate-950 placeholder:text-slate-400 shadow-[0_0_0_1px_rgba(167,139,250,0.22)] dark:border-violet-300/65 dark:bg-transparent dark:text-foreground dark:placeholder:text-white/35 dark:shadow-[0_0_0_1px_rgba(196,181,253,0.22)]',
} as const;

const accentPanels: Record<PaymentAccent, string> = {
  amber:
    'rounded-2xl border border-violet-300/70 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.24),0_0_24px_rgba(167,139,250,0.08)] dark:border-violet-300/70 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.26),0_0_28px_rgba(196,181,253,0.1)]',
  emerald:
    'rounded-2xl border border-violet-300/70 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.24),0_0_24px_rgba(167,139,250,0.08)] dark:border-violet-300/70 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.26),0_0_28px_rgba(196,181,253,0.1)]',
  blue:
    'rounded-2xl border border-violet-300/70 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.24),0_0_24px_rgba(167,139,250,0.08)] dark:border-violet-300/70 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.26),0_0_28px_rgba(196,181,253,0.1)]',
  indigo:
    'rounded-2xl border border-violet-300/70 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.24),0_0_24px_rgba(167,139,250,0.08)] dark:border-violet-300/70 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.26),0_0_28px_rgba(196,181,253,0.1)]',
  red:
    'rounded-2xl border border-violet-300/70 bg-transparent shadow-[0_0_0_1px_rgba(167,139,250,0.24),0_0_24px_rgba(167,139,250,0.08)] dark:border-violet-300/70 dark:bg-transparent dark:shadow-[0_0_0_1px_rgba(196,181,253,0.26),0_0_28px_rgba(196,181,253,0.1)]',
};

export function getPaymentAccentPanelClass(accent: PaymentAccent): string {
  return accentPanels[accent];
}
