import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import Logo from '../components/Logo.jsx';
import { useIntroDone } from '../lib/intro.js';

/**
 * The public landing page, built to the Chromia identity system.
 *
 * Its vocabulary, in the order you meet it: a floating pill of navigation, a
 * heavy soft-serif headline split across two tones, dark panels carrying a dot
 * field rather than a flat fill, and bright chip cards — one hue each from the
 * published ramp — with a small black action inside. Stickers sit at the
 * corners on a slight rotation, which is what keeps the whole thing from
 * reading as a corporate template.
 *
 * The three sections are the ones asked for, and the hero deliberately names
 * no technology: someone arriving here wants to know what it does for them.
 */

const NAV_LINKS = [
  { label: 'How it works', href: '#release' },
  { label: 'Roles', href: '#roles' },
];

/**
 * Each step gets its own hue from the ramp. Chromia never repeats a colour
 * inside one row — the variety is the point.
 */
const RELEASE_STEPS = [
  {
    n: '01',
    title: 'Decrypt and hash',
    body: 'The file is opened with AES-256-GCM and the exact bytes released are hashed. That hash, not the stored original, is what the receipt commits to.',
    fill: 'bg-chromia-pink-500',
  },
  {
    n: '02',
    title: 'Anchor the receipt',
    body: 'The receipt is written to the chain before any watermark is embedded. If the write fails nothing is released, so a marked copy cannot exist without a receipt.',
    fill: 'bg-chromia-green-500',
  },
  {
    n: '03',
    title: 'Embed and index',
    body: 'A 48-bit payload goes into the HL/LH sub-bands of a 2-level Haar DWT, and the perceptual hashes are indexed for later search.',
    fill: 'bg-chromia-yellow-500',
  },
];

const ROLE_CHIPS = [
  {
    label: 'Clearance Holder',
    body: 'Releases a marked copy to themselves and nothing more. Cannot investigate.',
    fill: 'bg-chromia-yellow-500',
  },
  {
    label: 'Forensic Analyst',
    body: 'Traces leaked files back to their receipt. Cannot decrypt, so cannot manufacture evidence.',
    fill: 'bg-chromia-green-500',
  },
  {
    label: 'Registry Administrator',
    body: 'Full custody — uploads, releases, investigations and the audit trail.',
    fill: 'bg-chromia-pink-500',
  },
  {
    label: 'Forensic Analyst',
    body: 'Traces a leaked file back to its release. Holds no decrypt rights at all.',
    fill: 'bg-chromia-green-500',
  },
];

export default function Landing() {
  useSectionBackground();

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      <div className="site-background" aria-hidden="true">
        <div className="site-background__layer site-background__base" />
        <div className="site-background__layer site-background__grid" />
        <div className="site-background__layer site-background__accent" />
        <div className="site-background__layer site-background__dark" />
      </div>

      <NavBar />
      <Hero />
      <ReleaseSection />
      <ClosingSection />
    </div>
  );
}

/* ------------------------------------------------------------- navbar ---- */

function NavBar() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full bg-canvas px-4 py-3 shadow-[0_10px_30px_-12px_rgba(31,26,35,0.20)] sm:px-6 sm:py-3.5">
        <Logo size="sm" />

        <div className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-ink transition hover:text-accent-deep"
            >
              {link.label}
            </a>
          ))}
        </div>

        <Link to="/login" className="cta-pill text-sm sm:text-base">
          Sign in
          <ArrowUpRight />
        </Link>
      </nav>
    </header>
  );
}

function ArrowUpRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17 17 7M8.5 7H17v8.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------ stickers --- */

/**
 * Chromia's stickers are wobbly outlined blobs sitting at an angle. These are
 * drawn rather than borrowed — the shape language is the reference, the
 * artwork is ours.
 */
