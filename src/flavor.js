const pick = (list, seed) => list[seed % list.length];

const seatRoundTotals = (seat, results) =>
  results.map((r) => {
    const hands = r.hands[seat];
    return hands ? hands.reduce((sum, h) => sum + h.points, 0) : null;
  });

export function decorateStandings(rows, results) {
  const totalsBySeat = {};
  let bestRound = 0;
  rows.forEach((row) => {
    const totals = seatRoundTotals(row.seat, results).filter((v) => v !== null);
    totalsBySeat[row.seat] = totals;
    totals.forEach((v) => {
      if (v > bestRound) bestRound = v;
    });
  });
  return rows.map((row) => {
    const totals = totalsBySeat[row.seat];
    const badges = [];
    if (row.grands > 0 && row.nellos === 0) badges.push({ icon: '😤', title: 'Went grand every single hand. Fearless, reckless, or both.' });
    if (row.nellos > 0 && row.grands === 0) badges.push({ icon: '🐔', title: 'Nello every hand — bawk, bawk. The cards were scary.' });
    if (totals.some((v) => v === 0)) badges.push({ icon: '🍩', title: 'Banked a glorious zero for a whole round. Goose egg.' });
    if (bestRound > 0 && totals.some((v) => v === bestRound)) {
      badges.push({ icon: '🎢', title: 'Biggest single-round haul — strapped in and screamed.' });
    }
    return { ...row, badges };
  });
}

export const BENCH_QUIPS = [
  'Riding the pine',
  'Warming the bench (and maybe a nap)',
  'On a strategic snack break',
  'Supervising, mostly',
  'Resting on past glories',
];
export const benchQuip = (roundNumber) => pick(BENCH_QUIPS, roundNumber - 1);

export function winnerBanner(rows) {
  const top = rows[0];
  const sharedTop = rows.filter((r) => r.rank === 1);
  if (sharedTop.length > 1) {
    return {
      key: 'tie',
      title: 'A dead heat!',
      subtitle: `${sharedTop.map((r) => r.name).join(' & ')} — settle it in the thumb-war pit ⚔️`,
    };
  }
  const runnerUp = rows.find((r) => r.rank !== 1);
  const margin = top.points - (runnerUp ? runnerUp.points : 0);
  if (margin <= 1) return { key: 'whisker', title: `🏆 ${top.name}`, subtitle: '…by a whisker 🐭' };
  if (/&/.test(top.name)) return { key: 'composite', title: `🏆 ${top.name}`, subtitle: 'it took two of you 👯' };
  if (top.nellos === 0 && top.grands > 0) {
    return { key: 'aggressor', title: `🏆 ${top.name}`, subtitle: 'pure aggression, no fear 😤' };
  }
  return { key: 'default', title: `🏆 ${top.name}`, subtitle: `${top.points} points of glory` };
}

export const TIEBREAK_QUIPS = [
  'oldest player graciously concedes',
  'rock-paper-scissors, sudden death',
  'whoever last refilled the snacks wins',
  'a staring contest — no Nello faces',
  'high card; loser does the dishes',
];
export const tiebreakQuip = (seed) => pick(TIEBREAK_QUIPS, seed);

export function kennyRoastCategory({ bids, points }) {
  const grand = [0, 1].filter((i) => bids[i] === 'grand');
  const nello = [0, 1].filter((i) => bids[i] === 'nello');
  if (grand.length === 2 && points[0] + points[1] === 0) return 'big-talk';
  if (grand.some((i) => points[i] === 0)) return 'failed-grand';
  if (nello.length === 2) return 'all-nello';
  if (grand.length === 1 && nello.length === 1) return 'mixed';
  if (grand.length >= 1) return 'lucky-grand';
  return 'meh';
}

export const KENNY_ROASTS = {
  'big-talk': [
    'Two grands, zero points. All hat, no cattle, Kenny.',
    'Kenny declared war twice and surrendered both times. Magnificent.',
    '{partner} is still waiting on the points you promised. Both hands. Wow.',
  ],
  'failed-grand': [
    'Kenny went grand and took {partner} down in flames. Hope the ego was worth it.',
    'Big grand energy, tiny grand results. {partner} sends their regards.',
    'You grand-bid your way to nothing and dragged {partner} along. Iconic.',
  ],
  'all-nello': [
    'Nello, nello — Kenny, the human white flag. Bald-faced cowardice.',
    'Two nellos. Were the cards scary, Kenny? Did they say boo?',
    'Kenny plays it safe like it is a retirement plan. Live a little.',
  ],
  mixed: [
    "One grand, one nello — Kenny can't decide if he's brave or breakfast.",
    'Half courage, half chicken. A true Kenny special.',
  ],
  'lucky-grand': [
    'Kenny granded and it... worked? Even a broken clock, folks.',
    "Don't get cocky, Kenny — we all saw the other rounds.",
  ],
  meh: [
    'Kenny did Kenny things. We are keeping an eye on you.',
    'Suspiciously unremarkable, Kenny. Plotting something?',
  ],
};

