"use client";

import { useEffect, useState } from "react";

/**
 * Workspace V2 — Phase 4: lightweight global store for the command palette.
 *
 * We avoid a new dependency (zustand/jotai) by using a plain module-level
 * listener set. `useCommandPalette()` subscribes to changes; the exported
 * imperative helpers `openCommandPalette()` / `closeCommandPalette()` can be
 * called from anywhere (including non-React code such as the keyboard
 * shortcut provider) without needing a context provider higher in the tree.
 */
let isOpen = false;
type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((l) => l(isOpen));
}

export function openCommandPalette(): void {
  if (isOpen) return;
  isOpen = true;
  emit();
}

export function closeCommandPalette(): void {
  if (!isOpen) return;
  isOpen = false;
  emit();
}

export function toggleCommandPalette(): void {
  isOpen = !isOpen;
  emit();
}

export function useCommandPalette(): {
  open: boolean;
  setOpen: (next: boolean) => void;
} {
  const [open, setLocalOpen] = useState<boolean>(isOpen);

  useEffect(() => {
    const listener: Listener = (next) => setLocalOpen(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    open,
    setOpen: (next: boolean) => {
      if (next) openCommandPalette();
      else closeCommandPalette();
    },
  };
}
