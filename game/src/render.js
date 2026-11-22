// Drawing only: the engine state in, DOM out. The table is re-rendered on
// every state change; clicks are handled by delegation on #table so a
// re-render never loses a handler. Cards are plain CSS — no images, no
// network requests.
import { SUIT_BY_ID, cardId, rankLabel } from './cards.js';
import { PLAYER_NAMES, ROUNDS_PER_GAME } from './engine.js';

export function cardHtml(card, extraClass = '') {
  const suit = SUIT_BY_ID[card.suit];
  const label = rankLabel(card.rank);
  return `<div class="card ${suit.colour} ${extraClass}" data-card="${cardId(card)}" role="button" aria-label="${label} of ${suit.name}">
    <span class="corner"><span class="r">${label}</span><span class="s">${suit.glyph}</span></span>
    <span class="pip">${suit.glyph}</span>
    <span class="corner br"><span class="r">${label}</span><span class="s">${suit.glyph}</span></span>
  </div>`;
}

function miniHand(count) {
  let out = '';
  for (let i = 0; i < count; i += 1) out += '<span class="mini-card"></span>';
  return `<div class="mini-hand">${out}</div>`;
}

function seatHtml(state, player, position) {
  const active = state.phase === 'play' && state.turn === player
    || state.phase === 'bidding' && state.turn === player
    || state.phase === 'trump' && state.turn === player;
  const bid = state.bids[player];
  const bidText = bid === null ? 'bidding…' : `bid ${bid}`;
  const dealer = state.dealer === player ? ' <span class="dealer">♦ dealer</span>' : '';
  return `<div class="seat ${active ? 'active' : ''} ${player === 0 ? 'me' : ''}">
    <div class="name">${PLAYER_NAMES[player]}${dealer}</div>
    <div class="sub">${bidText} · ${state.tricksWon[player]} trick${state.tricksWon[player] === 1 ? '' : 's'} · ${state.scores[player]} pts</div>
    ${miniHand(state.hands[player].length)}
  </div>`;
}

function trickSlot(state, player, position) {
  const play = state.currentTrick.find((p) => p.player === player);
  return `<div class="slot ${position}">${play ? cardHtml(play.card) : ''}<div class="who">${PLAYER_NAMES[player]}</div></div>`;
}

export function renderTable(el, state, ui) {
  const legal = ui.legalPlays;
  const legalIds = new Set(legal.map(cardId));
  const handHtml = state.hands[0].map((card) => {
    const playable = state.phase === 'play' && state.turn === 0 && legalIds.has(cardId(card));
    const dim = state.phase === 'play' && state.turn === 0 && legal.length > 0 && !playable;
    const selected = ui.selected && cardId(ui.selected) === cardId(card);
    return cardHtml(card, `${playable ? 'playable' : ''} ${dim ? 'dim' : ''} ${selected ? 'selected' : ''}`);
  }).join('');
  el.innerHTML = `
    <div class="seat-row">${seatHtml(state, 2, 'top')}</div>
    <div id="middle">
      ${seatHtml(state, 1, 'left')}
      <div id="trick-area">
        ${state.currentTrick.length === 0 ? '<div class="hint">The trick is played here</div>' : ''}
        ${trickSlot(state, 2, 'top')}${trickSlot(state, 1, 'left')}
        ${trickSlot(state, 3, 'right')}${trickSlot(state, 0, 'bottom')}
      </div>
      ${seatHtml(state, 3, 'right')}
    </div>
    <div id="message">${state.message}</div>
    <div id="hand">${handHtml}</div>
    <div id="hand-label">${state.phase === 'play' && state.turn === 0
      ? 'Your turn — click a glowing card to play it (← → to pick, Enter to play).'
      : state.phase === 'play' ? 'Watching the table…' : 'Your hand'}</div>`;
}

export function renderHeader(el, state, ui) {
  const trump = state.trump ? SUIT_BY_ID[state.trump] : null;
  el.innerHTML = `
    <h1>🃏 Tavern Tricks <span>· trick-taking at the inn</span></h1>
    <span class="hdr-item">Round <b>${Math.max(1, state.round)} / ${ROUNDS_PER_GAME}</b></span>
    <span class="hdr-item">Trump: ${trump ? `<span class="trump-badge">${trump.glyph} ${trump.name}</span>` : '<b>—</b>'}</span>
    <span class="hdr-item">Your score: <b>${state.scores[0]}</b></span>
    <span class="hdr-spacer"></span>
    <button class="hdr-btn" data-action="autoplay">Auto-play: ${ui.autoplay ? 'ON' : 'OFF'}</button>
    <button class="hdr-btn" data-action="new">New game</button>`;
}