export function kennyRoastLine(category, seed, partnerName) {
  const list = KENNY_ROASTS[category] ?? KENNY_ROASTS.meh;
  return pick(list, seed).replaceAll('{partner}', partnerName ?? 'your partner');
}

const isPrime = (n) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};

export const PRIME_ROASTS = [
  'You seriously want to start a tournament with {n} players — a PRIME — and expect no complaints about fair play? Bold move.',
  'Help me with the math: {n} ÷ 7 × 4.2, three rounds over the natural log of a shrug = NO CLEAR WINNER. Primes do not seat.',
  '{n} is prime: indivisible, undefeated by long division, and completely unseatable at three tables. Hard pass.',
  'Ah, {n}. Let me carry the one, divide by the vibes, multiply by the drama... nope. That is a prime, and primes start arguments.',
  'A prime headcount? That is not a tournament, that is a math dare. We respectfully decline {n}.',
  '{n} players means somebody plays {n}-over-4 tables at once, which is a war crime against arithmetic — and prime, to boot.',
];

export const COUNT_ROASTS = [
  '{n}? We run {supported}. What did you expect, miracles? Combine two into one entrant or round up a straggler.',
  '{n} does not seat cleanly at three tables. Land on {supported} — fold two into one entrant, or drag in one more.',
];

export function unsupportedCountMessage(n, supported, seed = n) {
  const bank = isPrime(n) ? PRIME_ROASTS : COUNT_ROASTS;
  return pick(bank, seed).replaceAll('{n}', String(n)).replaceAll('{supported}', supported.join(', '));
}

function findPlayerLatest(entrants, results, name) {
  const player = entrants.find((e) => (e.name ?? '').trim().toLowerCase() === name);
  if (!player) return null;
  for (let i = results.length - 1; i >= 0; i--) {
    const hands = results[i].hands[player.seat];
    if (hands) return { seat: player.seat, roundIndex: i, hands };
  }
  return null;
}

export function kennyContext(entrants, results) {
  const r = findPlayerLatest(entrants, results, 'kenny');
  if (!r) return null;
  return {
    seat: r.seat,
    roundIndex: r.roundIndex,
    bids: r.hands.map((h) => h.bid),
    points: r.hands.map((h) => h.points),
  };
}

export const MERLE_ROASTS = {
  positive: [
    'Even a blind squirrel finds a nut once in a while, Merle.',
    'Merle put up points. Somewhere a broken clock feels seen.',
    'Points for Merle?! Quick, somebody frame the scoreboard.',
    'Merle scored. The cards must have felt sorry for you.',
    'Merle contributed! There truly is a first time for everything.',
  ],
  zero: [
    'Blame the cards, Merle. It is your only out.',
    'A clean zero, Merle. Must have been the cards. Definitely the cards.',
    'Zero again, Merle. At this point it is a lifestyle.',
    'Nothing for Merle — blame the cards, the wind, the tilt of the earth. Anything but you.',
    'An unsurprising goose egg. The surprising part? Ask Merle how he remembers the hand being scored.',
  ],
};

// Pick a Merle line he hasn't been shown yet (non-repeat). Returns null once
// the whole category has been seen — at which point we let him off the hook.
export function nextMerleRoast(points, shown, seed) {
  const bank = points > 0 ? MERLE_ROASTS.positive : MERLE_ROASTS.zero;
  const unseen = bank.filter((line) => !shown.includes(line));
  return unseen.length ? pick(unseen, seed) : null;
}

export function merleContext(entrants, results) {
  const r = findPlayerLatest(entrants, results, 'merle');
  if (!r) return null;
  return {
    seat: r.seat,
    roundIndex: r.roundIndex,
    points: r.hands.reduce((sum, h) => sum + h.points, 0),
  };
}
