/**
 * BK-tree over 64-bit perceptual hashes, Hamming metric. Owner: B.
 *
 * Why not pgvector or a brute-force scan? A BK-tree is ~40 lines, needs no
 * extension install, and prunes by the triangle inequality: for a query q and
 * a node n, any child at edge-distance d can only hold matches within
 * [d - maxDist, d + maxDist]. Everything else is skipped without comparing.
 * 10k files searched in well under a second, rebuilt from Postgres on boot.
 *
 * We keep three trees — dHash, pHash, aHash — and OR their results (§5.2).
 * If ANY one hash is within threshold the row stays a candidate. That single
 * choice is what catches screenshot-of-a-screen leaks that pHash alone misses.
 */

/** Hamming distance between two 64-bit hashes held as BigInt. */
export function hamming(a, b) {
  let x = (BigInt(a) ^ BigInt(b)) & 0xffffffffffffffffn;
  let count = 0;
  while (x) {
    x &= x - 1n; // clear the lowest set bit
    count++;
  }
  return count;
}

class BKTree {
  constructor(name = 'tree') {
    this.name = name;
    this.root = null;
    this.size = 0;
  }

  /**
   * @param {bigint} hash  64-bit perceptual hash
   * @param {number} id    DecryptionEvent.id
   */
  insert(hash, id) {
    if (hash === null || hash === undefined) return;
    const h = BigInt(hash);
    const node = { hash: h, ids: [id], children: new Map() };

    if (!this.root) {
      this.root = node;
      this.size = 1;
      return;
    }

    let cur = this.root;
    for (;;) {
      const d = hamming(h, cur.hash);
      if (d === 0) {
        // Same hash, different event (e.g. two officers, identical source file).
        if (!cur.ids.includes(id)) cur.ids.push(id);
        this.size++;
        return;
      }
      const child = cur.children.get(d);
      if (!child) {
        cur.children.set(d, node);
        this.size++;
        return;
      }
      cur = child;
    }
  }

  /**
   * @param {bigint} hash    query hash
   * @param {number} maxDist inclusive Hamming radius (0..64)
   * @returns {Array<{id:number, dist:number}>} sorted nearest first
   */
  search(hash, maxDist = 12) {
    if (!this.root || hash === null || hash === undefined) return [];
    const q = BigInt(hash);
    const out = [];
    const stack = [this.root];
    let visited = 0;

    while (stack.length) {
      const node = stack.pop();
      visited++;
      const d = hamming(q, node.hash);
      if (d <= maxDist) {
        for (const id of node.ids) out.push({ id, dist: d });
      }
      // Triangle inequality: only these edge distances can contain a match.
      const lo = d - maxDist;
      const hi = d + maxDist;
      for (const [edge, child] of node.children) {
        if (edge >= lo && edge <= hi) stack.push(child);
      }
    }

    this.lastVisited = visited;
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  clear() {
    this.root = null;
    this.size = 0;
  }
}

/**
 * The three live indexes. Built once at boot, kept hot by /api/decrypt
 * inserting into them immediately after each DB write (step 12).
 */
export const trees = {
  dHash: new BKTree('dHash'),
  pHash: new BKTree('pHash'),
  aHash: new BKTree('aHash'),
};

let ready = false;
export const isReady = () => ready;

/** Rebuild every tree from PostgreSQL. Called on server boot. */
export async function rebuild(prisma, log = console.log) {
  const started = Date.now();
  trees.dHash.clear();
  trees.pHash.clear();
  trees.aHash.clear();

  const events = await prisma.decryptionEvent.findMany({
    select: { id: true, pHash: true, dHash: true, aHash: true },
  });

  for (const e of events) {
    if (e.dHash !== null) trees.dHash.insert(e.dHash, e.id);
    if (e.pHash !== null) trees.pHash.insert(e.pHash, e.id);
    if (e.aHash !== null) trees.aHash.insert(e.aHash, e.id);
  }

  ready = true;
  log(
    `[bktree] indexed ${events.length} events ` +
      `(d=${trees.dHash.size} p=${trees.pHash.size} a=${trees.aHash.size}) ` +
      `in ${Date.now() - started}ms`
  );
  return events.length;
}

/** Keep the index hot — called right after every DecryptionEvent insert. */
export function insert({ id, pHash, dHash, aHash }) {
  if (dHash !== null && dHash !== undefined) trees.dHash.insert(dHash, id);
  if (pHash !== null && pHash !== undefined) trees.pHash.insert(pHash, id);
  if (aHash !== null && aHash !== undefined) trees.aHash.insert(aHash, id);
}

/**
 * OR-vote across all three hashes (§5.2). A row survives if ANY hash is close.
 *
 * @returns {{ candidates: Array<{id:number, dHashDist:number|null,
 *             pHashDist:number|null, aHashDist:number|null, best:number}>,
 *            checked: number }}
 */
export function searchAll({ pHash, dHash, aHash }, maxDist = 12) {
  const merged = new Map();

  const absorb = (results, key) => {
    for (const { id, dist } of results) {
      const row = merged.get(id) || {
        id,
        dHashDist: null,
        pHashDist: null,
        aHashDist: null,
        best: 64,
      };
      row[key] = dist;
      row.best = Math.min(row.best, dist);
      merged.set(id, row);
    }
  };

  absorb(trees.dHash.search(dHash, maxDist), 'dHashDist');
  absorb(trees.pHash.search(pHash, maxDist), 'pHashDist');
  absorb(trees.aHash.search(aHash, maxDist), 'aHashDist');

  const candidates = [...merged.values()].sort((a, b) => a.best - b.best);
  const checked =
    (trees.dHash.lastVisited || 0) +
    (trees.pHash.lastVisited || 0) +
    (trees.aHash.lastVisited || 0);

  return { candidates, checked };
}

export function stats() {
  return {
    ready,
    dHash: trees.dHash.size,
    pHash: trees.pHash.size,
    aHash: trees.aHash.size,
  };
}

export { BKTree };
