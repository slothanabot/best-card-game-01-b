// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh game with the seeded random and the AI driving
// every seat, so the frame is what a real game looks like and the same seed
// always gives the same frame.
import { createEngine } from './engine.js';
import { chooseBid, chooseCard, chooseTrumpSuit } from './ai.js';

const START_TRICKS = 0;
const PLAY_TRICKS = 5;
const MAX_STEPS = 20000;

/** Drive the engine until `stop` says enough, AI on every seat. */
function autoplay(engine, random, stop) {
  const state = engine.state;
  let steps = 0;
  while (steps < MAX_STEPS) {
    steps += 1;
    if (stop(state)) return;
    if (state.phase === 'bidding') {
      engine.placeBid(state.turn, chooseBid(state.hands[state.turn], random));
    } else if (state.phase === 'trump') {
      engine.chooseTrump(state.turn, chooseTrumpSuit(state.hands[state.turn]));
    } else if (state.phase === 'play') {
      const legal = engine.legalPlays(state.turn);
      if (legal.length === 0) return;
      engine.playCard(state.turn, chooseCard(state.hands[state.turn], legal, state.currentTrick, state.trump, random));
    } else if (state.phase === 'roundEnd') {
      engine.continueGame();
    } else {
      return;
    }
  }
}

function tricksPlayed(state) {
  return state.tricksWon.reduce((a, b) => a + b, 0);
}

/**
 * Set `engine` to the named scene (start, play or end; any other name is
 * start) and return the screen the renderer should paint over it.
 */
export function stageShot(name, engine, random) {
  engine.startGame();
  const state = engine.state;
  if (name === 'play') {
    autoplay(engine, random, (s) => s.phase === 'play' && tricksPlayed(s) >= PLAY_TRICKS && s.currentTrick.length >= 2);
  } else if (name === 'end') {
    autoplay(engine, random, (s) => s.phase === 'gameOver');
  } else {
    autoplay(engine, random, (s) => s.phase === 'bidding');
    // Title over a freshly dealt table: show the title screen, not the bid.
    state.phase = 'title';
  }
  return state.phase;
}
