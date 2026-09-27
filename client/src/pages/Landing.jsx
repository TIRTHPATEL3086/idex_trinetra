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
    label: 'Admin',
    body: 'Full custody — uploads documents, releases copies, runs investigations and keeps the audit trail.',
    fill: 'bg-chromia-pink-500',
  },
  {
    label: 'Officer',
    body: 'Releases a marked copy to themselves and nothing more. Cannot investigate.',
    fill: 'bg-accent-bright',
  },
  {
    label: 'Investigator',
    body: 'Traces leaked files back to their receipt. Cannot decrypt, so cannot manufacture evidence.',
    fill: 'bg-chromia-green-500',
  },
];

export default function Landing() {
  useSectionBackground();

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
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
    body: 'No two people ever hold the same file. Each release carries a mark naming the one person it was made for.',
    dot: 'bg-accent-bright',
  },
  {
    title: 'The mark survives the leak',
    body: 'Invisible to the eye, and still readable after the copy is compressed, cropped, screenshotted or photographed off a screen.',
    dot: 'bg-chromia-green-500',
  },
  {
    title: 'Evidence that holds up',
    body: 'A signed receipt is written to a blockchain before the copy exists, so the record cannot be changed or backdated.',
    dot: 'bg-chromia-pink-500',
  },
];

