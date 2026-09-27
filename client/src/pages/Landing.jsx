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
 * The hero deliberately names no technology: someone arriving here wants to
 * know what it does for them. The sections below it explain what it is, walk
 * through how a document moves from upload to evidence, then name the parts.
 */

const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
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
    fill: 'bg-accent-bright',
  },
];

const ROLE_CHIPS = [
  {
    label: 'Clearance Holder',
    body: 'Releases a marked copy to themselves and nothing more. Cannot investigate.',
    fill: 'bg-accent-bright',
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
      <AboutSection />
      <JourneySection />
      <ReleaseSection />
      <FeaturesSection />
      <ClosingSection />
    </div>
  );
}

/* ------------------------------------------------------------- navbar ---- */

function NavBar() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white bg-white px-4 py-3 shadow-[0_1px_2px_rgba(31,26,35,0.06),0_14px_34px_-14px_rgba(31,26,35,0.28)] sm:px-6 sm:py-3.5">
        {/* The smallest phones keep the mark and drop the wordmark, as the app
            header does, so the Sign in button is never crowded. */}
        <span className="min-[360px]:hidden">
          <Logo size="sm" iconOnly />
        </span>
        <span className="hidden min-[360px]:block">
          <Logo size="sm" />
        </span>

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

        <Link
          to="/login"
          className="cta-pill shrink-0 whitespace-nowrap px-4 text-sm sm:px-5 sm:text-base"
        >
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
        fill="bg-accent-bright"
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
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-full border-2 border-noir bg-white px-6 py-3.5 text-base font-semibold text-ink transition hover:bg-muted"
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

/* ------------------------------------------------------- about (light) --- */

const PROMISES = [
  {
    title: 'Every copy is personal',
    body: 'No two people ever hold the same file. Each release carries a mark that names the one person it was made for.',
    fill: 'bg-accent-bright',
  },
  {
    title: 'The mark survives the leak',
    body: 'Invisible to the eye, and still readable after the copy is compressed, resized, cropped, screenshotted or photographed off a screen.',
    fill: 'bg-chromia-green-500',
  },
  {
    title: 'Evidence that holds up',
    body: 'A signed receipt is written to a blockchain before the copy exists, so the record of who opened what cannot be changed or backdated.',
    fill: 'bg-chromia-pink-500',
  },
];

