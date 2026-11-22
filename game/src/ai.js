// The three tavern regulars (and the autopilot that can play your seat).
// Bidding: count likely winners — aces, high trumps once a suit is long —
// then shade the bid a little with the seeded random so no two games bid
// alike. Play: follow suit with the cheapest card that still wins the
// trick when it is worth winning, otherwise shed the cheapest loser; lead
// from the longest suit, high when holding the ace, low otherwise.
import { SUITS } from './cards.js';

function countSuit(hand, suit) {
  return hand.filter((c) => c.suit === suit).length;
}

function longestSuit(hand) {
  let best = SUITS[0].id;
  for (const suit of SUITS) {
    if (countSuit(hand, suit.id) > countSuit(hand, best)) best = suit.id;
  }
  return best;
}

/** How many tricks this hand looks good for, before trump is known. */
export function estimateTricks(hand, random) {
  let estimate = 0;
  for (const card of hand) {
    if (card.rank === 14) estimate += 1;
    else if (card.rank === 13) estimate += 0.6;
    else if (card.rank === 12) estimate += 0.3;
  }
  const longest = longestSuit(hand);
  estimate += Math.max(0, countSuit(hand, longest) - 4) * 0.5;
  estimate += random() * 1.2 - 0.6;
  return Math.max(0, Math.min(13, Math.round(estimate)));
}

export function chooseBid(hand, random) {
  return estimateTricks(hand, random);
}

/** Pick the trump suit: the longest suit, breaking ties toward high cards. */
export function chooseTrumpSuit(hand) {
  let best = SUITS[0].id;
  let bestScore = -1;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit.id);
    const score = cards.length * 2 + cards.reduce((sum, c) => sum + (c.rank >= 12 ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = suit.id; }
  }
  return best;
}

function beats(card, current, leadSuit, trump) {
  const cardTrump = card.suit === trump;
  const curTrump = current.suit === trump;
  if (cardTrump && !curTrump) return true;
  if (!cardTrump && curTrump) return false;
  if (card.suit === current.suit) return card.rank > current.rank;
  if (card.suit === leadSuit && current.suit !== leadSuit) return true;
  return false;
}

function currentBest(trick, trump) {
  const leadSuit = trick[0].card.suit;
  let best = trick[0].card;
  for (const play of trick.slice(1)) {
    if (beats(play.card, best, leadSuit, trump)) best = play.card;
  }
  return best;
}

/** Choose a card from the legal plays for this seat. */
export function chooseCard(hand, legal, trick, trump, random) {
  const sorted = [...legal].sort((a, b) => a.rank - b.rank);
  if (trick.length === 0) {
    // Leading: open with the ace of the longest suit, else a low card.
    const longest = longestSuit(hand);
    const aces = sorted.filter((c) => c.rank === 14 && c.suit === longest);
    if (aces.length > 0) return aces[aces.length - 1];
    const lows = sorted.filter((c) => c.rank <= 10);
    if (lows.length > 0 && random() < 0.7) return lows[0];
    return sorted[sorted.length - 1];
  }
  const leadSuit = trick[0].card.suit;
  const best = currentBest(trick, trump);
  const winners = sorted.filter((c) => beats(c, best, leadSuit, trump));
  const partnerWinning = trick.some(
    (p) => p.player === (trick[0].player + 2) % 4 && p.card.suit === best.suit && p.card.rank === best.rank,
  );
  if (winners.length > 0 && !partnerWinning) {
    // Win it as cheaply as possible; sometimes duck with a low card instead.
    if (random() < 0.85) return winners[0];
  }
  // Shed the cheapest card that cannot win, preferring a non-trump loser.
  const losers = sorted.filter((c) => c.suit !== trump);
  return (losers.length > 0 ? losers : sorted)[0];
}
