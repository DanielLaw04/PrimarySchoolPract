(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = { mode: 'mixed', max: 10, round: 0, correct: 0, stars: 0, streak: 0, question: null, locked: false, sound: true, recent: [] };
  const screens = { start: $('#startScreen'), game: $('#gameScreen'), result: $('#resultScreen') };
  let audioCtx;

  function show(name) {
    Object.values(screens).forEach(el => el.classList.remove('active'));
    screens[name].classList.add('active');
  }
  function tone(freq, duration, type = 'sine', delay = 0) {
    if (!state.sound) return;
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), now = audioCtx.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audioCtx.destination); osc.start(now); osc.stop(now + duration + 0.03);
  }
  function goodSound() { tone(523, .18); tone(659, .18, 'sine', .12); tone(784, .25, 'sine', .24); }
  function trySound() { tone(210, .16, 'triangle'); tone(175, .22, 'triangle', .12); }
  function shuffled(items) { return [...items].sort(() => Math.random() - .5); }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function makeQuestion() {
    let q, key, attempts = 0;
    do {
      const op = state.mode === 'mixed' ? (Math.random() < .5 ? 'add' : 'subtract') : state.mode;
      if (op === 'add') {
        const a = randomInt(1, state.max - 1), b = randomInt(1, state.max - a);
        q = { a, b, op, symbol: '+', answer: a + b };
      } else {
        const a = randomInt(2, state.max), b = randomInt(1, a);
        q = { a, b, op, symbol: '−', answer: a - b };
      }
      key = `${q.a}${q.symbol}${q.b}`; attempts++;
    } while (state.recent.includes(key) && attempts < 20);
    state.recent = [...state.recent.slice(-3), key];
    return q;
  }

  function makeOptions(answer) {
    const set = new Set([answer]);
    const nearby = shuffled([answer - 2, answer - 1, answer + 1, answer + 2, answer - 3, answer + 3, 0, state.max]);
    nearby.forEach(n => { if (set.size < 4 && n >= 0 && n <= state.max) set.add(n); });
    while (set.size < 4) set.add(randomInt(0, state.max));
    return shuffled([...set]);
  }

  function renderFrame(q) {
    const frame = $('#tenFrame'); frame.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const cell = document.createElement('div'); cell.className = 'cell';
      if (q.op === 'add' && i < q.answer) {
        const apple = document.createElement('div'); apple.className = `apple${i >= q.a ? ' second' : ''}`; cell.append(apple);
      } else if (q.op === 'subtract' && i < q.a) {
        const apple = document.createElement('div'); apple.className = `apple${i >= q.answer ? ' removed' : ''}`;
        if (i >= q.answer) { const x = document.createElement('span'); x.textContent = '×'; x.setAttribute('aria-hidden', 'true'); apple.append(x); }
        cell.append(apple);
      }
      frame.append(cell);
    }
    frame.setAttribute('aria-label', q.op === 'add' ? `${q.a} 個紅蘋果，加 ${q.b} 個黃蘋果` : `${q.a} 個蘋果，拿走 ${q.b} 個`);
  }

  function renderQuestion() {
    state.locked = false; state.question = makeQuestion();
    const q = state.question;
    $('#roundText').textContent = `${state.round + 1} / 10`;
    $('.progress').setAttribute('aria-valuenow', state.round + 1);
    $('#progressBar').style.width = `${(state.round + 1) * 10}%`;
    $('#stars').textContent = state.stars; $('#streak').textContent = state.streak;
    $('#equation').textContent = `${q.a} ${q.symbol} ${q.b} = ?`;
    $('#instruction').textContent = q.op === 'add' ? '把兩組蘋果合起來' : '把劃掉的蘋果拿走';
    renderFrame(q);
    const answers = $('#answers'); answers.innerHTML = '';
    makeOptions(q.answer).forEach((n, i) => {
      const b = document.createElement('button'); b.className = 'answer'; b.textContent = n; b.dataset.answer = n; b.setAttribute('aria-label', `答案 ${n}`); b.title = `按鍵 ${i + 1}`; b.addEventListener('click', () => answer(n, b)); answers.append(b);
    });
    const fb = $('#feedback'); fb.textContent = '請選一個答案'; fb.className = 'feedback';
  }

  function answer(value, button) {
    if (state.locked) return;
    state.locked = true;
    const right = value === state.question.answer;
    $$('.answer').forEach(b => { b.disabled = true; if (+b.dataset.answer === state.question.answer) b.classList.add('correct'); });
    const fb = $('#feedback');
    if (right) {
      state.correct++; state.streak++; state.stars += state.streak >= 3 ? 2 : 1;
      fb.textContent = state.streak >= 3 ? `太厲害了！連續答對 ${state.streak} 題，得到 2 顆星！` : shuffled(['答對了！好眼力！','正確！蘋果放進籃子了！','做得好！你算得很快！'])[0];
      fb.className = 'feedback good'; goodSound();
    } else {
      state.streak = 0; button.classList.add('wrong');
      fb.textContent = `${state.question.a} ${state.question.symbol} ${state.question.b} 的答案是 ${state.question.answer}。看看十格圖吧！`;
      fb.className = 'feedback try'; trySound();
    }
    $('#stars').textContent = state.stars; $('#streak').textContent = state.streak;
    setTimeout(() => { state.round++; state.round >= 10 ? finish() : renderQuestion(); }, right ? 1250 : 2200);
  }

  function start() {
    state.max = +document.querySelector('input[name="level"]:checked').value;
    Object.assign(state, { round: 0, correct: 0, stars: 0, streak: 0, recent: [] });
    show('game'); renderQuestion();
  }
  function finish() {
    show('result'); $('#finalScore').textContent = state.correct;
    const messages = state.correct === 10 ? ['滿分！你是果園心算王！','十題全對，松鼠為你鼓掌！'] : state.correct >= 8 ? ['很出色！再玩一次，挑戰滿分吧！'] : state.correct >= 5 ? ['有進步！看着十格圖再挑戰一次。'] : ['每次練習都會更熟，慢慢來！'];
    $('#resultMessage').textContent = shuffled(messages)[0] + ` 你得到 ${state.stars} 顆星。`;
    if (state.correct >= 8) { goodSound(); confetti(); }
  }
  function confetti() {
    const colors = ['#c94236','#f4c84c','#26734d','#63a9ca'];
    for (let i = 0; i < 45; i++) {
      const c = document.createElement('i'); c.className = 'confetti'; c.style.left = `${Math.random() * 100}vw`; c.style.background = colors[i % colors.length]; c.style.setProperty('--drift', `${randomInt(-100,100)}px`); c.style.animationDelay = `${Math.random() * .8}s`; document.body.append(c); setTimeout(() => c.remove(), 3800);
    }
  }
  function speak() {
    if (!('speechSynthesis' in window)) { $('#feedback').textContent = '這個瀏覽器暫不支援讀出功能'; return; }
    const q = state.question, text = `${q.a} ${q.op === 'add' ? '加' : '減'} ${q.b} 等於幾多？`;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-HK'; u.rate = .82; speechSynthesis.speak(u);
  }

  $$('.mode-btn').forEach(btn => btn.addEventListener('click', () => { state.mode = btn.dataset.mode; $$('.mode-btn').forEach(x => x.setAttribute('aria-pressed', x === btn)); }));
  $('#startBtn').addEventListener('click', start); $('#againBtn').addEventListener('click', start); $('#menuBtn').addEventListener('click', () => show('start')); $('#speakBtn').addEventListener('click', speak);
  $('#soundToggle').addEventListener('click', () => { state.sound = !state.sound; $('#soundToggle').setAttribute('aria-label', state.sound ? '關閉音效' : '開啟音效'); $$('.sound-wave').forEach(x => x.style.display = state.sound ? '' : 'none'); });
  let theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = theme;
  $('#themeToggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; $('#themeToggle').setAttribute('aria-label', theme === 'dark' ? '切換淺色模式' : '切換深色模式'); });
  document.addEventListener('keydown', e => { if (screens.game.classList.contains('active') && ['1','2','3','4'].includes(e.key)) $$('.answer')[+e.key - 1]?.click(); });
  window.addEventListener('load', () => setTimeout(() => $('#loading').classList.add('hide'), 250));
})();
