// Boot and the game loop. Input is click or keyboard; after every human move
// the AI seats take their turns on short timers so the table feels alive.
// ?seed=N fixes the deal. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it and sets window.__shotReady
// for a screenshot.
import { createRandom } from './random.js';
import { createEngine } from './engine.js';
import { chooseBid, chooseCard, chooseTrumpSuit } from './ai.js';
import { renderHeader, renderOverlay, renderSide, renderTable } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (window.crypto?.getRandomValues(new Uint32Array(1))[0] ?? 1);
const random = createRandom(seed);

const engine = createEngine(random);
const state = engine.state;
const ui = { selected: null, legalPlays: [], autoplay: false, aiTimer: null };

const hdr = document.getElementById('hdr');
const table = document.getElementById('table');
const side = document.getElementById('side');
const overlayRoot = document.getElementById('overlay-root');
const status = document.getElementById('status');

function announce(message) {
  status.textContent = message;
}

function render() {
  ui.legalPlays = engine.legalPlays(0);
  renderHeader(hdr, state, ui);
  renderTable(table, state, ui);
  renderSide(side, state);
  renderOverlay(overlayRoot, state, ui);
}

function scheduleAi() {
  clearTimeout(ui.aiTimer);
  if (state.phase === 'bidding' && state.turn !== 0) {
    ui.aiTimer = setTimeout(() => {
      engine.placeBid(state.turn, chooseBid(state.hands[state.turn], random));
      afterMove();
    }, 550);
  } else if (state.phase === 'trump' && state.turn !== 0) {
    ui.aiTimer = setTimeout(() => {
      engine.chooseTrump(state.turn, chooseTrumpSuit(state.hands[state.turn]));
      afterMove();
    }, 650);
  } else if (state.phase === 'play' && state.turn !== 0) {
    ui.aiTimer = setTimeout(() => {
      const legal = engine.legalPlays(state.turn);
      if (legal.length > 0) {
        engine.playCard(state.turn, chooseCard(state.hands[state.turn], legal, state.currentTrick, state.trump, random));
      }
      afterMove();
    }, 650);
  } else if (ui.autoplay && state.phase === 'play' && state.turn === 0) {
    ui.aiTimer = setTimeout(() => {
      const legal = engine.legalPlays(0);
      if (legal.length > 0) {
        engine.playCard(0, chooseCard(state.hands[0], legal, state.currentTrick, state.trump, random));
      }
      afterMove();
    }, 500);
  } else if (ui.autoplay && state.phase === 'bidding' && state.turn === 0) {
    ui.aiTimer = setTimeout(() => {
      engine.placeBid(0, chooseBid(state.hands[0], random));
      afterMove();
    }, 500);
  } else if (ui.autoplay && state.phase === 'trump' && state.turn === 0) {
    ui.aiTimer = setTimeout(() => {
      engine.chooseTrump(0, chooseTrumpSuit(state.hands[0]));
      afterMove();
    }, 500);
  }
}

function afterMove() {
  ui.selected = null;
  render();
  announce(state.message);
  scheduleAi();
}

function playSelected() {
  if (!ui.selected) return;
  if (engine.playCard(0, ui.selected)) afterMove();
}

function selectCard(card) {
  ui.selected = card;
  render();
}

table.addEventListener('click', (event) => {
  const cardEl = event.target.closest('.card[data-card]');
  if (!cardEl) return;
  if (state.phase !== 'play' || state.turn !== 0) return;
  const [suit, rank] = cardEl.dataset.card.split('-');
  const card = state.hands[0].find((c) => c.suit === suit && c.rank === Number(rank));
  if (!card) return;
  const legal = engine.legalPlays(0);
  if (!legal.some((c) => c.suit === suit && c.rank === Number(rank))) return;
  if (ui.selected && ui.selected.suit === suit && ui.selected.rank === Number(rank)) playSelected();
  else selectCard(card);
});

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'start') { engine.startGame(); afterMove(); }
    else if (action === 'continue') { engine.continueGame(); afterMove(); }
    else if (action === 'new') { engine.startGame(); afterMove(); }
    else if (action === 'autoplay') {
      ui.autoplay = !ui.autoplay;
      render();
      scheduleAi();
    }
    return;
  }
  const bidEl = event.target.closest('[data-bid]');
  if (bidEl) {
    if (engine.placeBid(0, Number(bidEl.dataset.bid))) afterMove();
    return;
  }
  const trumpEl = event.target.closest('[data-trump]');
  if (trumpEl) {
    if (engine.chooseTrump(0, trumpEl.dataset.trump)) afterMove();
  }
});

document.addEventListener('keydown', (event) => {
  if (state.phase !== 'play' || state.turn !== 0) return;
  const legal = engine.legalPlays(0);
  if (legal.length === 0) return;
  const hand = state.hands[0];
  const currentIndex = ui.selected ? hand.indexOf(ui.selected) : -1;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const dir = event.key === 'ArrowRight' ? 1 : -1;
    let index = currentIndex;
    for (let step = 0; step < hand.length; step += 1) {
      index = (index + dir + hand.length) % hand.length;
      if (legal.some((c) => c.suit === hand[index].suit && c.rank === hand[index].rank)) break;
    }
    selectCard(hand[index]);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (ui.selected) playSelected();
    else if (legal.length > 0) selectCard(legal[0]);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(ui.aiTimer);
  else scheduleAi();
});

if (shot) {
  stageShot(shot, engine, random);
  render();
  announce(state.message);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
} else {
  render();
  announce('Tavern Tricks. Take a seat to start.');
}
