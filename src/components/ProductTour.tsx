"use client";

import { useAppKit } from "@reown/appkit/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import {
  TOUR_PHASE_LABEL,
  TOUR_STEP_KEY,
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  resolveStepHref,
  stepLocationMatches,
  type TourStep,
} from "@/lib/tour";
import clsx from "clsx";

const CARD_W = 340;
const CARD_H = 240;
const PAD = 12;
const MOVE_MS = 480;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type Hole = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TourContext = createContext<{
  open: boolean;
  start: () => void;
} | null>(null);

export function useTour() {
  return (
    useContext(TourContext) ?? {
      open: false,
      start: () => {},
    }
  );
}

function queryTourTarget(target: string) {
  const nodes = [
    ...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`),
  ];
  return (
    nodes.find((node) => {
      const r = node.getBoundingClientRect();
      return r.width > 8 && r.height > 8;
    }) ?? null
  );
}

function primaryLabel(step: TourStep, waiting: boolean, last: boolean) {
  if (waiting) return step.cta ?? "Connect wallet";
  if (last) return step.cta ?? "Done";
  return step.cta ?? "Next";
}

function placeCard(hole: Hole | null) {
  const cardW = Math.min(CARD_W, window.innerWidth - 32);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left: number;
  let top: number;
  let place: "below" | "above" | "right" | "center" = "center";

  if (hole) {
    const spaceRight = vw - (hole.left + hole.width);
    const spaceBelow = vh - (hole.top + hole.height);
    const spaceAbove = hole.top;

    if (vw >= 900 && spaceRight >= cardW + 24) {
      place = "right";
      left = hole.left + hole.width + 16;
      top = Math.min(Math.max(16, hole.top), Math.max(16, vh - CARD_H - 16));
    } else if (spaceBelow >= CARD_H + 20) {
      place = "below";
      left = Math.min(Math.max(16, hole.left), Math.max(16, vw - cardW - 16));
      top = hole.top + hole.height + 14;
    } else if (spaceAbove >= CARD_H + 20) {
      place = "above";
      left = Math.min(Math.max(16, hole.left), Math.max(16, vw - cardW - 16));
      top = Math.max(16, hole.top - CARD_H - 14);
    } else {
      place = "below";
      left = Math.min(Math.max(16, hole.left), Math.max(16, vw - cardW - 16));
      top = Math.min(hole.top + hole.height + 14, Math.max(16, vh - CARD_H - 16));
    }
  } else {
    left = Math.max(16, (vw - cardW) / 2);
    top = Math.max(24, vh * 0.22);
  }

  return { left, top, place, cardW };
}

function rectToHole(rect: DOMRect): Hole {
  return {
    top: Math.max(8, rect.top - PAD),
    left: Math.max(8, rect.left - PAD),
    width: Math.min(rect.width + PAD * 2, window.innerWidth - 16),
    height: Math.min(rect.height + PAD * 2, window.innerHeight * 0.62),
  };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("tour") === "1";
    const saved = window.sessionStorage.getItem(TOUR_STEP_KEY);
    if (forced) {
      setOpen(true);
      if (saved == null) setStep(0);
      if (!pathname.startsWith("/app")) {
        router.replace("/app?tab=explore&tour=1");
      }
      return;
    }
    if (saved != null && pathname.startsWith("/app")) {
      const index = Number(saved);
      if (Number.isFinite(index)) {
        setStep(Math.max(0, Math.min(index, TOUR_STEPS.length - 1)));
      }
      setOpen(true);
      return;
    }
    if (
      pathname.startsWith("/app") &&
      !window.localStorage.getItem(TOUR_STORAGE_KEY)
    ) {
      setOpen(true);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (open) window.sessionStorage.setItem(TOUR_STEP_KEY, String(step));
    else window.sessionStorage.removeItem(TOUR_STEP_KEY);
  }, [open, step]);

  const start = useCallback(() => {
    setStep(0);
    setOpen(true);
    router.replace("/app?tab=explore&tour=1", { scroll: false });
  }, [router]);

  const value = useMemo(() => ({ open, start }), [open, start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <ProductTour
          open={open}
          onOpenChange={setOpen}
          step={step}
          setStep={setStep}
        />
      </Suspense>
    </TourContext.Provider>
  );
}

export function ProductTour({
  open,
  onOpenChange,
  step,
  setStep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: number;
  setStep: (value: number | ((current: number) => number)) => void;
}) {
  const { isConnected } = useAccount();
  const { open: openWallet } = useAppKit();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const [hole, setHole] = useState<Hole | null>(null);
  const [href, setHref] = useState<string | null>(null);
  const [cardPos, setCardPos] = useState<{
    left: number;
    top: number;
    place: "below" | "above" | "right" | "center";
  }>({ left: 16, top: 24, place: "center" });
  const [contentVisible, setContentVisible] = useState(true);
  const [displayStep, setDisplayStep] = useState(step);
  const [overlayIn, setOverlayIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = TOUR_STEPS[step];
  const shown = TOUR_STEPS[displayStep] ?? current;
  const last = step === TOUR_STEPS.length - 1;
  const waiting = Boolean(shown?.waitForWallet && !isConnected);
  const finishRef = useRef(() => {});
  const nextRef = useRef(() => {});
  const backRef = useRef(() => {});
  const contentTimer = useRef(0);

  function finish() {
    setOverlayIn(false);
    window.setTimeout(() => {
      window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
      window.sessionStorage.removeItem(TOUR_STEP_KEY);
      onOpenChange(false);
      setStep(0);
      setHole(null);
      const url = new URL(window.location.href);
      if (url.searchParams.has("tour")) {
        url.searchParams.delete("tour");
        const next = `${url.pathname}${url.search}`;
        router.replace(next, { scroll: false });
      }
    }, 220);
  }

  function next() {
    if (busy) return;
    if (waiting) {
      openWallet();
      return;
    }
    if (last) finish();
    else setStep((v) => v + 1);
  }

  function back() {
    if (busy) return;
    setStep((v) => Math.max(0, v - 1));
  }

  finishRef.current = finish;
  nextRef.current = next;
  backRef.current = back;

  useEffect(() => {
    if (!open) {
      setOverlayIn(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setOverlayIn(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (displayStep === step) {
      const release = window.setTimeout(() => setBusy(false), MOVE_MS);
      return () => window.clearTimeout(release);
    }
    setBusy(true);
    setContentVisible(false);
    window.clearTimeout(contentTimer.current);
    contentTimer.current = window.setTimeout(() => {
      setDisplayStep(step);
      setContentVisible(true);
    }, 160);
    return () => window.clearTimeout(contentTimer.current);
  }, [step, displayStep, open]);

  useEffect(() => {
    if (open) setDisplayStep(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !current?.waitForWallet || !isConnected) return;
    const timer = window.setTimeout(() => finishRef.current(), 400);
    return () => window.clearTimeout(timer);
  }, [open, current, isConnected]);

  useEffect(() => {
    if (!open || !current) return;
    const nextHref = resolveStepHref(current);
    setHref(nextHref);
    if (nextHref && !stepLocationMatches(pathname, search, nextHref)) {
      const url = new URL(nextHref, window.location.origin);
      url.searchParams.set("tour", "1");
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, {
        scroll: false,
      });
    }
  }, [current, open, pathname, router, search]);

  useLayoutEffect(() => {
    if (!open || !current) return;
    if (href && !stepLocationMatches(pathname, search, href)) return;

    let frame = 0;
    let retry = 0;
    let revealTimer = 0;

    function applyHole(next: Hole | null) {
      setHole(next);
      const placed = placeCard(next);
      setCardPos({ left: placed.left, top: placed.top, place: placed.place });
    }

    function measure() {
      if (!current?.target) {
        applyHole(null);
        return;
      }
      const node = queryTourTarget(current.target);
      if (!node) {
        retry = window.setTimeout(measure, 120);
        return;
      }
      applyHole(rectToHole(node.getBoundingClientRect()));
    }

    function reveal() {
      if (!current?.target) {
        applyHole(null);
        return;
      }
      queryTourTarget(current.target)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      window.setTimeout(measure, 280);
    }

    frame = window.requestAnimationFrame(() => {
      revealTimer = window.setTimeout(reveal, current.tab ? 240 : 60);
    });

    const onScrollOrResize = () => {
      if (!current?.target) return;
      const node = queryTourTarget(current.target);
      if (!node) return;
      const next = rectToHole(node.getBoundingClientRect());
      setHole(next);
      const placed = placeCard(next);
      setCardPos({ left: placed.left, top: placed.top, place: placed.place });
    };

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.clearTimeout(revealTimer);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [current, href, open, pathname, search]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") finishRef.current();
      if (event.key === "ArrowRight" || event.key === "Enter") {
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        event.preventDefault();
        nextRef.current();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        backRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !shown) return null;

  const progress = ((displayStep + 1) / TOUR_STEPS.length) * 100;
  const phase = TOUR_PHASE_LABEL[shown.phase];
  const moveTransition = `top ${MOVE_MS}ms ${EASE}, left ${MOVE_MS}ms ${EASE}, width ${MOVE_MS}ms ${EASE}, height ${MOVE_MS}ms ${EASE}`;

  return (
    <div
      className={clsx(
        "pointer-events-none fixed inset-0 z-[80] transition-opacity duration-300",
        overlayIn ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
    >
      <Spotlight hole={hole} transition={moveTransition} />

      <div
        data-tour-card
        className="pointer-events-auto absolute z-20 w-[min(21.25rem,calc(100vw-2rem))] rounded-3xl bg-white p-4 text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-black/10"
        style={{
          top: cardPos.top,
          left: cardPos.left,
          transition: overlayIn
            ? `top ${MOVE_MS}ms ${EASE}, left ${MOVE_MS}ms ${EASE}, opacity 280ms ${EASE}, transform 280ms ${EASE}`
            : "none",
          opacity: overlayIn ? 1 : 0,
          transform: overlayIn ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                {phase}
              </span>
              <span className="text-[10px] font-medium tabular-nums text-[var(--ink-soft)]">
                {displayStep + 1}/{TOUR_STEPS.length}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-black"
                style={{
                  width: `${progress}%`,
                  transition: `width ${MOVE_MS}ms ${EASE}`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={finish}
            className="-mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-[var(--ink-soft)] transition hover:bg-black/5 hover:text-black"
            aria-label="Close guide"
          >
            ×
          </button>
        </div>

        <div
          className="transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? "translateY(0)" : "translateY(6px)",
          }}
        >
          <h2 id="tour-title" className="mt-3 text-[1.15rem] font-semibold tracking-tight">
            {shown.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
            {shown.body}
          </p>
          <p className="mt-2 text-[11px] text-[var(--ink-faint)]">
            {waiting ? "Connect to finish · Esc to skip" : "← → to move · Esc to skip"}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {displayStep > 0 ? (
            <button
              type="button"
              onClick={back}
              disabled={busy}
              className="h-9 rounded-full px-3 text-sm font-medium text-[var(--ink-soft)] transition hover:bg-black/5 hover:text-black disabled:opacity-40"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="h-9 px-2 text-sm text-[var(--ink-soft)] transition hover:text-black"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={busy && !waiting}
            className="btn btn-primary ml-auto h-9 px-4 disabled:opacity-50"
          >
            {primaryLabel(shown, waiting, displayStep === TOUR_STEPS.length - 1)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spotlight({
  hole,
  transition,
}: {
  hole: Hole | null;
  transition: string;
}) {
  if (!hole) {
    return <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/55" />;
  }
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute z-[1] rounded-3xl"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
          transition,
        }}
      />
      <div
        className="tour-spotlight pointer-events-none absolute z-[3] rounded-3xl"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          transition,
        }}
      />
    </>
  );
}
