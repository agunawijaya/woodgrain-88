/**
 * Fence globs: the small slice of glob syntax that work orders use to say which
 * paths the crew may write. Paths are repo-relative with forward slashes.
 *
 *   **   any number of whole path segments (including none)
 *   *    anything inside one segment
 *   ?    one character inside one segment
 *   {a,b} either alternative
 */

const REGEX_SPECIALS = new Set([...'.+^$()|[]\\']);

export function globToRegExp(glob) {
  let pattern = '';
  let insideBraces = false;
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      const followedBySlash = glob[i + 2] === '/';
      const atSegmentStart = i === 0 || glob[i - 1] === '/';
      if (atSegmentStart && followedBySlash) {
        pattern += '(?:.*/)?';
        i += 2;
      } else {
        pattern += '.*';
        i += 1;
      }
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if (char === '?') {
      pattern += '[^/]';
    } else if (char === '{') {
      insideBraces = true;
      pattern += '(?:';
    } else if (char === '}' && insideBraces) {
      insideBraces = false;
      pattern += ')';
    } else if (char === ',' && insideBraces) {
      pattern += '|';
    } else {
      pattern += REGEX_SPECIALS.has(char) ? `\\${char}` : char;
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesAny(path, globs) {
  return globs.some((glob) => globToRegExp(glob).test(path));
}

/** The leading part of a glob that contains no wildcard, cut at a segment boundary. */
export function literalPrefix(glob) {
  const firstWildcard = glob.search(/[*?{]/);
  if (firstWildcard === -1) return glob;
  const head = glob.slice(0, firstWildcard);
  const lastSlash = head.lastIndexOf('/');
  return lastSlash === -1 ? '' : head.slice(0, lastSlash + 1);
}

function isPathPrefix(prefix, path) {
  if (prefix === '') return true;
  if (prefix.endsWith('/')) return path.startsWith(prefix);
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Whether two fences could touch the same file. Deliberately conservative:
 * comparing literal prefixes may report an overlap that the full globs would
 * rule out, never the other way round.
 */
export function fencesOverlap(fenceA, fenceB) {
  return fenceA.some((a) =>
    fenceB.some((b) => {
      const prefixA = literalPrefix(a);
      const prefixB = literalPrefix(b);
      const aIsExact = prefixA === a;
      const bIsExact = prefixB === b;
      if (aIsExact && bIsExact) return a === b;
      if (aIsExact) return globToRegExp(b).test(a);
      if (bIsExact) return globToRegExp(a).test(b);
      return isPathPrefix(prefixA, prefixB) || isPathPrefix(prefixB, prefixA);
    }),
  );
}
