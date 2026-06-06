export type GrammarSegment = {
  text: string;
  changed: boolean;
};

type Token = {
  text: string;
  key: string;
  space: boolean;
};

type IndexedToken = Token & {
  sourceIndex: number;
};

export function buildGrammarDiff(original: string, corrected: string): GrammarSegment[] {
  const originalWords = indexedContentTokens(tokenize(original));
  const correctedTokens = tokenize(corrected);
  const correctedWords = indexedContentTokens(correctedTokens);
  const matchedCorrected = new Set(lcsPairs(originalWords, correctedWords).map((pair) => pair[1]));

  return correctedTokens.reduce<GrammarSegment[]>((segments, token, index) => {
    const changed = !token.space && !matchedCorrected.has(index);
    const previous = segments[segments.length - 1];
    if (previous && previous.changed === changed) {
      previous.text += token.text;
    } else {
      segments.push({ text: token.text, changed });
    }
    return segments;
  }, []);
}

function tokenize(value: string): Token[] {
  const matches = value.match(/\s+|[\p{L}\p{N}']+|[^\s\p{L}\p{N}]/gu) || [];
  return matches.map((text) => ({
    text,
    key: text.trim().toLowerCase(),
    space: /^\s+$/.test(text),
  }));
}

function indexedContentTokens(tokens: Token[]): IndexedToken[] {
  return tokens
    .map((token, sourceIndex) => ({ ...token, sourceIndex }))
    .filter((token) => !token.space && token.key);
}

function lcsPairs(left: IndexedToken[], right: IndexedToken[]): [number, number][] {
  const table = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));

  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      table[row][column] = left[row].key === right[column].key
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }

  const pairs: [number, number][] = [];
  let row = 0;
  let column = 0;
  while (row < left.length && column < right.length) {
    if (left[row].key === right[column].key) {
      pairs.push([left[row].sourceIndex, right[column].sourceIndex]);
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      row += 1;
    } else {
      column += 1;
    }
  }

  return pairs;
}
