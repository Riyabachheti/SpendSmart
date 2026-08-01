import type { PropsWithChildren } from "react";

type AuthPageProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
  note: string;
}>;

export function AuthPage({
  eyebrow,
  title,
  description,
  note,
  children,
}: AuthPageProps) {
  return (
    <main
      className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] lg:gap-20"
      id="main-content"
      tabIndex={-1}
    >
      <div className="max-w-xl pt-2 lg:pt-8">
        <p className="mb-4 text-sm font-medium tracking-wide text-berry">{eyebrow}</p>
        <h1 className="text-4xl leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
          {description}
        </p>
        <blockquote className="mt-10 border-l-2 border-marigold pl-5 font-serif text-xl leading-8 text-foreground/85">
          {note}
        </blockquote>
      </div>
      <section className="border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pt-4 lg:pl-12">
        {children}
      </section>
    </main>
  );
}
