"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating "jump to top" button.
 * Appears once the page has scrolled past 400px.
 */
export default function JumpToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 end-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-iran-green text-white shadow-iran-green-lg transition-all hover:bg-iran-deep-green hover:shadow-iran-gold-lg"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
