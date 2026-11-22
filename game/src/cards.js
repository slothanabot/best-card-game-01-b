// One standard 52-card deck and the small helpers the engine and the
// renderer share. A card is { suit, rank } with rank 2..14 (11 J, 12 Q, 13 K,
// 14 A). Suits carry their glyph, colour and a short name for labels.
export const SUITS = [
  { id: 'spades', glyph: '♠', colour: 'black', name: 'Spades' },
  { id: 'hearts', glyph: '♥', colour: 'red', name: 'Hearts' },
  { id: 'diamonds', glyph: '♦', colour: 'red', name: 'Diamonds' },
  { id: 'clubs', glyph: '♣', colour: 'black', name: 'Clubs' },
];

export const SUIT_BY_ID = Object.fromEntries(SUITS.map((s) => [s.id, s]));

export const RANK_LABEL = {
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export function rankLabel(rank) {
  return RANK_LABEL[rank] ?? String(rank);
}

export function cardLabel(card) {
  return `${rankLabel(card.rank)}${SUIT_BY_ID[card.suit].glyph}`;
}

export function cardId(card) {
  return `${card.suit}-${card.rank}`;
}

export function sameCard(a, b) {
  return a.suit === b.suit && a.rank === b.rank;
}

/** A fresh ordered deck, highest card first within each suit. */
export function freshDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 14; rank >= 2; rank -= 1) deck.push({ suit: suit.id, rank });
  }
  return deck;
}

/** Sort a hand the way players expect: suit groups, high cards first. */
export function sortHand(hand) {
  const order = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  return [...hand].sort((a, b) => order[a.suit] - order[b.suit] || b.rank - a.rank);
}
