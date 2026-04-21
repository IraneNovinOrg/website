import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

// Last-updated date lives here so it's visible in the page source and
// automatically reflects the most recent content review. Bump whenever
// the policy materially changes.
const LAST_UPDATED = "2026-04-21";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");
  const sections = t.raw("sections") as {
    data: { heading: string; items: string[] };
    purposes: { heading: string; items: string[] };
    cookies: {
      heading: string;
      intro: string;
      rows: Array<{ name: string; purpose: string; duration: string; category: string }>;
    };
    sharing: { heading: string; items: string[] };
    retention: { heading: string; items: string[] };
    rights: { heading: string; intro: string; items: string[]; contact: string };
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

      <Section heading={sections.data.heading}>
        <List items={sections.data.items} />
      </Section>

      <Section heading={sections.purposes.heading}>
        <List items={sections.purposes.items} />
      </Section>

      <Section heading={sections.cookies.heading}>
        <p className="mb-3 text-sm text-muted-foreground">
          {sections.cookies.intro}
        </p>
        <div className="overflow-x-auto rounded-lg border border-iran-green/20">
          <table className="w-full text-sm">
            <thead className="bg-iran-green/5 text-start">
              <tr>
                <Th>Name</Th>
                <Th>Purpose</Th>
                <Th>Duration</Th>
                <Th>Category</Th>
              </tr>
            </thead>
            <tbody>
              {sections.cookies.rows.map((row) => (
                <tr key={row.name} className="border-t border-iran-green/10">
                  <Td>
                    <code className="rounded bg-iran-green/10 px-1.5 py-0.5 text-xs">
                      {row.name}
                    </code>
                  </Td>
                  <Td>{row.purpose}</Td>
                  <Td>{row.duration}</Td>
                  <Td>{row.category}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section heading={sections.sharing.heading}>
        <List items={sections.sharing.items} />
      </Section>

      <Section heading={sections.retention.heading}>
        <List items={sections.retention.items} />
      </Section>

      <Section heading={sections.rights.heading}>
        <p className="mb-3">{sections.rights.intro}</p>
        <List items={sections.rights.items} />
        <p className="mt-4 text-sm text-foreground/80">{sections.rights.contact}</p>
      </Section>
    </article>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-start font-semibold text-iran-deep-green dark:text-iran-bright-green">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
