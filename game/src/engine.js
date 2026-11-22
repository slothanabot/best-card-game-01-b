// Tavern Tricks — the rules, with no drawing and no browser in them.
// Four players, a standard 52-card deck, 13 cards each. Every round:
//   1. deal, 2. everyone bids how many tricks they will take (0-13),
//   3. the highest bidder names the trump suit,
//   4. thirteen tricks: follow suit if you can; the highest trump wins the
//      trick, otherwise the highest card of the suit led; the winner leads.
// Scoring per round: making your bid pays 10 per bid trick plus 1 per trick
// taken; missing it costs 10 per bid trick. Five rounds, highest total wins.
//
// The state is plain data so the screenshot stager can fast-forward whole
// games through it and the renderer can paint any moment of it.
import { freshDeck, sortHand, sameCard } from './cards.js';
import { shuffleInPlace } from './random.js';

export const PLAYER_NAMES = ['You', 'Bram', 'Cora', 'Dain'];
export const ROUNDS_PER_GAME = 5;
export const CARDS_PER_HAND = 13;

/** Score for one round: bid tricks promised, tricks actually taken. */
export function roundScore(bid, tricks) {
  if (tricks >= bid) return bid * 10 + tricks;
  return -bid * 10;
}

export function createEngine(random) {
  const state = {
    round: 0, // 1-based once a game is running
    phase: 'title', // title | bidding | trump | play | roundEnd | gameOver
    dealer: 0,
    hands: [[], [], [], []],
    bids: [null, null, null, null],
    trump: null,
    leader: 0,
    turn: 0,
    currentTrick: [], // { player, card } in play order
    tricksWon: [0, 0, 0, 0],
    trickLog: [], // { winner, cards, leadSuit } newest first, capped
    scores: [0, 0, 0, 0],
    roundScores: [], // per round: [s0, s1, s2, s3]
    message: '',
    lastWinner: null,
  };

  function startGame() {
    state.scores = [0, 0, 0, 0];
    state.roundScores = [];
    state.round = 0;
    state.dealer = Math.floor(random() * 4);
    nextRound();
  }

  function nextRound() {
    state.round += 1;
    const deck = shuffleInPlace(freshDeck(), random);
    state.hands = [[], [], [], []];
    for (let i = 0; i < 52; i += 1) state.hands[i % 4].push(deck[i]);
    state.hands = state.hands.map(sortHand);
    state.bids = [null, null, null, null];
    state.trump = null;
    state.tricksWon = [0, 0, 0, 0];
    state.currentTrick = [];
    state.trickLog = [];
    state.leader = (state.dealer + 1) % 4;
    state.turn = state.leader;
    state.dealer = (state.dealer + 1) % 4;
    state.phase = 'bidding';
    state.message = `Round ${state.round} — place your bids.`;
  }

  /** Legal bids for a player: any number of tricks from 0 to 13. */
  function legalBids() {
    const out = [];
    for (let bid = 0; bid <= CARDS_PER_HAND; bid += 1) out.push(bid);
    return out;
  }

  function placeBid(player, bid) {
    if (state.phase !== 'bidding') return false;
    if (state.turn !== player) return false;
    if (!Number.isInteger(bid) || bid < 0 || bid > CARDS_PER_HAND) return false;
    state.bids[player] = bid;
    state.turn = (state.turn + 1) % 4;
    if (state.bids.every((b) => b !== null)) {
      // Highest bid names trump; ties go to the earliest bidder.
      let best = 0;
      for (let i = 1; i < 4; i += 1) {
        if (state.bids[i] > state.bids[best]) best = i;
      }
      state.trumpBidder = best;
      state.phase = 'trump';
      state.turn = best;
      state.message = `${PLAYER_NAMES[best]} won the bid with ${state.bids[best]} and names trump.`;
    }
    return true;
  }

  function chooseTrump(player, suit) {
    if (state.phase !== 'trump' || state.turn !== player) return false;
    state.trump = suit;
    state.phase = 'play';
    state.turn = state.leader;
    state.message = `Trump is ${suit}. ${PLAYER_NAMES[state.leader]} leads.`;
    return true;
  }

  /** Cards this player may legally play right now. */
  function legalPlays(player) {
    const hand = state.hands[player];
    if (state.phase !== 'play' || state.turn !== player) return [];
    if (state.currentTrick.length === 0) return [...hand];
    const leadSuit = state.currentTrick[0].card.suit;
    const follow = hand.filter((c) => c.suit === leadSuit);
    return follow.length > 0 ? follow : [...hand];
  }

  function trickWinner(trick, trump) {
    const leadSuit = trick[0].card.suit;
    let best = trick[0];
    for (const play of trick) {
      const card = play.card;
      const bestCard = best.card;
      const cardTrump = card.suit === trump;
      const bestTrump = bestCard.suit === trump;
      if (cardTrump && !bestTrump) { best = play; continue; }
      if (!cardTrump && bestTrump) continue;
      if (card.suit === bestCard.suit && card.rank > bestCard.rank) best = play;
      else if (card.suit === leadSuit && bestCard.suit !== trump && bestCard.suit !== leadSuit) best = play;
    }
    return best.player;
  }

  function playCard(player, card) {
    if (state.phase !== 'play' || state.turn !== player) return false;
    const legal = legalPlays(player);
    if (!legal.some((c) => sameCard(c, card))) return false;
    const hand = state.hands[player];
    const index = hand.findIndex((c) => sameCard(c, card));
    hand.splice(index, 1);
    state.currentTrick.push({ player, card });
    if (state.currentTrick.length === 4) {
      const winner = trickWinner(state.currentTrick, state.trump);
      state.tricksWon[winner] += 1;
      state.lastWinner = winner;
      state.trickLog.unshift({
        winner,
        cards: state.currentTrick.map((p) => ({ player: p.player, card: p.card })),
        leadSuit: state.currentTrick[0].card.suit,
      });
      if (state.trickLog.length > 6) state.trickLog.length = 6;
      state.currentTrick = [];
      state.leader = winner;
      state.turn = winner;
      state.message = `${PLAYER_NAMES[winner]} takes the trick.`;
      if (state.hands.every((h) => h.length === 0)) finishRound();
    } else {
      state.turn = (state.turn + 1) % 4;
    }
    return true;
  }

  function finishRound() {
    const scores = state.bids.map((bid, i) => roundScore(bid, state.tricksWon[i]));
    state.roundScores.push(scores);
    state.scores = state.scores.map((s, i) => s + scores[i]);
    if (state.round >= ROUNDS_PER_GAME) {
      state.phase = 'gameOver';
      const best = Math.max(...state.scores);
      const winners = state.scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
      state.message = winners.length === 1
        ? `${PLAYER_NAMES[winners[0]]} wins the night!`
        : 'A tie at the top of the table!';
    } else {
      state.phase = 'roundEnd';
      state.message = `Round ${state.round} done — ${PLAYER_NAMES[state.scores.indexOf(Math.max(...state.scores))]} leads.`;
    }
  }

  function continueGame() {
    if (state.phase === 'roundEnd') nextRound();
    else if (state.phase === 'gameOver') startGame();
  }

  return {
    state,
    startGame,
    nextRound,
    legalBids,
    placeBid,
    chooseTrump,
    legalPlays,
    playCard,
    continueGame,
    roundScore,
  };
}