function AboutSection() {
  return (
    <Section
      bg="base"
      id="about"
      className="flex min-h-[100dvh] items-center overflow-hidden px-5 pb-16 pt-28 sm:pb-20 sm:pt-32"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <Reveal>
            <span className="eyebrow">What Provenance is</span>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.02]">
              <span className="block text-noir">A leak used to be</span>
              <span className="tone-accent block">a dead end.</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-ink-muted sm:text-lg">
              When a protected document turns up where it should not, the first question is who let
              it out — and when everyone received the same file, there is no answer. Provenance
              gives every person their own copy, records each release before it happens, and reads a
              leaked copy back to the one person it was issued to.
            </p>
          </Reveal>

          <div role="list" className="mt-9 space-y-5">
            {PROMISES.map((p, i) => (
              <Reveal key={p.title} delay={220 + i * 140} className="reveal--left">
                <div role="listitem" className="flex gap-4">
                  <span
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border-[2.5px] border-noir ${p.dot} font-display-sm text-sm shadow-[2px_3px_0_0_rgba(31,26,35,1)]`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display-sm text-lg leading-tight text-noir">{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{p.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={200} className="reveal--scale">
          <CopiesIllustration />
        </Reveal>
      </div>
    </Section>
  );
}

/**
 * One document, fanned out into three personal copies — each tagged with the
 * person it was made for — and one of them caught leaking. The fan opens when
 * the section is scrolled to (the parent Reveal adds `is-visible`).
 */
function CopiesIllustration() {
  const copies = [
    { name: 'Officer U-017', mark: '0x3f9a…c21', fill: 'bg-accent-bright', cls: 'copy-fan--a' },
    { name: 'Officer U-023', mark: '0x81d4…07e', fill: 'bg-chromia-green-500', cls: 'copy-fan--b' },
    { name: 'Officer U-041', mark: '0xc6b0…9f3', fill: 'bg-chromia-pink-500', cls: 'copy-fan--c' },
  ];
  return (
    <div aria-hidden="true">
      <div className="relative mx-auto aspect-square w-full max-w-[460px]">
        <div className="dot-field-light absolute inset-6 rounded-[2.5rem]" />

        {copies.map((c) => (
          <div
            key={c.name}
            className={`copy-fan ${c.cls} absolute left-1/2 top-1/2 w-[46%] rounded-2xl border-[3px] border-noir bg-white p-3 shadow-[5px_6px_0_0_rgba(31,26,35,1)]`}
          >
            <div className={`h-2.5 w-2/3 rounded-full ${c.fill}`} />
            <div className="mt-2.5 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-noir/10" />
              <div className="h-1.5 w-5/6 rounded-full bg-noir/10" />
              <div className="h-1.5 w-4/6 rounded-full bg-noir/10" />
            </div>
            <div className="mt-3 rounded-lg bg-noir px-2 py-1.5 text-canvas">
              <div className="text-[10px] font-semibold leading-tight">{c.name}</div>
              <div className="mono text-[9px] leading-tight text-accent">{c.mark}</div>
            </div>
          </div>
        ))}

        {/* the original, locked */}
        <div className="copy-core absolute left-1/2 top-1/2 grid h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[1.75rem] border-[3px] border-noir bg-noir text-canvas shadow-[5px_6px_0_0_rgba(204,145,240,1)]">
          <div className="text-center">
            <LandingIcon name="lock" className="mx-auto h-6 w-6 text-accent" />
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-canvas/70">
              Original
            </div>
          </div>
        </div>
      </div>
      {/* the verdict chip */}
      <div className="copy-verdict relative z-10 mx-auto mt-10 flex w-max items-center sm:mt-2 gap-2 whitespace-nowrap rounded-full border-[2.5px] border-noir bg-chromia-green-500 px-4 py-2 text-xs font-bold text-noir shadow-[3px_4px_0_0_rgba(31,26,35,1)]">
        <span className="h-2 w-2 rounded-full bg-noir" />
        Leak traced to Officer U-023
      </div>
    </div>
  );
}

/* ------------------------------------------- pinned horizontal section --- */

/**
 * A section exactly one screen tall that holds still while its row of cards
 * travels sideways. The page's own vertical scroll drives the row — one pixel
 * down moves it one pixel along — and only once the last card is in place
 * does the page carry on downward. Dragging the cards, dragging or clicking
 * the line, a sideways trackpad swipe and the arrow keys all move the page's
 * scroll, so every input stays in step with every other.
 */
/** Tall enough to pin a row and still fit heading, cards and line. */
const PIN_QUERY = '(min-height: 620px)';

function PinnedRow({ id, bg, onDark = false, header, label, count, marks = false, children }) {
  const sectionRef = useRef(null);
  const rowRef = useRef(null);
  const trackRef = useRef(null);
  const lineRef = useRef(null);
  const drag = useRef(null);
  const [travel, setTravel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [grabbing, setGrabbing] = useState(false);
  // A screen too short to hold heading, cards and line at once (a phone on
  // its side) gets an ordinary section with a row to swipe instead.
  const [pin, setPin] = useState(
    () => typeof window === 'undefined' || window.matchMedia(PIN_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(PIN_QUERY);
    const sync = () => setPin(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // How far the row has to move: its full width less what the window shows.
  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const row = rowRef.current;
      if (track && row) setTravel(Math.max(0, Math.round(track.scrollWidth - row.clientWidth)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, [pin]);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      if (!travel) return setProgress(0);
      if (!pin) return setProgress(Math.min(1, Math.max(0, rowRef.current.scrollLeft / travel)));
      const el = sectionRef.current;
      if (el) setProgress(Math.min(1, Math.max(0, -el.getBoundingClientRect().top / travel)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    const source = pin ? window : rowRef.current;
    source.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      source.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [travel, pin]);

  const sectionTop = () => sectionRef.current.getBoundingClientRect().top + window.scrollY;
  const scrollToProgress = (p, smooth = false) => {
    const at = Math.min(1, Math.max(0, p)) * travel;
    const behavior = smooth ? 'smooth' : 'auto';
    if (pin) window.scrollTo({ top: sectionTop() + at, behavior });
    else rowRef.current.scrollTo({ left: at, behavior });
  };
  const goTo = (i) => scrollToProgress(count > 1 ? i / (count - 1) : 0, true);
  const current = count > 1 ? Math.round(progress * (count - 1)) : 0;

  const lineTo = (clientX) => {
    const r = lineRef.current?.getBoundingClientRect();
    if (!r) return;
    const handle = marks ? 24 : 96;
    scrollToProgress((clientX - r.left - handle / 2) / (r.width - handle));
  };

  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'line') return lineTo(e.clientX);
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 4) d.moved = true;
      if (pin) window.scrollTo({ top: d.y - dx });
      else rowRef.current.scrollLeft = d.y - dx;
    };
    const up = () => {
      drag.current = null;
      setGrabbing(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  // A sideways trackpad swipe moves the row, by moving the page.
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !pin) return undefined;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        window.scrollBy({ top: e.deltaX });
      }
    };
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => row.removeEventListener('wheel', onWheel);
  }, [pin]);

  const onKey = (e) => {
    const map = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: count - 1,
    };
    if (e.key in map) {
      e.preventDefault();
      goTo(Math.min(count - 1, Math.max(0, map[e.key])));
    }
  };

  const lineTone = onDark ? 'bg-canvas/20' : 'bg-noir/15';
  const fillTone = onDark ? 'bg-accent' : 'bg-noir';
  const gutter = 'max(1.25rem, calc(50vw - 36rem))';

  return (
    <section
      ref={sectionRef}
      id={id}
      data-bg={bg}
      className="relative"
      style={pin ? { height: `calc(100dvh + ${travel}px)` } : undefined}
    >
      <div
        className={
          pin
            ? 'sticky top-0 flex h-[100dvh] flex-col overflow-hidden pb-[clamp(1.25rem,4dvh,2.75rem)] pt-[clamp(5.75rem,13dvh,8rem)]'
            : 'relative flex flex-col pb-16 pt-24'
        }
      >
        {onDark && (
          <div className="dot-field pointer-events-none absolute inset-0" aria-hidden="true" />
        )}

        <div className="relative mx-auto w-full max-w-6xl shrink-0 px-5">{header}</div>

        <div
          ref={rowRef}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            drag.current = {
              kind: 'cards',
              x: e.clientX,
              y: pin ? window.scrollY : rowRef.current.scrollLeft,
              moved: false,
            };
            setGrabbing(true);
          }}
          data-free={pin ? undefined : ''}
          className={`group/row relative mt-[clamp(1rem,4dvh,2.5rem)] ${pin ? 'min-h-0 flex-1 overflow-hidden' : 'no-scrollbar overflow-x-auto pb-1'} ${grabbing ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        >
          <div
            ref={trackRef}
            className={`flex w-max gap-4 sm:gap-5 ${pin ? 'h-full will-change-transform' : ''}`}
            style={{
              paddingInline: gutter,
              transform: pin ? `translate3d(${-progress * travel}px,0,0)` : undefined,
            }}
          >
            {children}
          </div>
        </div>

        <div className="relative mx-auto mt-[clamp(1rem,3.5dvh,2rem)] flex w-full max-w-6xl shrink-0 items-center gap-5 px-5">
          <div
            ref={lineRef}
            onPointerDown={(e) => {
              drag.current = { kind: 'line' };
              setGrabbing(true);
              lineTo(e.clientX);
            }}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={1}
            aria-valuemax={count}
            aria-valuenow={current + 1}
            onKeyDown={onKey}
            className="relative h-6 flex-1 cursor-pointer touch-none rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50"
          >
            <span
              className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full ${lineTone}`}
            />
            {marks ? (
              <>
                <span
                  className={`absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full ${fillTone}`}
                  style={{ width: `calc(12px + (100% - 24px) * ${progress})` }}
                />
                {Array.from({ length: count }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      goTo(i);
                    }}
                    className={`absolute top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold transition ${
                      i <= current
                        ? onDark
                          ? 'bg-accent text-noir'
                          : 'bg-noir text-canvas'
                        : onDark
                          ? 'bg-noir-deep text-canvas/60 ring-2 ring-canvas/20'
                          : 'bg-canvas text-ink-muted ring-2 ring-noir/15'
                    }`}
                    style={{
                      left: `calc(12px + (100% - 24px) * ${count > 1 ? i / (count - 1) : 0})`,
                    }}
                  >
                    {i + 1}
                  </span>
                ))}
              </>
            ) : (
              <span
                className={`absolute top-1/2 h-4 w-24 -translate-y-1/2 rounded-full ${fillTone} shadow-[0_2px_8px_rgba(31,26,35,0.25)]`}
                style={{ left: `calc((100% - 6rem) * ${progress})` }}
              />
            )}
          </div>
          <span className={`mono shrink-0 text-sm ${onDark ? 'text-canvas/60' : 'text-ink-muted'}`}>
            <span className={`font-bold ${onDark ? 'text-canvas' : 'text-noir'}`}>
              {String(current + 1).padStart(2, '0')}
            </span>{' '}
            / {String(count).padStart(2, '0')}
          </span>
        </div>
      </div>
    </section>
  );
}

/** A card in a pinned row: a coloured panel that takes the height left over,
 *  with its title and text beneath. */
function RowCard({ panel, panelClass, title, body, onDark }) {
  return (
    <article className="flex h-full max-h-[520px] w-[min(80vw,330px)] shrink-0 select-none flex-col self-center group-data-[free]/row:h-auto">
      <div
        className={`relative min-h-[110px] flex-1 overflow-hidden rounded-[1.75rem] group-data-[free]/row:h-[200px] group-data-[free]/row:flex-none ${panelClass}`}
      >
        {panel}
      </div>
      {/* The same height under every card, so the panels above all line up. */}
      <div data-card-text className="mt-4 h-[9.75rem] shrink-0 sm:h-[9.25rem]">
        <h3
          className={`font-display-sm text-[clamp(1.25rem,2.9dvh,1.625rem)] leading-tight ${onDark ? 'text-canvas' : 'text-noir'}`}
        >
          {title}
        </h3>
        <p
          className={`mt-1.5 text-[13px] leading-relaxed sm:text-sm ${onDark ? 'text-canvas/60' : 'text-ink-muted'}`}
        >
          {body}
        </p>
      </div>
    </article>
  );
}

/* --------------------------------------------- how it works (dark) ------- */

/** The life of one document, from upload to the evidence a court receives. */
const JOURNEY = [
  {
    who: 'Administrator',
    title: 'Upload and lock',
    body: 'The document is encrypted the moment it arrives, and its key is sealed separately for each person cleared to receive it.',
    icon: 'upload',
    fill: 'bg-accent-bright',
  },
  {
    who: 'Officer',
    title: 'Ask for a copy',
    body: 'A cleared officer unlocks their copy with their own passphrase. Nobody can ask for a copy in someone else’s name.',
    icon: 'key',
    fill: 'bg-chromia-pink-500',
  },
  {
    who: 'Automatic',
    title: 'Receipt first',
    body: 'Before the copy is made, a signed receipt — who, what, when, which device — is written to the blockchain.',
    icon: 'chain',
    fill: 'bg-chromia-green-500',
  },
  {
    who: 'Automatic',
    title: 'Invisible mark',
    body: 'The copy is marked with a code pointing to that receipt, plus a fragile layer that breaks wherever the file is edited.',
    icon: 'fingerprint',
    fill: 'bg-chromia-pink-800',
  },
  {
    who: 'Forensic analyst',
    title: 'Trace the leak',
    body: 'When a copy surfaces — a file, a screenshot, a phone photo — the analyst uploads it and the mark is read back to one release.',
    icon: 'search',
    fill: 'bg-chromia-purple-500',
  },
  {
    who: 'Forensic analyst',
    title: 'Court-ready evidence',
    body: 'One click produces a dossier: the person named, the receipt on chain, the signature, and whether the copy was altered.',
    icon: 'dossier',
    fill: 'bg-chromia-green-800',
  },
];

function JourneySection() {
  return (
    <PinnedRow
      id="how-it-works"
      bg="dark"
      onDark
      marks
      label="Steps from upload to evidence"
      count={JOURNEY.length}
      header={
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-canvas/50">
              How it works
            </span>
            <h2 className="mt-2 font-display text-[clamp(2rem,min(5vw,7dvh),4rem)] leading-[0.98]">
              <span className="block text-canvas">From upload</span>
              <span className="block text-accent">to evidence.</span>
            </h2>
          </div>
          <p className="hidden max-w-[36ch] text-sm leading-relaxed text-canvas/60 sm:block">
            Six steps, every one of them recorded. Keep scrolling — or drag the cards or the line —
            to follow a document from upload to evidence.
          </p>
        </div>
      }
    >
      {JOURNEY.map((step, i) => (
        <RowCard
          key={step.title}
          onDark
          title={step.title}
          body={step.body}
          panelClass={`border-[3px] border-noir ${step.fill} text-noir`}
          panel={
            <div className="flex h-full flex-col justify-between p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-noir px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-canvas">
                  {step.who}
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-noir text-canvas">
                  <LandingIcon name={step.icon} className="h-5 w-5" />
                </span>
              </div>
              <span className="font-display text-[clamp(3rem,11dvh,6.5rem)] leading-[0.8] text-noir/85">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
          }
        />
      ))}
    </PinnedRow>
  );
}

/* ------------------------------------------------ features (light) ------ */

const FEATURES = [
  {
    title: 'Invisible watermark',
    body: 'The mark lives in the image’s fine frequency detail, not in anything you can see. A marked copy looks exactly like the original.',
    icon: 'fingerprint',
    fill: 'bg-noir text-accent',
  },
  {
    title: 'Survives real leaks',
    body: 'Still read after JPEG compression, resizing and cropping — and from screenshots and phone photos of a screen.',
    icon: 'camera',
    fill: 'bg-chromia-green-500 text-noir',
  },
  {
    title: 'Shows what was edited',
    body: 'A fragile second layer breaks wherever the copy is changed, so a doctored leak shows exactly which parts were altered.',
    icon: 'edit',
    fill: 'bg-chromia-pink-500 text-noir',
  },
  {
    title: 'Receipts on a blockchain',
    body: 'Every release is recorded on chain before the copy exists. No copy without a receipt, and no receipt that can be rewritten later.',
    icon: 'chain',
    fill: 'bg-accent-bright text-noir',
  },
  {
    title: 'Post-quantum cryptography',
    body: 'Keys sealed with ML-KEM-768 and receipts signed with ML-DSA-65 — the NIST standards built to outlast quantum computers.',
    icon: 'shield',
    fill: 'bg-chromia-purple-800 text-canvas',
  },
  {
    title: 'Works fully offline',
    body: 'Runs air-gapped with its own local chain and database. No cloud key service and no public network is needed.',
    icon: 'offline',
    fill: 'bg-chromia-green-800 text-noir',
  },
];

function FeaturesSection() {
  return (
    <PinnedRow
      id="features"
      bg="base"
      label="What Provenance is built on"
      count={FEATURES.length}
      header={
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <span className="eyebrow">What it is built on</span>
            <h2 className="mt-2 font-display text-[clamp(2rem,min(5vw,7dvh),4rem)] leading-[0.98]">
              <span className="block text-noir">Built for the way</span>
              <span className="tone-accent block">leaks really happen.</span>
            </h2>
          </div>
          <p className="hidden max-w-[36ch] text-sm leading-relaxed text-ink-muted sm:block">
            Six parts working together, so a leak can be traced even after someone has tried to hide
            where it came from.
          </p>
        </div>
      }
    >
      {FEATURES.map((f, i) => (
        <RowCard
          key={f.title}
          title={f.title}
          body={f.body}
          panelClass={`group grid place-items-center ${f.fill}`}
          panel={
            <>
              <span
                aria-hidden="true"
                className="absolute bottom-2 right-5 font-display text-[clamp(2.75rem,8dvh,4.5rem)] leading-none opacity-15"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <LandingIcon
                name={f.icon}
                className="h-[clamp(3rem,9dvh,5rem)] w-[clamp(3rem,9dvh,5rem)] transition duration-500 group-hover:-rotate-6 group-hover:scale-110"
              />
            </>
          }
        />
      ))}
    </PinnedRow>
  );
}

/* ----------------------------------------------------------- icons -------- */

/** Stroke icons for the landing sections, on the app's 24-unit grid. */
function LandingIcon({ name, className = '' }) {
  const s = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const paths = {
    upload: (
      <>
        <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" {...s} />
        <path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" {...s} />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="8" r="4" {...s} />
        <path d="m11 11 8 8M16 16l2-2M18 18l2-2" {...s} />
      </>
    ),
    chain: (
      <>
        <path d="M10 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" {...s} />
        <path d="M14 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" {...s} />
      </>
    ),
    fingerprint: (
      <>
        <path d="M5 12a7 7 0 0 1 14 0" {...s} />
        <path d="M8 12.4a4 4 0 0 1 8 0c0 2.2-.3 4.3-.9 6.3" {...s} />
        <path d="M11 12.6a1 1 0 0 1 2 0c0 3-.5 5.9-1.4 8.6" {...s} />
        <path d="M5.4 16.5c.4 1.4.5 2.6.4 3.9" {...s} />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" {...s} />
        <path d="m20 20-3.5-3.5" {...s} />
      </>
    ),
    dossier: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" {...s} />
        <path d="M14 3v5h5M9 14.5l2 2 4-4" {...s} />
      </>
    ),
    camera: (
      <>
        <path
          d="M4.5 8h2.6l1.6-2.3h6.6L16.9 8h2.6a1.5 1.5 0 0 1 1.5 1.5v8.3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.8V9.5A1.5 1.5 0 0 1 4.5 8Z"
          {...s}
        />
        <circle cx="12" cy="13.4" r="3.4" {...s} />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" {...s} />
        <path d="m13.5 6.5 4 4" {...s} />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4 7v5c0 4.4 3.3 8.5 8 9.5 4.7-1 8-5.1 8-9.5V7l-8-4Z" {...s} />
        <path d="m9 12 2 2 4-4" {...s} />
      </>
    ),
    offline: (
      <>
        <path d="M3 3l18 18" {...s} />
        <path
          d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.2-2.6M19 13a10 10 0 0 0-2.1-1.6"
          {...s}
        />
        <path d="M2 9.5a15 15 0 0 1 4.5-2.8M22 9.5A15 15 0 0 0 11 5.1" {...s} />
        <circle cx="12" cy="19.5" r="0.6" {...s} />
      </>
    ),
    lock: (
      <>
        <rect x="4.8" y="10.5" width="14.4" height="9.7" rx="2.2" {...s} />
        <path d="M8.3 10.5V7.8a3.7 3.7 0 0 1 7.4 0v2.7" {...s} />
      </>
    ),
    check: <path d="m5 12.5 4.5 4.5L19 7.5" {...s} strokeWidth={2.4} />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/* ------------------------------------------------------- closing (dark) -- */

function ClosingSection() {
  return (
    <Section
      bg="dark"
      id="roles"
      className="relative flex items-center justify-center px-5 pb-8 pt-28 text-center sm:pb-10"
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

        <p className="mt-8 text-xs text-canvas/35">Provenance · Decryption provenance register</p>
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

function Section({ bg, children, className = '', id, style }) {
  return (
    <section id={id} data-bg={bg} className={className} style={style}>
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
