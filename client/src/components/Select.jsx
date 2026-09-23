import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * A select whose menu we actually control.
 *
 * A native `<select>` renders its list through the operating system, so the
 * blue highlight and system font in that popup are not reachable from CSS —
 * no amount of styling the closed control changes them. The only way to have
 * the open list match the rest of the interface is to draw it ourselves.
 *
 * Which means re-earning what the native control gave away for free, so this
 * keeps the listbox pattern honestly: roles and `aria-activedescendant` for
 * screen readers, Up/Down/Home/End to move, Enter or Space to choose, Escape
 * to cancel, type-ahead, click-outside to dismiss, and focus returned to the
 * button on close.
 *
 * @param {{value: string, label: string, hint?: string}[]} options
 */
export default function Select({
  options,
  value,
  onChange,
  className = '',
  buttonClassName = '',
  placeholder = 'Select…',
  disabled = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typeAhead = useRef({ text: '', at: 0 });
  const listId = useId();

  const selectedIndex = useMemo(
    () =>
      Math.max(
        0,
        options.findIndex((o) => String(o.value) === String(value))
      ),
    [options, value]
  );
  const selected = options[selectedIndex];

  const close = useCallback(
    (refocus = true) => {
      setOpen(false);
      if (refocus) buttonRef.current?.focus();
    },
    [setOpen]
  );

  const choose = useCallback(
    (index) => {
      const option = options[index];
      if (!option) return;
      onChange(option.value);
      close();
    },
    [options, onChange, close]
  );

  // Open onto the current selection, not the top of the list.
  useEffect(() => {
    if (open) setActive(selectedIndex);
  }, [open, selectedIndex]);

  // Keep the highlighted row in view when moving by keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function onKeyDown(e) {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      default: {
        // Type-ahead: letters typed in quick succession search together.
        if (e.key.length !== 1) return;
        const now = Date.now();
        const text = (now - typeAhead.current.at < 600 ? typeAhead.current.text : '') + e.key;
        typeAhead.current = { text, at: now };
        const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(text.toLowerCase()));
        if (hit >= 0) setActive(hit);
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-white px-3.5 py-2.5 text-left text-sm font-medium text-ink transition
          ${open ? 'border-accent ring-4 ring-accent/20' : 'border-line hover:border-ink-faint'}
          disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
      >
        <span className={`truncate ${selected ? '' : 'text-ink-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onKeyDown}
          className="scroll-slim absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-panel"
        >
          {options.map((option, i) => {
            const isSelected = String(option.value) === String(value);
            const isActive = i === active;
            return (
              <li
                key={option.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                data-active={isActive}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition
                  ${isSelected ? 'bg-accent font-semibold text-noir' : isActive ? 'bg-accent-tint text-ink' : 'text-ink'}`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.hint && (
                  <span
                    className={`mono shrink-0 text-[10px] ${isSelected ? 'text-noir/70' : 'text-ink-faint'}`}
                  >
                    {option.hint}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
