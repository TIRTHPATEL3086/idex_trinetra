import { useEffect, useState } from 'react';

/**
 * Whether the opening loader still covers the page.
 *
 * The loader marks <html> with `is-preloading` from the app's first render and
 * clears it the moment its halves start to part. Entrances on the page behind
 * it wait for that, so they play where they can be seen instead of finishing
 * underneath the loader.
 */
const CLASS = 'is-preloading';

export function useIntroDone() {
  const root = document.documentElement;
  const [done, setDone] = useState(() => !root.classList.contains(CLASS));

  useEffect(() => {
    if (!root.classList.contains(CLASS)) {
      setDone(true);
      return;
    }
    const observer = new MutationObserver(() => {
      if (!root.classList.contains(CLASS)) {
        setDone(true);
        observer.disconnect();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [root]);

  return done;
}