function Sticker({ children, fill, rotate = -8, className = '', out, progress = 0, delay = 0 }) {
  // Three phases, because the entrance and the scroll want different speeds.
  // 'out' holds the block off-stage with no transition at all, so nothing
  // animates before the page is ready. 'arriving' carries it in slowly. Once
  // it has landed the transition shortens, so scrolling still feels attached
  // to the finger rather than dragging a long ease behind it.
  const [phase, setPhase] = useState('out');
  // Held off-stage until the opening loader lifts, so the entrance is seen.
  const introDone = useIntroDone();

  useEffect(() => {
    if (!introDone) return;
    const START = 260;
    const GLIDE = 1700;
    const enter = setTimeout(() => setPhase('arriving'), START + delay);
    const settle = setTimeout(() => setPhase('settled'), START + delay + GLIDE);
    return () => {
      clearTimeout(enter);
      clearTimeout(settle);
    };
  }, [delay, introDone]);

  const travel = phase === 'out' ? 1 : progress;
  const [ox, oy] = out;

  const transition =
    phase === 'out'
      ? 'none'
      : phase === 'arriving'
        ? 'transform 1.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.5s cubic-bezier(0.16, 1, 0.3, 1)'
        : 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease-out';

  return (
    <span
      className={`pointer-events-none absolute select-none ${className}`}
      style={{
        transform: `translate3d(${ox * travel}px, ${oy * travel}px, 0) rotate(${
          rotate + travel * rotate * 0.9
        }deg) scale(${1 - travel * 0.18})`,
        opacity: 1 - travel * 0.95,
        transition,
        willChange: 'transform, opacity',
      }}
      aria-hidden="true"
    >
      <span
        className={`inline-block rounded-[1.25rem] border-[3px] border-noir ${fill} px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-noir shadow-[4px_5px_0_0_rgba(31,26,35,1)]`}
      >
        {children}
      </span>
    </span>
  );
}

/* --------------------------------------------------------------- hero ---- */

function Hero() {
  const raw = useScrollProgress();
  const reduced = usePrefersReducedMotion();
  const progress = reduced ? 0 : raw;

  // The centre column fades and drifts up as the hero leaves, and comes back
  // on the way down — the same value drives both directions, so it is
  // reversible rather than a one-shot animation.
  const textStyle = {
    opacity: 1 - progress * 1.15,
    transform: `translate3d(0, ${-progress * 60}px, 0)`,
    transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease-out',
  };

  return (
    <Section
      bg="base"
      className="relative flex min-h-[100dvh] items-center justify-center px-5 pb-24 pt-28 text-center"
    >
      {/* Three blocks, each with its own exit vector: two to the sides, one
          down and out. They leave on the way up and return on the way down. */}
      <Sticker
        fill="bg-chromia-green-500"
        rotate={-11}
        out={[-260, -90]}
        progress={progress}
        delay={0}
        className="left-[6%] top-[26%] hidden lg:block"
      >
        invisible
      </Sticker>
      <Sticker
        fill="bg-chromia-yellow-500"
        rotate={9}
        out={[280, -70]}
        progress={progress}
        delay={220}
        className="right-[7%] top-[32%] hidden lg:block"
      >
        per recipient
      </Sticker>
      <Sticker
        fill="bg-chromia-pink-500"
        rotate={7}
        out={[-230, 140]}
        progress={progress}
        delay={440}
        className="bottom-[20%] left-[12%] hidden xl:block"
      >
        survives a photo
      </Sticker>

      <div className="mx-auto max-w-5xl" style={textStyle}>
        <h1 className="hero-fade-up font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.98]">
          <span className="block text-ink">Every copy knows</span>
          <span className="tone-accent block">who opened it.</span>
        </h1>

        <p className="hero-fade-up hero-fade-up--d1 mt-9 text-lg font-semibold text-ink sm:text-xl">
          Know exactly where a leak came from.
        </p>
        <p className="hero-fade-up hero-fade-up--d2 mx-auto mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-muted sm:text-base">
          Every copy you release carries a quiet mark that belongs to the person who opened it. If
          that copy ever turns up somewhere it should not be, you can follow it back — even from a
          photograph of a screen.
        </p>

        <div className="hero-fade-up hero-fade-up--d3 mt-11 flex flex-wrap items-center justify-center gap-3">
          <Link to="/login" className="cta-pill px-7 py-3.5 text-base">
            Open the register
            <ArrowUpRight />
          </Link>
          <a
            href="#release"
            className="inline-flex items-center gap-2 rounded-full border-2 border-noir bg-canvas px-6 py-3.5 text-base font-semibold text-ink transition hover:bg-muted"
          >
            How it works
          </a>
        </div>
      </div>
    </Section>
  );
}

/* ----------------------------------------------------- release (purple) -- */

