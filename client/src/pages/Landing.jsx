import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import Logo from '../components/Logo.jsx';
import { CheckIcon, ExternalLinkIcon, ShieldIcon } from '../components/icons.jsx';

/**
 * The public landing page.
 *
 * Structurally it follows the nomu reference: full-height sections, each one
 * declaring which of three background layers it wants, and a fixed layer stack
 * behind everything that cross-fades between them as you scroll. The page never
 * animates a colour — it sets one attribute on <html> and the layers do the
 * rest on the compositor.
 *
 * The copy is ours and deliberately plain. A system that decides who leaked a
 * classified file should describe itself in sentences a reviewer can check.
 */

const TERMS = [
  'AES-256-GCM',
  'ML-KEM-768',
  'ML-DSA-65',
  '2-level Haar DWT',
  'QIM embedding',
  'BK-tree index',
  'keccak256 refs',
  'pHash · dHash · aHash',
  'Sepolia anchoring',
  'Reed–Solomon ECC',
];

const BANDS = [
  {
    band: 'ATTRIBUTED',
    score: '≥ 0.85',
    meaning: 'Report the match.',
    tone: 'text-attributed-bright',
    dot: 'bg-attributed-bright',
  },
  {
    band: 'PROBABLE',
    score: '0.60 – 0.85',
    meaning: 'A lead, not a conclusion.',
    tone: 'text-probable-bright',
    dot: 'bg-probable-bright',
  },
  {
    band: 'INCONCLUSIVE',
    score: '< 0.60',
    meaning: 'Report that it is not known.',
    tone: 'text-white/55',
    dot: 'bg-white/40',
  },
];

const RELEASE_STEPS = [
  {
    n: '01',
    title: 'Decrypt and hash',
    body: 'The file is opened with AES-256-GCM and the exact bytes released are hashed. That hash, not the stored original, is what the receipt commits to.',
  },
  {
    n: '02',
    title: 'Anchor the receipt',
    body: 'The receipt is written to the chain before any watermark is embedded. If the write fails nothing is released, so a marked copy cannot exist without a receipt.',
  },
  {
    n: '03',
    title: 'Embed and index',
    body: 'A 48-bit payload goes into the HL/LH sub-bands of a 2-level Haar DWT, and the perceptual hashes are indexed for later search.',
  },
];

const HERO_STATS = [
  ['48-bit', 'watermark payload'],
  ['> 40 dB', 'PSNR, imperceptible'],
  ['8 attacks', 'survival measured'],
  ['0 PII', 'ever written on chain'],
];

const TRACE_STEPS = [
  'Hash the leaked file and search the BK-tree index',
  'Extract the watermark and resolve it to a receipt',
  'Verify that receipt on chain, then score the pair',
];

const ON_CHAIN = [
  'receiptId',
  'assetRef',
  'userRef = keccak256(userId ‖ salt)',
  'contentSha',
  'payloadCommit',
];

const IN_POSTGRES = [
  'names, departments, device labels',
  'perceptual hash index',
  'PSNR and delta',
  'encrypted blobs',
  'investigation history',
];

export default function Landing() {
  useSectionBackground();

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      {/* The three layers every section cross-fades between. */}
      <div className="site-background" aria-hidden="true">
        <div className="site-background__layer site-background__base" />
        <div className="site-background__layer site-background__accent" />
        <div className="site-background__layer site-background__dark" />
      </div>

      <TopBar />
      <Hero />
      <Marquee />
      <ReleaseSection />
      <TraceSection />
      <PrivacySection />
      <ClosingSection />
    </div>
  );
}

/* ------------------------------------------------------------- chrome ---- */

