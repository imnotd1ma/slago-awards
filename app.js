const FALLBACK_NOMINATIONS = [
  ['legend-year', 'Легенда года', []],
  ['meme-year', 'Мем года', []],
  ['active-year', 'Актив года', []],
  ['xer-year', 'Ксер года', []],
  ['golden-burger', 'Премия золотого бургера', []],
  ['zavoz-year', 'Завоз года', []],
  ['doter-year', 'Дотер года', []],
  ['ivan-zolo-year', 'Иван Золо года', []],
  ['toxic-year', 'Токсик года', []],
  ['charisma-year', 'Харизма года', []],
  ['good-guy-year', 'Добряк года', []],
  ['sex-symbol-year', 'Секс символ года', []]
].map(([id, title], index) => ({ id, title, index: index + 1, isFeatured: index < 3, nominees: [] }));

const SUPABASE_URL = 'https://yerptwwacgjftjpsfmdi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FqrZcdtx_rizOPJBFULWXg_cj7oS9X7';
const BALLOT_DRAFT_KEY = 'slago-awards-ballot-draft';
const isConfigured = !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_');
let supabaseClient = null;
if (isConfigured && window.supabase?.createClient) {
  try { supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (error) { console.error('Supabase не запустился:', error); }
}

const state = { nominations: FALLBACK_NOMINATIONS, players: [], playersLoaded: false, choices: new Map(), existingVoteNominationIds: new Set(), user: null, voteSubmitted: false, remoteNominations: false, votingAccepting: false, startsAt: null, endsAt: null, setupMessage: '', closedSlide: 0, closedDirection: 0 };
const grid = document.querySelector('#nominationGrid');
const authButton = document.querySelector('#authButton');
const adminLink = document.querySelector('#adminLink');
const votingStatus = document.querySelector('#votingStatus');
const submitButton = document.querySelector('#submitVote');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const submitHint = document.querySelector('#submitHint');
const ballotAuthButton = document.querySelector('#ballotAuthButton');
let toastTimer;
let countdownTimer;
let renderedNominationsKey = '';
let renderedClosedKey = '';

const NOMINATION_DESCRIPTIONS = {
  'legend-year': 'Человек, чьи поступки и истории стали частью Secret Gate в этом году.',
  'meme-year': 'Человек, который стал самым мемным на сервере.',
  'active-year': 'Самый заметный участник сообщества, который всегда был на сервере.',
  'xer-year': 'За яркие моменты, сильные эмоции и неповторимый стиль.',
  'golden-burger': 'За лютую жирность и самые убедительные разговоры о еде.',
  'zavoz-year': 'За событие, которое обсуждали дольше всего.',
  'doter-year': 'За самого гениального дотера на SG.',
  'ivan-zolo-year': 'За самые тупые моменты, с которых смеялся весь SG.',
  'toxic-year': 'За чемпионский уровень подколов и спорных высказываний.',
  'charisma-year': 'За обаяние, которое невозможно не заметить.',
  'good-guy-year': 'За поддержку, доброту и готовность прийти на помощь.',
  'sex-symbol-year': 'За стиль и харизму, покорившие сообщество.'
};
const NOMINATION_IMAGES = {
  'legend-year': 'legend-year.png',
  'meme-year': 'meme-year.png',
  'active-year': 'active-year.png',
  'xer-year': 'cs-year.png',
  'golden-burger': 'golden-burger.png',
  'zavoz-year': 'zavoz-year.png',
  'doter-year': 'dota-year.png',
  'ivan-zolo-year': 'ivan-zolo-year.png',
  'toxic-year': 'toxic-year.png',
  'charisma-year': 'harizma-year.png',
  'kind-year': 'kind-year.png',
  'sex-symbol-year': 'sex-symbol-year.png'
};

function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]); }
function avatarMarkup(person) {
  const initial = escapeHTML(String(person.name || '?').trim().charAt(0).toUpperCase() || '?');
  const url = typeof person.avatarUrl === 'string' && /^https?:\/\//i.test(person.avatarUrl) ? ` src="${escapeHTML(person.avatarUrl)}"` : '';
  return `<span class="candidate-avatar ${url ? 'has-image' : ''}"><b>${initial}</b>${url ? `<img${url} alt="" loading="lazy" draggable="false">` : ''}</span>`;
}
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400); }
function selectedName(choice) { return choice?.type === 'custom' ? choice.name : choice?.name; }
function saveBallotDraft() {
  try {
    if (state.voteSubmitted || !state.choices.size) localStorage.removeItem(BALLOT_DRAFT_KEY);
    else localStorage.setItem(BALLOT_DRAFT_KEY, JSON.stringify([...state.choices]));
  } catch (error) { console.warn('Не удалось сохранить черновик бюллетеня:', error); }
}
function restoreBallotDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(BALLOT_DRAFT_KEY) || '[]');
    if (Array.isArray(draft)) {
      for (const [nominationId, choice] of draft) {
        if (typeof nominationId === 'string' && choice && ['existing', 'cross'].includes(choice.type)) state.choices.set(nominationId, choice);
      }
    }
  } catch (error) { console.warn('Не удалось восстановить черновик бюллетеня:', error); }
}
function updateProgress() {
  const count = state.choices.size;
  const legend = state.nominations.find(item => item.slug === 'legend-year');
  const canAddLegend = state.voteSubmitted && legend && !state.existingVoteNominationIds.has(legend.id) && state.choices.has(legend.id);
  const canSubmitInitialBallot = !state.voteSubmitted && count === state.nominations.length;
  progressText.textContent = `${count} из ${state.nominations.length} выбрано`;
  progressBar.style.width = `${count / state.nominations.length * 100}%`;
  submitButton.disabled = (!canSubmitInitialBallot && !canAddLegend) || !state.user || !state.remoteNominations || !state.votingAccepting;
  submitButton.textContent = state.voteSubmitted ? 'Добавить голос за легенду' : 'Отправить бюллетень';
  submitHint.textContent = state.setupMessage || (!state.votingAccepting ? 'Голосование сейчас закрыто или ещё не началось.' : !state.user ? 'Войди через Discord, чтобы твой голос был засчитан.' : state.voteSubmitted ? canAddLegend ? 'Можно добавить только голос за «Легенду года».' : 'Бюллетень уже отправлен.' : count === state.nominations.length ? 'Всё готово. Проверь выбор и отправь бюллетень.' : 'Выбери кандидата в каждой номинации.');
  ballotAuthButton.hidden = Boolean(state.user);
  const submitWrap = document.querySelector('.submit-wrap');
  const legendAlreadyVoted = legend && state.existingVoteNominationIds.has(legend.id);
  submitWrap.hidden = !state.votingAccepting || (state.voteSubmitted && legendAlreadyVoted);
}
function updateChoiceUI(nominationId, centerSelected = false) {
  const nomination = state.nominations.find(item => item.id === nominationId);
  const card = grid.querySelector(`[data-nomination-card="${CSS.escape(nominationId)}"]`);
  if (!nomination || !card) return;
  const choice = state.choices.get(nominationId);
  card.classList.toggle('chosen', Boolean(choice));
  const prompt = card.querySelector('.nomination-prompt');
  prompt.textContent = choice ? `${choice.type === 'cross' ? 'Другой пользователь' : 'Выбрано'}: ${selectedName(choice)}` : 'Выбери одного кандидата';
  card.querySelectorAll('.candidate').forEach(button => {
    const selected = !button.classList.contains('is-clone') && choice?.type === 'existing' && choice.id === button.dataset.person;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = state.voteSubmitted && state.existingVoteNominationIds.has(nominationId);
  });
  const customInput = card.querySelector('[data-custom-nomination]');
  if (customInput) customInput.disabled = state.voteSubmitted && state.existingVoteNominationIds.has(nominationId);
  saveBallotDraft();
  const carousel = card.querySelector('.nomination-candidates');
  if (centerSelected && choice?.type === 'existing' && carousel) {
    const selected = carousel.querySelector(`.candidate[data-person="${CSS.escape(choice.id)}"]:not(.is-clone)`);
    if (selected) centerCandidate(carousel, selected);
  }
  updateProgress();
}
function centerSubmittedChoices() {
  if (!state.voteSubmitted) return;
  requestAnimationFrame(() => {
    state.nominations.forEach(nomination => {
      const choice = state.choices.get(nomination.id);
      if (choice?.type !== 'existing') return;
      const carousel = grid.querySelector(`[data-nomination-card="${CSS.escape(nomination.id)}"] .nomination-candidates`);
      const selected = carousel?.querySelector(`.candidate[data-person="${CSS.escape(choice.id)}"]:not(.is-clone)`);
      if (!carousel || !selected) return;
      centerCandidate(carousel, selected, false);
      updateCarouselClasses(carousel, Number(selected.dataset.carouselIndex));
    });
  });
}
function playerAlreadyNominated(player, nomination) {
  const username = player.username?.trim().toLocaleLowerCase('ru');
  const discordUsername = player.discordUsername?.trim().toLocaleLowerCase('ru');
  return nomination.nominees.some(nominee => player.discordId
    ? nominee.discordId === player.discordId
    : [nominee.name, nominee.discordUsername].some(name => {
      const normalized = name?.trim().toLocaleLowerCase('ru');
      return normalized && (normalized === username || normalized === discordUsername);
    }));
}
function isSelfVote(nomination, choice) {
  if (nomination.slug !== 'legend-year' || !state.user) return false;
  const voterDiscordId = state.user.user_metadata?.provider_id || state.user.user_metadata?.sub;
  if (!voterDiscordId) return false;
  const nominee = nomination.nominees.find(person => person.id === choice.id);
  return (nominee?.discordId || choice.discordId) === voterDiscordId;
}
function reconcileCrossChoices() {
  for (const [nominationId, choice] of state.choices) {
    if (choice.type !== 'cross' || state.voteSubmitted) continue;
    const nomination = state.nominations.find(item => item.id === nominationId);
    const player = state.players.find(item => choice.discordId
      ? item.discordId === choice.discordId
      : item.id === (choice.playerId || choice.id));
    if (!nomination || (!player && state.playersLoaded) || (player && playerAlreadyNominated(player, nomination))) {
      state.choices.delete(nominationId);
      continue;
    }
    if (!player) continue;
    choice.name = player.username;
    choice.discordId = player.discordId;
    choice.playerId = player.id;
    choice.id = player.id;
  }
}
function showOtherNomineeSuggestions(input) {
  const nominationId = input.dataset.customNomination;
  const list = input.parentElement.querySelector('.person-suggestions');
  const query = input.value.trim().toLocaleLowerCase('ru');
  if (!query) { list.hidden = true; list.replaceChildren(); return; }

  const nomination = state.nominations.find(item => item.id === nominationId);
  const matches = state.players
    .filter(player => nomination && !playerAlreadyNominated(player, nomination))
    .filter(player => player.username?.toLocaleLowerCase('ru').includes(query)
      || player.discordUsername?.toLocaleLowerCase('ru').includes(query))
    .slice(0, 8);

  if (!matches.length) {
    list.innerHTML = '<span class="person-suggestions-empty">Другие пользователи не найдены</span>';
  } else {
    list.innerHTML = matches.map(person => {
      const avatar = typeof person.avatarUrl === 'string' && /^https?:\/\//i.test(person.avatarUrl) ? `<img src="${escapeHTML(person.avatarUrl)}" alt="" loading="lazy">` : '';
      return `<button class="person-suggestion" type="button" data-person-choice="${escapeHTML(person.id)}"><span class="person-suggestion-player">${avatar}<span>${escapeHTML(person.username)}</span></span><small>${escapeHTML(person.discordUsername || 'Discord')}</small></button>`;
    }).join('');
    list.querySelectorAll('[data-person-choice]').forEach(button => button.addEventListener('click', () => {
      const selected = matches.find(person => person.id === button.dataset.personChoice);
      if (!selected) return;
      state.choices.set(nominationId, { type: 'cross', id: selected.id, playerId: selected.id, name: selected.username, discordId: selected.discordId });
      input.value = selected.username;
      list.hidden = true;
      list.replaceChildren();
      updateChoiceUI(nominationId);
    }));
  }
  list.hidden = false;
}
function render() {
  const closedVoting = document.querySelector('#closedVoting');
  const sectionHeading = document.querySelector('.section-heading');
  const submitWrap = document.querySelector('.submit-wrap');
  const isClosed = !state.votingAccepting;
  const nominationsKey = JSON.stringify(state.nominations.map(nomination => [nomination.id, nomination.title, nomination.nominees.map(person => [person.id, person.name, person.avatarUrl, person.description])]));
  closedVoting.hidden = false;
  grid.hidden = isClosed && !state.voteSubmitted;
  sectionHeading.classList.toggle('is-closed-view', isClosed);
  submitWrap.hidden = isClosed || (state.voteSubmitted && state.nominations.some(item => item.slug === 'legend-year' && state.existingVoteNominationIds.has(item.id)));
  const closedKey = `${nominationsKey}:${state.votingAccepting}`;
  if (renderedClosedKey !== closedKey) {
    renderedClosedKey = closedKey;
    renderClosedNominations();
  }
  if (isClosed && !state.voteSubmitted) {
    updateProgress();
    return;
  }
  if (renderedNominationsKey === nominationsKey) {
    state.nominations.forEach(nomination => updateChoiceUI(nomination.id));
    return;
  }
  renderedNominationsKey = nominationsKey;
  const preservedCards = new Map([...grid.querySelectorAll('.nomination')].map(card => {
    const id = card.dataset.nominationCard;
    return [id, {
      scrollLeft: card.querySelector('.nomination-candidates')?.scrollLeft || 0,
      inputValue: card.querySelector('.custom-input')?.value || '',
      inputFocused: document.activeElement === card.querySelector('.custom-input')
    }];
  }));
  const nominationCard = nomination => {
    const choice = state.choices.get(nomination.id);
    const isZavoz = nomination.slug?.startsWith('zavoz-year');
    const candidates = nomination.nominees.map(person => `<button class="candidate ${choice?.type === 'existing' && choice.id === person.id ? 'selected' : ''}" type="button" data-nomination="${escapeHTML(nomination.id)}" data-person="${escapeHTML(person.id)}" aria-pressed="${choice?.type === 'existing' && choice.id === person.id}">${avatarMarkup(person)}<span class="candidate-name">${escapeHTML(person.name)}</span><i>✓</i>${isZavoz && person.description ? `<span class="candidate-description">${escapeHTML(person.description)}</span>` : ''}</button>`).join('');
    const customName = choice?.type === 'cross' ? choice.name : '';
    const customPicker = nomination.slug === 'legend-year' ? '' : `<label class="custom-label" for="custom-${escapeHTML(nomination.id)}">Или выбери другого пользователя</label><div class="custom-picker"><input id="custom-${escapeHTML(nomination.id)}" class="custom-input" data-custom-nomination="${escapeHTML(nomination.id)}" maxlength="70" autocomplete="off" placeholder="Начни вводить имя" value="${escapeHTML(customName)}" /><div class="person-suggestions" role="listbox" hidden></div></div>`;
    return `<article class="nomination ${choice ? 'chosen' : ''}" data-nomination-card="${escapeHTML(nomination.id)}" style="animation-delay:${nomination.index * 55}ms"><span class="nomination-index">№ ${String(nomination.index).padStart(2, '0')}</span><h3>${escapeHTML(nomination.title)}</h3><p class="nomination-prompt">${choice ? `${choice.type === 'cross' ? 'Другой пользователь' : 'Выбрано'}: ${escapeHTML(selectedName(choice))}` : 'Выбери одного кандидата'}</p><div class="nomination-candidates">${candidates}</div>${customPicker}</article>`;
  };
  grid.innerHTML = state.nominations.map(nominationCard).join('');
  grid.querySelectorAll('.nomination-candidates').forEach(carousel => {
    const article = carousel.parentElement;
    const slider = document.createElement('div');
    slider.className = 'nomination-slider candidate-slider';
    slider.dataset.nominationSlider = carousel.closest('.nomination').dataset.nominationCard;
    const previous = document.createElement('button');
    previous.className = 'slider-arrow candidate-slider-arrow';
    previous.type = 'button';
    previous.dataset.candidatePrev = '';
    previous.setAttribute('aria-label', 'Предыдущий кандидат');
    previous.textContent = '←';
    const next = document.createElement('button');
    next.className = 'slider-arrow candidate-slider-arrow';
    next.type = 'button';
    next.dataset.candidateNext = '';
    next.setAttribute('aria-label', 'Следующий кандидат');
    next.textContent = '→';
    article.insertBefore(slider, carousel);
    slider.append(previous, carousel, next);
    const dots = document.createElement('div');
    dots.className = 'slider-dots candidate-slider-dots';
    dots.setAttribute('aria-label', 'Выбрать кандидата');
    article.insertBefore(dots, slider.nextSibling);
  });
  preservedCards.forEach((saved, nominationId) => {
    const card = grid.querySelector(`[data-nomination-card="${CSS.escape(nominationId)}"]`);
    const input = card?.querySelector('.custom-input');
    if (input && saved.inputValue) input.value = saved.inputValue;
    if (input && saved.inputFocused) requestAnimationFrame(() => input.focus());
  });
  grid.querySelectorAll('.nomination-candidates').forEach(carousel => {
    const candidates = [...carousel.querySelectorAll('.candidate')];
    candidates.forEach((button, index) => {
      button.dataset.carouselIndex = String(index);
      const order = document.createElement('span');
      order.className = 'candidate-order';
      order.textContent = `${String(index + 1).padStart(2, '0')} / ${String(candidates.length).padStart(2, '0')}`;
      button.querySelector('.candidate-name').before(order);
    });
    carousel.dataset.count = String(candidates.length);
    if (candidates.length < 2) {
      carousel.closest('.candidate-slider')?.querySelectorAll('.candidate-slider-arrow').forEach(button => { button.hidden = true; });
    }
    const dots = carousel.closest('.candidate-slider')?.nextElementSibling;
    if (dots) {
      dots.innerHTML = candidates.map((candidate, index) => `<button class="slider-dot ${index === 0 ? 'is-active' : ''}" type="button" data-candidate-index="${index}" aria-label="Кандидат ${index + 1}: ${escapeHTML(candidate.querySelector('.candidate-name')?.textContent || '')}" aria-current="${index === 0}"></button>`).join('');
    }
    if (candidates.length > 1) {
      const before = candidates.map(candidate => candidate.cloneNode(true));
      const after = candidates.map(candidate => candidate.cloneNode(true));
      before.forEach(candidate => { candidate.classList.add('is-clone'); candidate.classList.remove('selected'); candidate.setAttribute('aria-hidden', 'true'); candidate.setAttribute('aria-pressed', 'false'); candidate.tabIndex = -1; });
      after.forEach(candidate => { candidate.classList.add('is-clone'); candidate.classList.remove('selected'); candidate.setAttribute('aria-hidden', 'true'); candidate.setAttribute('aria-pressed', 'false'); candidate.tabIndex = -1; });
      before.reverse().forEach(candidate => carousel.insertBefore(candidate, carousel.firstChild));
      after.forEach(candidate => carousel.append(candidate));
    }
    const selected = state.choices.get(carousel.closest('.nomination').dataset.nominationCard);
    const initialIndex = selected?.type === 'existing' ? candidates.findIndex(candidate => candidate.dataset.person === selected.id) : 0;
    const index = initialIndex >= 0 ? initialIndex : 0;
    carousel.dataset.activeIndex = String(index);
    const saved = preservedCards.get(carousel.closest('.nomination').dataset.nominationCard);
    requestAnimationFrame(() => {
      if (saved) {
        carousel.scrollLeft = saved.scrollLeft;
        settleCandidateCarousel(carousel);
      } else {
        centerCandidate(carousel, carousel.querySelector(`.candidate[data-carousel-index="${index}"]:not(.is-clone)`), false);
        updateCarouselClasses(carousel, index);
      }
    });
    updateCarouselClasses(carousel, index);
  });
  grid.querySelectorAll('.nomination-candidates').forEach(carousel => {
    let dragging = false; let moved = false; let startX = 0; let startScroll = 0; let pressedCandidate = null;
    let lastX = 0; let lastTime = 0; let dragVelocity = 0;
    let scrollTimer; let inertiaFrame = 0; let wheelFrame = 0; let wheelTarget = 0;
    carousel.addEventListener('dragstart', event => event.preventDefault());
    carousel.addEventListener('wheel', event => {
      if (!event.shiftKey) return;
      event.preventDefault();
      if (!wheelFrame) wheelTarget = carousel.scrollLeft;
      const multiplier = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? carousel.clientWidth : 1;
      wheelTarget = Math.max(0, Math.min(carousel.scrollWidth - carousel.clientWidth, wheelTarget + (event.deltaY || event.deltaX) * multiplier));
      if (wheelFrame) return;
      const animateWheel = () => {
        const distance = wheelTarget - carousel.scrollLeft;
        carousel.scrollLeft += distance * 0.18;
        if (Math.abs(distance) < 0.5) {
          carousel.scrollLeft = wheelTarget;
          wheelFrame = 0;
          return;
        }
        wheelFrame = requestAnimationFrame(animateWheel);
      };
      wheelFrame = requestAnimationFrame(animateWheel);
    }, { passive: false });
    carousel.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      cancelAnimationFrame(inertiaFrame); inertiaFrame = 0;
      dragging = true; moved = false; pressedCandidate = event.target.closest('.candidate'); startX = event.clientX; startScroll = carousel.scrollLeft; lastX = event.clientX; lastTime = performance.now(); dragVelocity = 0;
      carousel.classList.add('is-dragging'); carousel.setPointerCapture(event.pointerId);
    });
    carousel.addEventListener('pointermove', event => {
      if (!dragging) return;
      const now = performance.now();
      const delta = event.clientX - startX;
      const frameDelta = event.clientX - lastX;
      const frameTime = Math.max(1, now - lastTime);
      if (Math.abs(delta) > 8) moved = true;
      dragVelocity = -(frameDelta / frameTime) * 16;
      carousel.scrollLeft = startScroll - delta;
      lastX = event.clientX; lastTime = now;
    });
    carousel.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!dragging && !inertiaFrame && !wheelFrame && carousel.dataset.animating !== 'true') settleCandidateCarousel(carousel);
      }, 90);
    }, { passive: true });
    const finishDrag = event => {
      if (!dragging) return; dragging = false;
      if (carousel.hasPointerCapture(event.pointerId)) carousel.releasePointerCapture(event.pointerId);
      if (!moved && pressedCandidate && !pressedCandidate.classList.contains('is-clone')) pressedCandidate.click();
      pressedCandidate = null;
      if (moved) {
        carousel.dataset.dragged = 'true';
        setTimeout(() => delete carousel.dataset.dragged, 80);
        const glide = () => {
          carousel.scrollLeft += dragVelocity;
          dragVelocity *= 0.9;
          if (Math.abs(dragVelocity) > 0.35) inertiaFrame = requestAnimationFrame(glide);
          else {
            inertiaFrame = 0;
            carousel.classList.remove('is-dragging');
            settleCandidateCarousel(carousel);
          }
        };
        inertiaFrame = requestAnimationFrame(glide);
      } else {
        carousel.classList.remove('is-dragging');
        settleCandidateCarousel(carousel);
      }
    };
    carousel.addEventListener('pointerup', finishDrag); carousel.addEventListener('pointercancel', finishDrag);
  });
  grid.querySelectorAll('.candidate-slider').forEach(slider => {
    const carousel = slider.querySelector('.nomination-candidates');
    const dots = slider.nextElementSibling?.querySelectorAll('.slider-dot') || [];
    const syncDots = index => dots.forEach((dot, dotIndex) => {
      const active = dotIndex === index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', String(active));
    });
    const move = offset => {
      const count = Number(carousel?.dataset.count || 0);
      if (!carousel || count < 2) return;
      const current = Number(carousel.dataset.activeIndex || 0);
      const index = (current + offset + count) % count;
      carousel.dataset.activeIndex = String(index);
      const wrappingForward = offset > 0 && current === count - 1;
      const wrappingBackward = offset < 0 && current === 0;
      const cloneTargets = [...carousel.querySelectorAll(`.candidate[data-carousel-index="${index}"].is-clone`)];
      const target = wrappingForward
        ? cloneTargets.at(-1)
        : wrappingBackward
          ? cloneTargets[0]
          : carousel.querySelector(`.candidate[data-carousel-index="${index}"]:not(.is-clone)`);
      centerCandidate(carousel, target);
      syncDots(index);
    };
    slider.querySelector('[data-candidate-prev]')?.addEventListener('click', () => move(-1));
    slider.querySelector('[data-candidate-next]')?.addEventListener('click', () => move(1));
    dots.forEach((dot, index) => dot.addEventListener('click', () => {
      carousel.dataset.activeIndex = String(index);
      centerCandidate(carousel, carousel.querySelector(`.candidate[data-carousel-index="${index}"]:not(.is-clone)`));
      syncDots(index);
    }));
  });
  grid.querySelectorAll('.candidate').forEach(button => button.addEventListener('click', () => {
    if (button.closest('.nomination-candidates')?.dataset.dragged === 'true') return;
    const nomination = state.nominations.find(item => item.id === button.dataset.nomination);
    const person = nomination?.nominees.find(item => item.id === button.dataset.person);
    if (!nomination || !person) return;
    state.choices.set(nomination.id, { type: 'existing', id: person.id, name: person.name });
    const customInput = grid.querySelector(`[data-custom-nomination="${CSS.escape(nomination.id)}"]`);
    if (customInput) { customInput.value = ''; customInput.parentElement.querySelector('.person-suggestions').hidden = true; }
    updateChoiceUI(nomination.id, true);
  }));
  grid.querySelectorAll('[data-custom-nomination]').forEach(input => input.addEventListener('input', () => {
    const nominationId = input.dataset.customNomination;
    state.choices.delete(nominationId);
    showOtherNomineeSuggestions(input);
    updateChoiceUI(nominationId);
  }));
  state.nominations.forEach(nomination => updateChoiceUI(nomination.id));
  updateProgress();
}
function centerCandidate(carousel, candidate, smooth = true) {
  if (!candidate) return;
  const left = candidate.offsetLeft - (carousel.clientWidth - candidate.offsetWidth) / 2;
  if (smooth) {
    cancelAnimationFrame(carousel._scrollFrame);
    carousel.dataset.animating = 'true';
    const start = carousel.scrollLeft;
    const distance = left - start;
    const startedAt = performance.now();
    const duration = 180;
    const animate = now => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      carousel.scrollLeft = start + distance * eased;
      if (progress < 1) {
        carousel._scrollFrame = requestAnimationFrame(animate);
        return;
      }
      carousel.scrollLeft = left;
      delete carousel.dataset.animating;
      settleCandidateCarousel(carousel);
    };
    carousel._scrollFrame = requestAnimationFrame(animate);
    return;
  }
  carousel.classList.add('is-recentering');
  carousel.scrollLeft = left;
  requestAnimationFrame(() => carousel.classList.remove('is-recentering'));
}
function updateCarouselClasses(carousel, activeIndex) {
  const count = Number(carousel.dataset.count);
  if (!count) return;
  carousel.dataset.activeIndex = String(activeIndex);
  const candidates = [...carousel.querySelectorAll('.candidate')];
  const center = carousel.scrollLeft + carousel.clientWidth / 2;
  const currentIndex = candidates.reduce((closest, item, index) => {
    const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center);
    return !closest || distance < closest.distance ? { index, distance } : closest;
  }, null)?.index;
  candidates.forEach((candidate, index) => {
    const distance = currentIndex == null ? Infinity : Math.abs(index - currentIndex);
    candidate.classList.toggle('is-current', distance === 0);
    candidate.classList.toggle('is-adjacent', distance === 1);
  });
  const realIndex = currentIndex == null ? activeIndex : Number(candidates[currentIndex]?.dataset.carouselIndex ?? activeIndex);
  carousel.closest('.candidate-slider')?.nextElementSibling?.querySelectorAll('.slider-dot').forEach((dot, index) => {
    const active = index === realIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-current', String(active));
  });
}
function settleCandidateCarousel(carousel) {
  const candidates = [...carousel.querySelectorAll('.candidate')];
  const centered = candidates.reduce((closest, item) => {
    const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - (carousel.scrollLeft + carousel.clientWidth / 2));
    return !closest || distance < closest.distance ? { item, distance } : closest;
  }, null)?.item;
  if (!centered) return;
  const count = Number(carousel.dataset.count);
  const index = Number(centered.dataset.carouselIndex);
  updateCarouselClasses(carousel, index);
  if (centered.classList.contains('is-clone') && count > 1) {
    const realCandidate = carousel.querySelector(`.candidate[data-carousel-index="${index}"]:not(.is-clone)`);
    centerCandidate(carousel, realCandidate, false);
    requestAnimationFrame(() => updateCarouselClasses(carousel, index));
  }
}
function renderClosedNominations() {
  const slide = document.querySelector('#closedNominationSlide');
  const previousSlide = document.querySelector('#closedNominationPrevious');
  const nextSlide = document.querySelector('#closedNominationNext');
  const slides = document.querySelector('.nomination-slides');
  const dots = document.querySelector('#sliderDots');
  if (!state.nominations.length) {
    slide.innerHTML = '<p class="closed-slide-description">Номинации скоро появятся.</p>';
    previousSlide.innerHTML = '';
    nextSlide.innerHTML = '';
    dots.replaceChildren();
    return;
  }
  state.closedSlide = (state.closedSlide + state.nominations.length) % state.nominations.length;
  const getNomination = offset => state.nominations[(state.closedSlide + offset + state.nominations.length) % state.nominations.length];
  const renderSlide = (target, nomination, side = false) => {
    target.classList.remove('is-current');
    if (!side) void target.offsetWidth;
    const slug = nomination.slug || nomination.id;
    const description = NOMINATION_DESCRIPTIONS[slug] || 'Особое признание участнику или моменту, который сделал этот год в Slago незабываемым.';
    const imageName = NOMINATION_IMAGES[slug];
    const image = imageName ? `<img src="images/nominations/${escapeHTML(imageName)}" alt="" loading="lazy">` : '<span>PNG</span>';
    target.innerHTML = `<span class="closed-slide-index">НОМИНАЦИЯ ${String(nomination.index).padStart(2, '0')} / ${String(state.nominations.length).padStart(2, '0')}</span><div class="nomination-art-placeholder" aria-hidden="true">${image}</div><h3><span>${escapeHTML(nomination.title)}</span></h3><p class="closed-slide-description">${escapeHTML(description)}</p>`;
    target.classList.toggle('is-side', side);
    if (!side) target.classList.add('is-current');
  };
  renderSlide(previousSlide, getNomination(-1), true);
  renderSlide(slide, getNomination(0));
  renderSlide(nextSlide, getNomination(1), true);
  [previousSlide, slide, nextSlide].forEach((target, offset) => {
    const nomination = getNomination(offset - 1);
    target.tabIndex = state.votingAccepting ? 0 : -1;
    target.setAttribute('role', state.votingAccepting ? 'button' : 'article');
    if (state.votingAccepting) target.setAttribute('aria-label', `Перейти к голосованию: ${nomination.title}`);
    else target.removeAttribute('aria-label');
    target.onclick = () => {
      if (!state.votingAccepting) return;
      grid.querySelector(`[data-nomination-card="${CSS.escape(nomination.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    target.onkeydown = event => {
      if (state.votingAccepting && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); target.click(); }
    };
  });
  slides.classList.remove('is-next', 'is-previous');
  if (state.closedDirection) {
    void slides.offsetWidth;
    slides.classList.add(state.closedDirection > 0 ? 'is-next' : 'is-previous');
  }
  state.closedDirection = 0;
  dots.innerHTML = state.nominations.map((item, index) => `<button class="slider-dot ${index === state.closedSlide ? 'is-active' : ''}" type="button" aria-label="Номинация ${index + 1}: ${escapeHTML(item.title)}" aria-current="${index === state.closedSlide}"></button>`).join('');
  dots.querySelectorAll('.slider-dot').forEach((button, index) => button.addEventListener('click', () => {
    state.closedDirection = index > state.closedSlide ? 1 : index < state.closedSlide ? -1 : 0;
    state.closedSlide = index;
    renderClosedNominations();
  }));
}
function updateCountdown() {
  const output = document.querySelector('#votingCountdown');
  const label = document.querySelector('#countdownLabel');
  const dateOutput = document.querySelector('#countdownDate');
  if (!output || !label) return;
  const targetValue = state.votingAccepting ? state.endsAt : state.startsAt;
  const target = targetValue ? new Date(targetValue).getTime() : NaN;
  const formatDate = value => value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '';
  label.textContent = state.votingAccepting ? 'До конца голосования' : 'До начала голосования';
  if (dateOutput) dateOutput.textContent = Number.isFinite(target) ? `${state.votingAccepting ? 'Окончание' : 'Начало'}: ${formatDate(targetValue)} · МСК (UTC+3)` : '';
  if (!Number.isFinite(target)) { output.textContent = state.votingAccepting ? 'Дата окончания появится позже' : 'Дата начала появится позже'; return; }
  const remaining = target - Date.now();
  if (remaining <= 0) {
    label.textContent = state.votingAccepting ? 'До конца голосования' : 'Голосование закрыто';
    output.textContent = state.votingAccepting ? 'Голосование завершается' : 'Следующий старт будет объявлен';
    if (dateOutput && !state.votingAccepting) dateOutput.textContent = '';
    return;
  }
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining % 86400000 / 3600000);
  const minutes = Math.floor(remaining % 3600000 / 60000);
  const seconds = Math.floor(remaining % 60000 / 1000);
  output.textContent = [days && `${days} д`, `${hours} ч`, `${minutes} мин`, `${seconds} сек`].filter(Boolean).join('  ·  ');
}
let nominationsRefreshTimer;
let nominationChannelConnected = false;
function scheduleNominationsRefresh() {
  clearTimeout(nominationsRefreshTimer);
  nominationsRefreshTimer = setTimeout(() => {
    loadNominations().catch(error => console.warn('Не удалось обновить номинации:', error));
  }, 120);
}
function subscribeToNominationChanges() {
  supabaseClient.channel('slago-nominations-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'slago_nominations' }, scheduleNominationsRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'slago_nominees' }, scheduleNominationsRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, schedulePlayersRefresh)
    .subscribe(status => {
      if (status === 'SUBSCRIBED' && nominationChannelConnected) scheduleNominationsRefresh();
      if (status === 'SUBSCRIBED') nominationChannelConnected = true;
    });
}
async function loadNominations() {
  if (!supabaseClient) return render();
  let selectionMetadataAvailable = true;
  let queryResult = await supabaseClient.from('slago_nominations').select('id, slug, title, sort_order, is_featured, slago_nominees(id, name, description, discord_id, discord_username, avatar_url, is_legend_year_selected, sort_order)').eq('is_active', true).order('sort_order').order('sort_order', { foreignTable: 'slago_nominees' });
  if (queryResult.error?.message.includes('is_legend_year_selected')) {
    selectionMetadataAvailable = false;
    queryResult = await supabaseClient.from('slago_nominations').select('id, slug, title, sort_order, is_featured, slago_nominees(id, name, description, discord_id, discord_username, avatar_url, sort_order)').eq('is_active', true).order('sort_order').order('sort_order', { foreignTable: 'slago_nominees' });
  }
  const { data, error } = queryResult;
  if (error || !data?.length) {
    state.setupMessage = error ? `Бюллетень временный: Supabase не вернул номинации (${error.message}).` : 'В Supabase пока нет активных номинаций. Выполни supabase/schema.sql.';
    return render();
  }
  const nextNominations = data.map((item, index) => {
    const nominees = (item.slago_nominees || []).map(person => ({ id: person.id, name: person.name, description: person.description || '', discordId: person.discord_id, discordUsername: person.discord_username, avatarUrl: person.avatar_url || '', isLegendYearSelected: person.is_legend_year_selected === true }));
    return { id: item.id, slug: item.slug, title: item.title, index: index + 1, isFeatured: item.is_featured === true, nominees: item.slug === 'legend-year' && selectionMetadataAvailable ? nominees.filter(person => person.isLegendYearSelected) : nominees };
  });
  state.nominations = nextNominations;
  if (!state.voteSubmitted) restoreBallotDraft();
  const activeNominationIds = new Set(nextNominations.map(item => item.id));
  for (const [nominationId, choice] of state.choices) {
    if (!activeNominationIds.has(nominationId)) state.choices.delete(nominationId);
    else if (choice.type === 'existing' && !nextNominations.find(item => item.id === nominationId)?.nominees.some(person => person.id === choice.id)) state.choices.delete(nominationId);
  }
  reconcileCrossChoices();
  state.remoteNominations = true; render();
  if (state.user) await loadMyVote();
}
let playersRefreshTimer;
function schedulePlayersRefresh() {
  clearTimeout(playersRefreshTimer);
  playersRefreshTimer = setTimeout(() => loadPlayers().catch(error => console.warn('Не удалось обновить игроков:', error)), 120);
}
async function loadPlayers() {
  if (!supabaseClient) return;
  const players = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseClient.from('profiles').select('id, discord_id, username, discord_username, avatar_url').order('username').range(from, from + 999);
    if (error) { console.warn('Не удалось загрузить игроков:', error); return; }
    players.push(...(data || []).map(player => ({ id: player.id, discordId: player.discord_id, username: player.username, discordUsername: player.discord_username, avatarUrl: player.avatar_url })));
    if (!data || data.length < 1000) break;
  }
  state.players = players;
  state.playersLoaded = true;
  reconcileCrossChoices();
  render();
  if (state.user) await loadMyVote();
}
async function syncUser() { if (!supabaseClient) return; const previousUserId = state.user?.id; const { data: { session } } = await supabaseClient.auth.getSession(); state.user = session?.user ?? null; if (previousUserId && previousUserId !== state.user?.id) { state.choices.clear(); state.existingVoteNominationIds.clear(); state.voteSubmitted = false; render(); } authButton.textContent = state.user ? `Выйти: ${state.user.user_metadata.full_name || state.user.email}` : 'Войти через Discord'; if (state.user && adminLink) { const { data: isAdmin, error } = await supabaseClient.rpc('is_slago_admin'); adminLink.hidden = error || isAdmin !== true; } else if (adminLink) adminLink.hidden = true; await loadMyVote(); updateProgress(); }
async function loadMyVote() {
  if (!supabaseClient || !state.user) {
    state.voteSubmitted = false;
    state.existingVoteNominationIds.clear();
    return;
  }
  const { data, error } = await supabaseClient.rpc('get_my_slago_votes');
  if (error) { console.warn('Не удалось загрузить твой бюллетень:', error); return; }
  if (!Array.isArray(data) || !data.length) { state.voteSubmitted = false; state.existingVoteNominationIds.clear(); render(); updateProgress(); return; }
  const bySlug = new Map(state.nominations.map(item => [item.slug, item]));
  state.choices.clear();
  state.existingVoteNominationIds.clear();
  for (const vote of data) {
    const nomination = bySlug.get(vote.nomination_slug);
    if (!nomination) continue;
    state.existingVoteNominationIds.add(nomination.id);
    state.choices.set(nomination.id, vote.nominee_id
      ? { type: 'existing', id: vote.nominee_id, name: vote.nominee_name }
      : { type: 'cross', id: null, name: state.players.find(player => player.discordId === vote.custom_nominee_discord_id)?.username || vote.custom_nominee, discordId: vote.custom_nominee_discord_id || null });
  }
  state.voteSubmitted = true;
  saveBallotDraft();
  render();
  centerSubmittedChoices();
  updateProgress();
}
async function loadVotingStatus() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.rpc('get_slago_vote_status');
  if (error || !data) { console.warn('Не удалось получить статус голосования:', error); return; }
  state.votingAccepting = data.accepting_votes === true;
  state.startsAt = data.starts_at || null;
  state.endsAt = data.ends_at || null;
  const waitingForStart = data.is_open && data.starts_at && Date.now() < new Date(data.starts_at).getTime();
  const statusText = state.votingAccepting ? 'Голосование открыто' : waitingForStart ? 'Стартует по расписанию' : 'Голосование закрыто';
  votingStatus?.classList.toggle('is-closed', !state.votingAccepting);
  votingStatus?.classList.toggle('is-waiting', !state.votingAccepting && Boolean(waitingForStart));
  if (votingStatus) votingStatus.innerHTML = `<i></i> ${statusText}`;
  updateCountdown();
  render();
  updateProgress();
}
authButton.addEventListener('click', async () => {
  if (!supabaseClient) return toast(isConfigured ? 'Supabase не загрузился. Запусти сайт через Live Server и обнови страницу.' : 'Добавь ключи Supabase в app.js.');
  if (state.user) { await supabaseClient.auth.signOut(); toast('Вы вышли из аккаунта.'); return; }
  if (window.location.protocol === 'file:') return toast('Сначала запусти сайт через Live Server, а не двойным кликом по index.html.');
  const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.href.split('#')[0] } });
  if (error) toast(`Ошибка входа: ${error.message}`);
});
ballotAuthButton.addEventListener('click', () => authButton.click());
submitButton.addEventListener('click', async () => {
  if (!state.user || !supabaseClient) return;
  const addingLegend = state.voteSubmitted;
  submitButton.disabled = true;
  const legend = state.nominations.find(item => item.slug === 'legend-year');
  const selectedChoices = state.voteSubmitted
    ? (legend && !state.existingVoteNominationIds.has(legend.id) && state.choices.has(legend.id) ? [[legend.id, state.choices.get(legend.id)]] : [])
    : [...state.choices];
  if (!state.voteSubmitted && selectedChoices.length !== state.nominations.length) { updateProgress(); return; }
  const rows = selectedChoices.map(([nomination_id, choice]) => ({ nomination_id, voter_id: state.user.id, nominee_id: choice.type === 'existing' ? choice.id : null, custom_nominee: choice.type === 'cross' ? choice.name : null, custom_nominee_discord_id: choice.type === 'cross' ? choice.discordId || null : null }));
  const selfVote = rows.some(row => isSelfVote(state.nominations.find(item => item.id === row.nomination_id), state.choices.get(row.nomination_id)));
  if (selfVote) { toast('За себя в номинации «Легенда года» голосовать нельзя.'); updateProgress(); return; }
  const { error } = await supabaseClient.from('slago_votes').insert(rows);
  if (error) { toast(error.message.includes('CANNOT_VOTE_FOR_SELF') ? 'За себя в номинации «Легенда года» голосовать нельзя.' : error.code === '23505' ? 'Этот голос уже записан.' : error.message.includes('VOTING_CLOSED') ? 'Голосование закрыто.' : `Не удалось отправить: ${error.message}`); if (error.code === '23505') await loadMyVote(); await loadVotingStatus(); updateProgress(); return; }
  await loadMyVote();
  saveBallotDraft();
  toast(addingLegend ? 'Голос за «Легенду года» добавлен.' : 'Бюллетень отправлен.');
  render(); updateProgress();
});
render();
document.querySelector('#nominationPrev').addEventListener('click', () => { state.closedDirection = -1; state.closedSlide--; renderClosedNominations(); });
document.querySelector('#nominationNext').addEventListener('click', () => { state.closedDirection = 1; state.closedSlide++; renderClosedNominations(); });
countdownTimer = setInterval(updateCountdown, 1000);
if (supabaseClient) { supabaseClient.auth.onAuthStateChange(() => syncUser()); loadNominations().catch(error => { console.warn('Не удалось загрузить номинации:', error); }); loadPlayers().catch(error => console.warn('Не удалось загрузить игроков:', error)); loadVotingStatus(); setInterval(loadVotingStatus, 30000); subscribeToNominationChanges(); syncUser().catch(error => console.warn('Не удалось проверить сессию:', error)); }
else if (isConfigured) { state.setupMessage = 'Supabase не загрузился. Открой сайт через Live Server и проверь интернет/CDN.'; render(); }
function initCursorStars() {
  const field = document.querySelector('.star-field');
  if (!field || matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;

  const stars = Array.from({ length: 72 }, () => {
    const star = document.createElement('i');
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    star.className = 'cursor-star';
    star.style.left = `${x}%`;
    star.style.top = `${y}%`;
    star.dataset.x = x;
    star.dataset.y = y;
    field.append(star);
    return star;
  });

  let pointer = null;
  let frame = 0;
  const repel = () => {
    frame = 0;
    const radius = 180;
    for (const star of stars) {
      let pushX = 0;
      let pushY = 0;
      if (pointer) {
        const dx = star.dataset.x / 100 * innerWidth - pointer.x;
        const dy = star.dataset.y / 100 * innerHeight - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius && distance > 0) {
          const push = (1 - distance / radius) * 58;
          pushX = dx / distance * push;
          pushY = dy / distance * push;
        }
      }
      star.style.setProperty('--push-x', `${pushX.toFixed(1)}px`);
      star.style.setProperty('--push-y', `${pushY.toFixed(1)}px`);
    }
  };
  const scheduleRepel = () => {
    if (!frame) frame = requestAnimationFrame(repel);
  };

  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    scheduleRepel();
  }, { passive: true });
  window.addEventListener('pointerleave', () => {
    pointer = null;
    scheduleRepel();
  });
}
initCursorStars();
window.addEventListener('load', () => document.body.classList.add('is-ready'));
