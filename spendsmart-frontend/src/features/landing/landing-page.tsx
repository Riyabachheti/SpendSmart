import {
  ArrowRight,
  Check,
  LockKeyhole,
  ReceiptText,
  Tags,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button-variants";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: ReceiptText,
    number: "01",
    title: "Turn receipts into useful records.",
    description:
      "Upload a receipt and review the details SpendSmart finds before anything is saved. Less typing, with you still in control.",
  },
  {
    icon: Tags,
    number: "02",
    title: "Organize spending your way.",
    description:
      "Use familiar default categories or create your own. Every expense stays easy to find, edit, and understand later.",
  },
  {
    icon: WalletCards,
    number: "03",
    title: "Set boundaries that feel practical.",
    description:
      "Create monthly category budgets and see what remains without turning your finances into a scoreboard.",
  },
];

export function LandingPage() {
  useDocumentTitle("A calmer view of your spending");

  return (
    <main id="main-content">
      <section className="grid items-center gap-14 pb-24 pt-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.78fr)] lg:gap-24 lg:pb-32">
        <div>
          <p className="mb-5 text-sm font-medium tracking-[0.12em] text-berry uppercase">
            Everyday money, made clearer
          </p>
          <h1 className="max-w-3xl text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
            Know where your money goes. Keep the feeling calm.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
            SpendSmart gives expenses, receipts, categories, and monthly budgets one thoughtful
            home—so staying aware never has to feel like a second job.
          </p>
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
              to="/register"
            >
              Start tracking gently
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              className="text-sm font-medium text-moss underline-offset-4 hover:text-foreground hover:underline"
              to="/login"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs leading-5 text-muted-foreground">
            <LockKeyhole aria-hidden="true" className="size-3.5 text-moss" />
            Your session is protected, and your access token is never stored in the browser.
          </p>
        </div>

        <div aria-label="An example SpendSmart monthly summary" className="relative mx-auto w-full max-w-md">
          <div aria-hidden="true" className="absolute -top-5 -right-4 size-28 rounded-full bg-marigold/20 sm:-right-9" />
          <div aria-hidden="true" className="absolute -bottom-6 -left-5 h-36 w-20 rounded-full bg-berry/12 sm:-left-10" />
          <div className="relative rotate-[1.2deg] border border-border bg-card px-6 py-7 shadow-soft sm:px-8 sm:py-9">
            <div className="flex items-start justify-between gap-5 border-b border-border pb-6">
              <div>
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">July in focus</p>
                <p className="mt-2 font-serif text-3xl font-semibold">₹24,680 spent</p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">On track</span>
            </div>
            <dl className="divide-y divide-border/70">
              <div className="flex items-center justify-between gap-4 py-5">
                <dt>
                  <span className="mr-3 inline-flex size-8 items-center justify-center rounded-full bg-moss/12" aria-hidden="true">🥬</span>
                  Groceries
                </dt>
                <dd className="text-right">
                  <span className="block font-medium">₹5,240</span>
                  <span className="text-xs text-muted-foreground">₹2,760 left</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-5">
                <dt>
                  <span className="mr-3 inline-flex size-8 items-center justify-center rounded-full bg-marigold/15" aria-hidden="true">🚌</span>
                  Transport
                </dt>
                <dd className="text-right">
                  <span className="block font-medium">₹2,180</span>
                  <span className="text-xs text-muted-foreground">₹1,820 left</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 pt-5">
                <dt>
                  <span className="mr-3 inline-flex size-8 items-center justify-center rounded-full bg-berry/12" aria-hidden="true">☕</span>
                  Eating out
                </dt>
                <dd className="text-right">
                  <span className="block font-medium">₹3,460</span>
                  <span className="text-xs text-muted-foreground">₹540 left</span>
                </dd>
              </div>
            </dl>
            <p className="mt-8 border-l-2 border-moss pl-4 text-sm leading-6 text-muted-foreground">
              A clear view of the month—without a wall of charts.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="principles-title" className="border-y border-border py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="text-sm font-medium tracking-[0.12em] text-berry uppercase">Built for real routines</p>
            <h2 className="mt-4 text-4xl leading-tight sm:text-5xl" id="principles-title">
              Just enough structure to stay aware.
            </h2>
          </div>
          <div className="divide-y divide-border">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="grid gap-4 py-8 first:pt-0 sm:grid-cols-[3rem_1fr] sm:gap-6" key={feature.number}>
                  <div className="flex items-center justify-between sm:block">
                    <Icon aria-hidden="true" className="size-6 text-moss" strokeWidth={1.6} />
                    <span className="text-xs text-muted-foreground sm:mt-4 sm:block">{feature.number}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl">{feature.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="receipt-title" className="grid gap-14 py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-24 lg:py-28">
        <div className="order-2 lg:order-1">
          <div className="mx-auto max-w-md border border-border bg-card p-7 shadow-soft sm:p-9">
            <div className="flex items-center justify-between border-b border-dashed border-border pb-5">
              <div>
                <p className="font-serif text-xl font-semibold">Morning Market</p>
                <p className="mt-1 text-xs text-muted-foreground">18 July 2026</p>
              </div>
              <ReceiptText aria-hidden="true" className="size-6 text-berry" />
            </div>
            <div className="space-y-4 py-6 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Fresh produce</span><span>₹680</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Pantry</span><span>₹420</span></div>
              <div className="flex justify-between gap-4 border-t border-dashed border-border pt-4 font-medium"><span>Total found</span><span>₹1,100</span></div>
            </div>
            <div className="flex items-center gap-3 bg-moss/10 px-4 py-3 text-sm text-moss">
              <span className="flex size-5 items-center justify-center rounded-full bg-moss text-primary-foreground"><Check aria-hidden="true" className="size-3" /></span>
              Ready for your review
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-sm font-medium tracking-[0.12em] text-berry uppercase">Receipts, without the retyping</p>
          <h2 className="mt-4 text-4xl leading-tight sm:text-5xl" id="receipt-title">
            From paper receipt to tidy expense.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
            Photograph or upload a receipt. SpendSmart extracts the useful details, then pauses so you can check the merchant, date, amount, and category before saving.
          </p>
          <ol className="mt-8 space-y-4 text-sm">
            <li className="flex gap-4"><span className="font-serif text-lg text-marigold">1.</span><span className="pt-1">Upload a JPEG, PNG, or WebP receipt.</span></li>
            <li className="flex gap-4"><span className="font-serif text-lg text-marigold">2.</span><span className="pt-1">Review the details found for you.</span></li>
            <li className="flex gap-4"><span className="font-serif text-lg text-marigold">3.</span><span className="pt-1">Save only when everything looks right.</span></li>
          </ol>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-foreground py-20 text-center sm:py-24">
        <div aria-hidden="true" className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marigold/10 blur-2xl" />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-sm font-medium tracking-[0.12em] text-berry uppercase">Start with today</p>
          <h2 className="mt-4 text-4xl leading-tight sm:text-5xl">A clearer money habit can begin with one expense.</h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            No complicated setup. Create an account and make your everyday spending easier to see.
          </p>
          <Link className={cn(buttonVariants({ size: "lg" }), "mt-8 h-11 px-5")} to="/register">
            Create your SpendSmart account
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