function ReleaseSection() {
  return (
    <Section
      bg="accent"
      id="release"
      className="flex min-h-[100dvh] items-center justify-center px-5 py-28 text-center"
    >
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <TwoToneHeading first="The receipt exists" second="before the copy does." onAccent />
          <p className="mx-auto mt-6 max-w-[56ch] text-[15px] font-medium leading-relaxed text-noir/75 sm:text-base">
            Order matters more than speed. The chain write happens first, so there is no window in
            which a marked file exists without a record of who it was made for.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-5 text-left lg:grid-cols-3">
          {RELEASE_STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 160}>
              <article
                className={`chip-card h-full border-[3px] border-noir ${step.fill} shadow-[6px_7px_0_0_rgba(31,26,35,1)]`}
              >
                <span className="mono text-xs font-bold">{step.n}</span>
                <h3 className="font-display-sm mt-2 text-[26px] leading-tight">{step.title}</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-noir/75">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- closing (dark) -- */

function ClosingSection() {
  return (
    <Section
      bg="dark"
      id="roles"
      className="relative flex min-h-[100dvh] items-center justify-center px-5 py-28 text-center"
    >
      <div className="dot-field absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-3xl">
        <Reveal>
          <TwoToneHeading first="Three roles," second="on purpose." onDark />
          <p className="mx-auto mt-6 max-w-[50ch] text-[15px] leading-relaxed text-canvas/65">
            Nobody holds two halves by accident. The clearances are separated so that the person who
            can release a copy is never the person who investigates where it went — and the analyst
            who examines the evidence cannot decrypt anything to create it.
          </p>
        </Reveal>

        <div className="mt-12 space-y-4 text-left">
          {ROLE_CHIPS.map((role, i) => (
            <Reveal key={role.label} delay={i * 140}>
              <div
                className={`chip-card border-[3px] border-noir ${role.fill} shadow-[6px_7px_0_0_rgba(255,248,248,0.18)]`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display-sm text-xl">{role.label}</span>
                  <span className="chip-knob">
                    <ArrowUpRight size={13} />
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-noir/75">{role.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-canvas px-7 py-3.5 text-base font-semibold text-noir transition hover:bg-muted"
          >
            Sign in
            <ArrowUpRight />
          </Link>
        </div>

        <p className="mt-16 text-xs text-canvas/35">Provenance · Decryption provenance register</p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ mechanics -- */

/** Two centred lines, the second carrying the accent. */
function TwoToneHeading({ first, second, onDark = false, onAccent = false }) {
  const firstTone = onDark ? 'text-canvas' : 'text-noir';
  const secondTone = onDark ? 'text-accent' : onAccent ? 'text-canvas' : 'tone-accent';
  return (
    <h2 className="font-display text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.02]">
      <span className={`block ${firstTone}`}>{first}</span>
      <span className={`block ${secondTone}`}>{second}</span>
    </h2>
  );
}

/**
 * How far the hero has been scrolled, 0 at rest and 1 once it has left.
 *
 * Read from a rAF-throttled scroll listener and applied only to `transform`
 * and `opacity`, so the whole effect stays on the compositor and the page
 * does not lay out again on every frame.
 */
function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const span = window.innerHeight * 0.85;
      setProgress(Math.min(1, Math.max(0, window.scrollY / span)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return progress;
}

/** Honour a reduced-motion preference by pinning everything at rest. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
}

function useSectionBackground() {
  useEffect(() => {
    const root = document.documentElement;
    const sections = [...document.querySelectorAll('[data-bg]')];
    if (!sections.length) return undefined;

    let frame = 0;

    // An IntersectionObserver delivers several entries at once on a fast scroll
    // and the last one wins, which is not necessarily the section being read.
    // Asking which section covers the middle of the viewport is unambiguous.
    const pick = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      let chosen = sections[0];
      for (const section of sections) {
        const { top, bottom } = section.getBoundingClientRect();
        if (top <= mid && bottom >= mid) {
          chosen = section;
          break;
        }
        if (top <= mid) chosen = section;
      }
      const next = chosen.dataset.bg;
      if (root.dataset.homeBackground !== next) root.dataset.homeBackground = next;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };

    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      // Hand the page back, or the app shell inherits a transparent body.
      delete root.dataset.homeBackground;
    };
  }, []);
}

function Section({ bg, children, className = '', id }) {
  return (
    <section id={id} data-bg={bg} className={className}>
      {children}
    </section>
  );
}

/** Fades its children up the first time they are scrolled into view. */
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
