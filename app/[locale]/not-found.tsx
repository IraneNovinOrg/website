import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { Compass, Home, Lightbulb } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <LionSunLogo size="lg" className="opacity-90" />
      <div className="flex items-center gap-2 text-iran-saffron">
        <Compass className="h-5 w-5" />
        <span className="text-sm font-medium uppercase tracking-wide">404</span>
      </div>
      <h1 className="display-text text-3xl md:text-4xl">
        <span className="text-gradient-iran">This page isn&apos;t here.</span>
      </h1>
      <p className="text-base text-muted-foreground">
        The link may be broken, or the idea has been moved. Try one of these
        instead:
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-iran-green hover:bg-iran-deep-green">
          <Link href="/">
            <Home className="me-1.5 h-4 w-4" /> Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/ideas">
            <Lightbulb className="me-1.5 h-4 w-4" /> Browse ideas
          </Link>
        </Button>
      </div>
    </div>
  );
}