export function renderSide(el, state) {
  const rounds = state.roundScores;
  let head = '<tr><th>Player</th>';
  for (let r = 1; r <= ROUNDS_PER_GAME; r += 1) head += `<th>R${r}</th>`;
  head += '<th>Total</th></tr>';
  let rows = '';
  for (let p = 0; p < 4; p += 1) {
    rows += `<tr class="${p === 0 ? 'me' : ''}"><td>${PLAYER_NAMES[p]}</td>`;
    for (let r = 0; r < ROUNDS_PER_GAME; r += 1) {
      const v = rounds[r] ? rounds[r][p] : null;
      rows += `<td class="${v !== null && v < 0 ? 'neg' : ''}">${v === null ? '·' : (v > 0 ? '+' : '') + v}</td>`;
    }
    rows += `<td><b>${state.scores[p]}</b></td></tr>`;
  }
  const history = state.trickLog.map((t) => {
    const cards = t.cards.map((c) => `${PLAYER_NAMES[c.player]} ${cardLabelShort(c.card)}`).join(' · ');
    return `<li><span class="w">${PLAYER_NAMES[t.winner]}</span> took: ${cards}</li>`;
  }).join('');
  el.innerHTML = `
    <h2>Scoreboard</h2>
    <table>${head}${rows}</table>
    <p style="font-size:13px;color:#ffe9b0;margin:10px 0 0">Make your bid: +10 per bid trick, +1 per trick taken. Miss it: −10 per bid trick.</p>
    <h2 style="margin-top:14px">Recent tricks</h2>
    <ul id="history">${history || '<li>No tricks yet — deal the cards.</li>'}</ul>`;
}

function cardLabelShort(card) {
  return `${rankLabel(card.rank)}${SUIT_BY_ID[card.suit].glyph}`;
}

export function renderOverlay(root, state, ui) {
  if (state.phase === 'title') {
    root.innerHTML = `<div class="overlay"><div class="panel">
      <h2>🃏 Tavern Tricks</h2>
      <p>Four travellers, one deck, a night of tricks at the inn. Bid bold, follow suit, and take the tricks you promised.</p>
      <ul class="rules">
        <li>Everyone is dealt 13 cards. Bid how many tricks you will take (0–13).</li>
        <li>The highest bidder names the trump suit. Ties go to the earliest bidder.</li>
        <li>You must follow the suit led if you can. Highest trump wins the trick, otherwise the highest card of the suit led. The winner leads the next trick.</li>
        <li>Make your bid: <b>+10 per bid trick, +1 per trick taken</b>. Miss it: <b>−10 per bid trick</b>.</li>
        <li>Five rounds — the highest total takes the pot.</li>
      </ul>
      <p>Click a card to play it. Arrow keys pick a card, Enter plays it.</p>
      <button class="big-btn" data-action="start">Take a seat</button>
    </div></div>`;
    return;
  }
  if (state.phase === 'bidding' && state.turn === 0) {
    root.innerHTML = `<div class="overlay"><div class="panel">
      <h3>Round ${state.round} — your bid</h3>
      <p>How many of the 13 tricks will you take?</p>
      <div class="bid-row">${Array.from({ length: 14 }, (_, b) => `<button class="bid-btn" data-bid="${b}">${b}</button>`).join('')}</div>
      <p style="font-size:14px">The highest bidder names trump. Make it: +10 per bid trick. Miss it: −10 per bid trick.</p>
    </div></div>`;
    return;
  }
  if (state.phase === 'trump' && state.turn === 0) {
    root.innerHTML = `<div class="overlay"><div class="panel">
      <h3>You won the bid with ${state.bids[0]}!</h3>
      <p>Name the trump suit:</p>
      <div class="trump-row">${['spades', 'hearts', 'diamonds', 'clubs'].map((s) => {
        const suit = SUIT_BY_ID[s];
        return `<button class="trump-btn ${suit.colour}" data-trump="${s}" aria-label="${suit.name}">${suit.glyph}</button>`;
      }).join('')}</div>
    </div></div>`;
    return;
  }
  if (state.phase === 'roundEnd') {
    const scores = state.roundScores[state.roundScores.length - 1];
    root.innerHTML = `<div class="overlay"><div class="panel">
      <h3>Round ${state.round} complete</h3>
      <table class="score-table"><tr><th>Player</th><th>Bid</th><th>Tricks</th><th>Round</th><th>Total</th></tr>
      ${[0, 1, 2, 3].map((p) => `<tr class="${p === 0 ? 'me' : ''}"><td>${PLAYER_NAMES[p]}</td><td>${state.bids[p]}</td><td>${state.tricksWon[p]}</td><td>${scores[p] > 0 ? '+' : ''}${scores[p]}</td><td><b>${state.scores[p]}</b></td></tr>`).join('')}
      </table>
      <button class="big-btn" data-action="continue">Deal round ${state.round + 1}</button>
    </div></div>`;
    return;
  }
  if (state.phase === 'gameOver') {
    const best = Math.max(...state.scores);
    const youWon = state.scores[0] === best;
    root.innerHTML = `<div class="overlay"><div class="panel">
      <div class="win">${youWon ? '🏆' : '🥈'}</div>
      <h2>${youWon ? 'You win the night!' : `${PLAYER_NAMES[state.scores.indexOf(best)]} takes the pot`}</h2>
      <p>${youWon ? 'The tavern cheers your name. Five rounds, and you out-bid and out-played them all.' : 'So close — the regulars keep their coins this time. Shuffle up and go again.'}</p>
      <table class="score-table"><tr><th>Player</th><th>Final score</th></tr>
      ${[0, 1, 2, 3].map((p) => `<tr class="${p === 0 ? 'me' : ''}"><td>${PLAYER_NAMES[p]}</td><td><b>${state.scores[p]}</b></td></tr>`).join('')}
      </table>
      <button class="big-btn" data-action="continue">Play again</button>
    </div></div>`;
    return;
  }
  root.innerHTML = '';
}
