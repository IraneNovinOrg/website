import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

const LAST_UPDATED = "2026-04-21";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("title") };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");
  const sections = t.raw("sections") as {
    use: { heading: string; items: string[] };
    content: { heading: string; items: string[] };
    availability: { heading: string; body: string };
    liability: { heading: string; body: string };
    changes: { heading: string; body: string };
    law: { heading: string; body: string };
    contact: { heading: string; body: string };
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="display-text text-3xl md:text-4xl">
          <span className="text-gradient-iran">{t("title")}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("lastUpdated")}: {LAST_UPDATED}
        </p>
      </header>

      <p className="text-base leading-relaxed text-foreground/90">{t("intro")}</p>

      <Section heading={sections.use.heading}>
        <List items={sections.use.items} />
      </Section>
      <Section heading={sections.content.heading}>
        <List items={sections.content.items} />
      </Section>
      <Section heading={sections.availability.heading}>
        <p>{sections.availability.body}</p>
      </Section>
      <Section heading={sections.liability.heading}>
        <p>{sections.liability.body}</p>
      </Section>
      <Section heading={sections.changes.heading}>
        <p>{sections.changes.body}</p>
      </Section>
      <Section heading={sections.law.heading}>
        <p>{sections.law.body}</p>
      </Section>
      <Section heading={sections.contact.heading}>
        <p>{sections.contact.body}</p>
      </Section>
    </article>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold text-iran-deep-green dark:text-iran-bright-green">
        {heading}
      </h2>
      <div className="mt-3 text-base leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="ms-5 list-disc space-y-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