function TopBar() {
  return (
    <header className="sticky top-0 z-20 px-4 pt-4 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-ink/10 bg-white/80 px-4 py-2.5 backdrop-blur-md sm:px-5">
        <Logo size="sm" />
        <Link to="/login" className="btn-dark !px-5 !py-2 text-xs sm:text-sm">
          Sign in
        </Link>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- hero ---- */

function Hero() {
  return (
    <Section bg="base" className="pb-20 pt-16 sm:pt-24 lg:pb-28 lg:pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <span className="hero-fade-up eyebrow inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          SIH26237 · Decryption provenance
        </span>

        <h1 className="hero-fade-up hero-fade-up--d1 font-display mt-6 max-w-[16ch] text-[44px] font-extrabold leading-[0.98] tracking-tight text-ink sm:text-[68px] lg:text-[86px]">
          Every copy knows who opened it.
        </h1>

        <p className="hero-fade-up hero-fade-up--d2 mt-6 max-w-[54ch] text-base leading-relaxed text-ink-muted sm:text-lg">
          When a protected file is decrypted, the system writes an immutable receipt to a blockchain
          and embeds an invisible, per-recipient watermark in the copy it hands over. If that copy
          leaks — compressed, cropped, or photographed off a screen — the mark still comes back.
        </p>

        <div className="hero-fade-up hero-fade-up--d3 mt-9 flex flex-wrap items-center gap-3">
          <Link to="/login" className="btn-accent animate-pill-glow !px-7 !py-3 text-[15px]">
            Open the register
          </Link>
          <a href="#release" className="btn-ghost !px-6 !py-3 text-[15px]">
            How it works
          </a>
        </div>

        <dl className="hero-fade-up hero-fade-up--d4 mt-14 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
          {HERO_STATS.map(([value, label]) => (
            <div key={label}>
              <dt className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {value}
              </dt>
              <dd className="mt-1 text-[13px] leading-snug text-ink-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ marquee ---- */

function Marquee() {
  return (
    <Section bg="base" className="py-6">
      <div className="marquee-track relative flex overflow-hidden border-y border-ink/10 py-5 [--gap:3rem]">
        {/* Two identical tracks: the second slides in exactly as the first leaves. */}
        {[0, 1].map((track) => (
          <div
            key={track}
            className="animate-marquee flex shrink-0 items-center gap-[--gap] pr-[--gap]"
            aria-hidden={track === 1}
          >
            {TERMS.map((term) => (
              <span
                key={term}
                className="mono whitespace-nowrap text-[13px] font-medium text-ink-muted"
              >
                {term}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- release (coral) - */

function ReleaseSection() {
  return (
    <Section bg="accent" id="release" className="py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <span className="eyebrow !text-noir/55">Release</span>
          <h2 className="font-display mt-3 max-w-[18ch] text-[34px] font-extrabold leading-[1.02] tracking-tight text-noir sm:text-[52px]">
            The receipt exists before the copy does.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-noir/70 sm:text-base">
            Order matters more than speed here. The chain write happens first, so there is no window
            in which a marked file exists without a record of who it was made for.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {RELEASE_STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <article className="h-full rounded-3xl border border-noir/10 bg-canvas/95 p-6 lg:p-7">
                <span className="mono text-xs font-semibold text-accent-deep">{step.n}</span>
                <h3 className="font-display mt-3 text-xl font-extrabold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------- trace (dark) - */

function TraceSection() {
  return (
    <Section bg="dark" className="py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          <Reveal>
            <span className="eyebrow !text-white/45">Trace</span>
            <h2 className="font-display mt-3 max-w-[16ch] text-[34px] font-extrabold leading-[1.02] tracking-tight text-white sm:text-[52px]">
              Two paths, and they have to agree.
            </h2>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-white/60 sm:text-base">
              The watermark identifies which receipt — exact, but fragile under heavy attack. The
              perceptual hashes identify which file — fuzzy, but they survive a screenshot.
              Agreement earns confidence; disagreement lowers it.
            </p>

            <ul className="mt-9 space-y-3.5">
              {TRACE_STEPS.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-accent">
                    <CheckIcon size={12} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:p-8">
              <div className="eyebrow !text-white/45">The verdict is a band</div>
              <p className="mt-2 text-[13px] leading-relaxed text-white/50">
                Below the threshold the API returns no match at all, so the interface never receives
                a name it is not allowed to show.
              </p>
              <dl className="mt-6 divide-y divide-white/10">
                {BANDS.map((b) => (
                  <div key={b.band} className="flex items-baseline justify-between gap-4 py-4">
                    <dt className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${b.dot}`} />
                      <span className={`mono text-xs font-semibold ${b.tone}`}>{b.band}</span>
                    </dt>
                    <dd className="text-right">
                      <div className="mono text-xs text-white/70">{b.score}</div>
                      <div className="mt-0.5 text-[11px] text-white/45">{b.meaning}</div>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- privacy -- */

function PrivacySection() {
  return (
    <Section bg="base" className="py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <span className="eyebrow">Privacy</span>
          <h2 className="font-display mt-3 max-w-[20ch] text-[34px] font-extrabold leading-[1.02] tracking-tight text-ink sm:text-[52px]">
            No personal data reaches the chain.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-line bg-white p-7">
              <div className="flex items-center gap-2 text-ink">
                <ShieldIcon size={15} />
                <span className="text-sm font-semibold">On chain</span>
              </div>
              <ul className="mono mt-5 space-y-2.5 text-[13px] text-ink-muted">
                {ON_CHAIN.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="h-full rounded-3xl border border-line bg-noir p-7 text-white">
              <span className="text-sm font-semibold">In PostgreSQL, never leaving it</span>
              <ul className="mono mt-5 space-y-2.5 text-[13px] text-white/60">
                {IN_POSTGRES.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- closing -- */

function ClosingSection() {
  return (
    <Section bg="dark" className="py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <Reveal>
          <h2 className="font-display text-[34px] font-extrabold leading-[1.02] tracking-tight text-white sm:text-[52px]">
            Four roles, on purpose.
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[15px] leading-relaxed text-white/60">
            The analyst who examines a leak cannot release a marked copy. The officer who holds
            clearance cannot investigate their own. Nobody holds both halves by accident.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="btn-accent !px-7 !py-3 text-[15px]">
              Sign in
            </Link>
            <a
              href="https://sepolia.etherscan.io/address/0x649c6B7AFd6156Ae87878d85BB4B632E15b66EEF"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-[15px] font-semibold text-white/80 transition hover:border-white/35 hover:text-white"
            >
              View the registry contract
              <ExternalLinkIcon size={14} />
            </a>
          </div>
        </Reveal>

        <p className="mt-16 text-xs text-white/35">
          SIH26237 · Decryption provenance · Node.js, React, PostgreSQL — CPU only
        </p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ mechanics -- */

/**
 * Each section registers which layer it wants. Whichever section covers the
 * middle of the viewport wins, so the change lands when that section is
 * genuinely the one being read rather than when its first pixel appears.
 */
function useSectionBackground() {
  useEffect(() => {
    const root = document.documentElement;
    const sections = [...document.querySelectorAll('[data-bg]')];
    if (!sections.length) return undefined;

    let frame = 0;

    // An IntersectionObserver fires several entries at once on a fast scroll and
    // the last one delivered wins, which is not necessarily the section you are
    // looking at. Asking which section actually covers the middle of the
    // viewport is unambiguous, and it costs one rect read per frame.
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
        // Past the middle already — keep the last one that started above it.
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
