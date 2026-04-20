import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock next-intl/navigation
vi.mock("@/i18n/routing", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/en",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

describe("Smoke Tests", () => {
  it("renders the MarkdownRenderer component", async () => {
    const { default: MarkdownRenderer } = await import(
      "@/components/ui/MarkdownRenderer"
    );
    render(<MarkdownRenderer content="**Hello** world" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
  });

  it("renders a Badge component", async () => {
    const { Badge } = await import("@/components/ui/badge");
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("renders a Button component", async () => {
    const { Button } = await import("@/components/ui/button");
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders the CategoryFilter component", async () => {
    const { default: CategoryFilter } = await import(
      "@/components/ideas/CategoryFilter"
    );
    render(<CategoryFilter selected="all" onChange={() => {}} />);
    expect(screen.getByText("all")).toBeInTheDocument();
  });
});