function AboutSection() {
  return (
    <Section bg="base" id="about" className="px-5 py-24 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">What Provenance is</span>
            <div className="mt-3">
              <TwoToneHeading first="A leak used to be" second="a dead end." />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-6 max-w-[62ch] text-base leading-relaxed text-ink-muted sm:text-lg">
              When a protected document turns up where it should not, the first question is who let
              it out — and when everyone received the same file, there is no answer. Provenance is a
              register for sensitive documents that gives every person their own copy, records each
              release before it happens, and can read a leaked copy back to the one person it was
              issued to.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PROMISES.map((p, i) => (
            <Reveal key={p.title} delay={i * 140}>
              <article
                className={`chip-card h-full border-[3px] border-noir ${p.fill} shadow-[6px_7px_0_0_rgba(31,26,35,1)]`}
              >
                <h3 className="font-display-sm text-[22px] leading-tight">{p.title}</h3>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-noir/75">{p.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------- how it works (timeline) ----- */

/** The life of one document, from upload to the evidence a court receives. */
const JOURNEY = [
  {
    who: 'Administrator',
    title: 'Upload and lock',
    body: 'The document is encrypted the moment it arrives, and its key is sealed separately for each person cleared to receive it.',
    dot: 'bg-accent-bright',
  },
  {
    who: 'Officer',
    title: 'Ask for a copy',
    body: 'A cleared officer unlocks their copy with their own passphrase. Nobody can ask for a copy in someone else’s name.',
    dot: 'bg-chromia-pink-500',
  },
  {
    who: 'Automatic',
    title: 'Receipt first',
    body: 'Before the copy is made, a signed receipt — who, what, when, which device — is written to the blockchain.',
    dot: 'bg-chromia-green-500',
  },
  {
    who: 'Automatic',
    title: 'Invisible mark',
    body: 'The copy is marked with a code that points to that receipt, plus a fragile layer that breaks wherever the file is edited.',
    dot: 'bg-chromia-pink-800',
  },
  {
    who: 'Forensic analyst',
    title: 'Trace the leak',
    body: 'When a copy surfaces — a file, a screenshot, a phone photo — the analyst uploads it and the mark is read back to one release.',
    dot: 'bg-chromia-purple-500',
  },
  {
    who: 'Forensic analyst',
    title: 'Court-ready evidence',
    body: 'One click produces a dossier: the person named, the receipt on chain, the signature, and whether the copy was altered.',
    dot: 'bg-chromia-green-800',
  },
];

function JourneySection() {
  return (
    <Section bg="base" id="how-it-works" className="px-5 py-24 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">How it works</span>
            <div className="mt-3">
              <TwoToneHeading first="From upload" second="to evidence." />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-5 max-w-[56ch] text-base leading-relaxed text-ink-muted">
              Six steps, and every one of them is recorded. Each card says who carries out that
              step.
            </p>
          </Reveal>
        </div>

        {/* A horizontal track: all six in a row on a wide screen, swiped
            through one card at a time on a phone. */}
        <div className="scroll-slim -mx-5 mt-14 overflow-x-auto px-5 pb-4 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
          <ol className="grid snap-x snap-mandatory auto-cols-[78%] grid-flow-col gap-4 min-[480px]:auto-cols-[46%] md:auto-cols-[31%] lg:auto-cols-fr lg:gap-5">
            {JOURNEY.map((step, i) => (
              <li key={step.title} className="relative flex snap-start">
                <Reveal delay={i * 110} className="flex w-full flex-col">
                  {/* the rail: a dot per step, joined to the next */}
                  <div className="relative flex items-center">
                    <span
                      className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-noir ${step.dot} font-display-sm text-base text-noir shadow-[3px_4px_0_0_rgba(31,26,35,1)]`}
                    >
                      {i + 1}
                    </span>
                    {i < JOURNEY.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-11 right-[-1.25rem] top-1/2 h-[3px] -translate-y-1/2 bg-noir lg:right-[-1.25rem]"
                      />
                    )}
                  </div>

                  <div className="mt-5 flex flex-1 flex-col rounded-[1.5rem] border-[3px] border-noir bg-white p-4 shadow-[5px_6px_0_0_rgba(31,26,35,1)]">
                    <span className="mono text-[11px] font-bold uppercase tracking-wider text-accent-deep">
                      {step.who}
                    </span>
                    <h3 className="font-display-sm mt-1.5 text-[19px] leading-tight text-noir">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-3 text-center text-xs text-ink-faint lg:hidden">
          Swipe to follow the steps →
        </p>
      </div>
    </Section>
  );
}

/* --------------------------------------------------- features (light) ---- */

const FEATURES = [
  {
    title: 'Invisible watermark',
    body: 'The mark sits in the image’s frequency detail, not its pixels you can see. A marked copy looks the same as the original.',
  },
  {
    title: 'Survives real leaks',
    body: 'Read back after JPEG compression, resizing and cropping — and from screenshots and phone photos of a screen, which are straightened first.',
  },
  {
    title: 'Shows what was edited',
    body: 'A second, fragile layer breaks wherever the copy is changed, so a doctored leak shows exactly which parts were altered.',
  },
  {
    title: 'Receipts on a blockchain',
    body: 'Every release is recorded on chain before the copy exists. No copy without a receipt, and no receipt that can be rewritten later.',
  },
  {
    title: 'Post-quantum cryptography',
    body: 'Keys are sealed with ML-KEM-768 and receipts signed with ML-DSA-65 — the NIST standards built to withstand future quantum computers.',
  },
  {
    title: 'Works fully offline',
    body: 'Runs on an air-gapped machine with its own local chain and database. No cloud key service and no public network is needed.',
  },
];

function FeaturesSection() {
  return (
    <Section bg="base" id="features" className="px-5 py-24 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">What it is built on</span>
            <div className="mt-3">
              <TwoToneHeading first="Built for the way" second="leaks really happen." />
            </div>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 120}>
              <article className="h-full rounded-[1.5rem] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(31,26,35,0.05),0_12px_30px_-18px_rgba(31,26,35,0.35)]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/25 font-display-sm text-sm text-accent-deep">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display-sm mt-4 text-[20px] leading-tight text-noir">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
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
function Reveal({ children, delay = 0, className = '' }) {
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
      className={`reveal ${shown ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
