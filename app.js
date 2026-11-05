const FALLBACK_NOMINATIONS = [
  ['legend-year', 'Легенда года', ['Максим Ветш', 'Ярослав Ханчиков', 'Леня Шоколадный-Гений', 'Дмитрий Липтон', 'Семён Мазалов', 'Ярослав Блессед', 'Илья Монеси', 'Михаил Потужнич', 'Геннадий Арбузов', 'Павлик', 'Ваня Шпага', 'Максим Лосс', 'Антон Шурупов', 'Даня Ед']],
  ['meme-year', 'Мем года', ['Дима Шуруп', 'Матвей tea_bag', 'Илья Монеси', 'Павлик']],
  ['active-year', 'Актив года', ['Григорий Грейроков', 'Максим Ветш', 'Матвей tea_bag', 'Владислав Яторович', 'Павлик']],
  ['xer-year', 'Ксер года', ['Дмитрий Клатчер', 'Максим Лосс', 'Ваня Шпага', 'Григорий Грейроков', 'Матвей tea_bag']],
  ['golden-burger', 'Премия золотого бургера', ['Ярик Ханчиков', 'Павлик', 'Даня Ед.', 'Семён Мазалов']],
  ['zavoz-year', 'Завоз года', ['Миша (война с бобруйском)', 'Дима Липтон (10 стаков алмазов)']],
  ['doter-year', 'Дотер года', ['Даня Ед', 'Владислав Яторович', 'Павлик', 'Леня Шоколадный-Гений', 'Дима Липтон']],
  ['ivan-zolo-year', 'Иван Золо года', ['Максим Ветш', 'Илья Монеси', 'Айвар', 'Даня Ед']],
  ['toxic-year', 'Токсик года', ['Геннадий Арбузов', 'Матвей tea_bag', 'Павлик', 'Григорий Грейроков']],
  ['charisma-year', 'Харизма года', ['Павлик', 'Максим Лосс']],
  ['good-guy-year', 'Добряк года', ['Илья Монеси', 'Даниил Пенни', 'Дмитрий Клатчер', 'Коля Азотов', 'Ярослав Блессед']],
  ['sex-symbol-year', 'Секс символ года', ['Меха', 'Матвей tea_bag', 'Семён Мазалов', 'Ярослав Ханчиков', 'Павлик']]
].map(([id, title, names], index) => ({ id, title, index: index + 1, isFeatured: index < 3, nominees: names.map((name, nomineeIndex) => ({ id: `${id}-${nomineeIndex + 1}`, name, avatarUrl: '' })) }));

const SUPABASE_URL = 'https://yerptwwacgjftjpsfmdi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FqrZcdtx_rizOPJBFULWXg_cj7oS9X7';
const isConfigured = !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_');
let supabaseClient = null;
if (isConfigured && window.supabase?.createClient) {
  try { supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (error) { console.error('Supabase не запустился:', error); }
}

const state = { nominations: FALLBACK_NOMINATIONS, players: [], choices: new Map(), user: null, remoteNominations: false, votingAccepting: false, startsAt: null, endsAt: null, setupMessage: '', closedSlide: 0, closedDirection: 0 };
const grid = document.querySelector('#nominationGrid');
const authButton = document.querySelector('#authButton');
const adminLink = document.querySelector('#adminLink');
const votingStatus = document.querySelector('#votingStatus');
const submitButton = document.querySelector('#submitVote');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const submitHint = document.querySelector('#submitHint');
let toastTimer;
let countdownTimer;

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
  return `<span class="candidate-avatar ${url ? 'has-image' : ''}"><b>${initial}</b>${url ? `<img${url} alt="" loading="lazy">` : ''}</span>`;
}
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400); }
function selectedName(choice) { return choice?.type === 'custom' ? choice.name : choice?.name; }
function updateProgress() {
  const count = state.choices.size;
  progressText.textContent = `${count} из ${state.nominations.length} выбрано`;
  progressBar.style.width = `${count / state.nominations.length * 100}%`;
  submitButton.disabled = count !== state.nominations.length || !state.user || !state.remoteNominations || !state.votingAccepting;
  submitHint.textContent = state.setupMessage || (!state.votingAccepting ? 'Голосование сейчас закрыто или ещё не началось.' : !state.user ? 'Войди через Discord, чтобы твой голос был засчитан.' : count === state.nominations.length ? 'Всё готово. Проверь выбор и отправь бюллетень.' : 'Выбери кандидата в каждой номинации.');
}
function updateChoiceUI(nominationId) {
  const nomination = state.nominations.find(item => item.id === nominationId);
  const card = grid.querySelector(`[data-nomination-card="${CSS.escape(nominationId)}"]`);
  if (!nomination || !card) return;
  const choice = state.choices.get(nominationId);
  card.classList.toggle('chosen', Boolean(choice));
  const prompt = card.querySelector('.nomination-prompt');
  prompt.textContent = choice ? `Выбрано: ${selectedName(choice)}` : 'Выбери одного кандидата';
  card.querySelectorAll('.candidate').forEach(button => {
    const selected = choice?.type === 'existing' && choice.id === button.dataset.person;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  updateProgress();
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
function reconcileCrossChoices() {
  for (const [nominationId, choice] of state.choices) {
    if (choice.type !== 'cross') continue;
    const nomination = state.nominations.find(item => item.id === nominationId);
    const player = state.players.find(item => choice.discordId
      ? item.discordId === choice.discordId
      : item.id === (choice.playerId || choice.id));
    if (!nomination || !player || playerAlreadyNominated(player, nomination)) {
      state.choices.delete(nominationId);
      continue;
    }
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
  closedVoting.hidden = !isClosed;
  grid.hidden = isClosed;
  sectionHeading.classList.toggle('is-closed-view', isClosed);
  submitWrap.hidden = isClosed;
  if (isClosed) {
    renderClosedNominations();
    updateProgress();
    return;
  }
  const nominationCard = nomination => {
    const choice = state.choices.get(nomination.id);
    const isZavoz = nomination.slug?.startsWith('zavoz-year');
    const candidates = nomination.nominees.map(person => `<button class="candidate ${choice?.type === 'existing' && choice.id === person.id ? 'selected' : ''}" type="button" data-nomination="${escapeHTML(nomination.id)}" data-person="${escapeHTML(person.id)}" aria-pressed="${choice?.type === 'existing' && choice.id === person.id}">${avatarMarkup(person)}<span class="candidate-name">${escapeHTML(person.name)}</span><i>✓</i>${isZavoz && person.description ? `<span class="candidate-description">${escapeHTML(person.description)}</span>` : ''}</button>`).join('');
    const customName = choice?.type === 'cross' ? choice.name : '';
    return `<article class="nomination ${choice ? 'chosen' : ''}" data-nomination-card="${escapeHTML(nomination.id)}" style="animation-delay:${nomination.index * 55}ms"><span class="nomination-index">№ ${String(nomination.index).padStart(2, '0')}</span><h3>${escapeHTML(nomination.title)}</h3><p class="nomination-prompt">${choice ? `Выбрано: ${escapeHTML(selectedName(choice))}` : 'Выбери одного кандидата'}</p><div class="nomination-candidates">${candidates}</div><label class="custom-label" for="custom-${escapeHTML(nomination.id)}">Или выбери другого пользователя</label><div class="custom-picker"><input id="custom-${escapeHTML(nomination.id)}" class="custom-input" data-custom-nomination="${escapeHTML(nomination.id)}" maxlength="70" autocomplete="off" placeholder="Начни вводить имя" value="${escapeHTML(customName)}" /><div class="person-suggestions" role="listbox" hidden></div></div></article>`;
  };
  grid.innerHTML = state.nominations.map(nominationCard).join('');
  grid.querySelectorAll('.candidate').forEach(button => button.addEventListener('click', () => {
    const nomination = state.nominations.find(item => item.id === button.dataset.nomination);
    const person = nomination?.nominees.find(item => item.id === button.dataset.person);
    if (!nomination || !person) return;
    state.choices.set(nomination.id, { type: 'existing', id: person.id, name: person.name });
    const customInput = grid.querySelector(`[data-custom-nomination="${CSS.escape(nomination.id)}"]`);
    if (customInput) { customInput.value = ''; customInput.parentElement.querySelector('.person-suggestions').hidden = true; }
    updateChoiceUI(nomination.id);
  }));
  grid.querySelectorAll('[data-custom-nomination]').forEach(input => input.addEventListener('input', () => {
    const nominationId = input.dataset.customNomination;
    state.choices.delete(nominationId);
    showOtherNomineeSuggestions(input);
    updateChoiceUI(nominationId);
  }));
  updateProgress();
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
  const { data, error } = await supabaseClient.from('slago_nominations').select('id, slug, title, sort_order, is_featured, slago_nominees(id, name, description, discord_id, discord_username, avatar_url, sort_order)').eq('is_active', true).order('sort_order').order('sort_order', { foreignTable: 'slago_nominees' });
  if (error || !data?.length) {
    state.setupMessage = error ? `Бюллетень временный: Supabase не вернул номинации (${error.message}).` : 'В Supabase пока нет активных номинаций. Выполни supabase/schema.sql.';
    return render();
  }
  const nextNominations = data.map((item, index) => ({ id: item.id, slug: item.slug, title: item.title, index: index + 1, isFeatured: item.is_featured === true, nominees: (item.slago_nominees || []).map(person => ({ id: person.id, name: person.name, description: person.description || '', discordId: person.discord_id, discordUsername: person.discord_username, avatarUrl: person.avatar_url || '' })) }));
  state.nominations = nextNominations;
  const activeNominationIds = new Set(nextNominations.map(item => item.id));
  for (const [nominationId, choice] of state.choices) {
    if (!activeNominationIds.has(nominationId)) state.choices.delete(nominationId);
    else if (choice.type === 'existing' && !nextNominations.find(item => item.id === nominationId)?.nominees.some(person => person.id === choice.id)) state.choices.delete(nominationId);
  }
  reconcileCrossChoices();
  state.remoteNominations = true; render();
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
  reconcileCrossChoices();
  render();
}
async function syncUser() { if (!supabaseClient) return; const { data: { session } } = await supabaseClient.auth.getSession(); state.user = session?.user ?? null; authButton.textContent = state.user ? `Выйти: ${state.user.user_metadata.full_name || state.user.email}` : 'Войти через Discord'; if (state.user && adminLink) { const { data: isAdmin, error } = await supabaseClient.rpc('is_slago_admin'); adminLink.hidden = error || isAdmin !== true; } else if (adminLink) adminLink.hidden = true; updateProgress(); }
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
submitButton.addEventListener('click', async () => {
  if (!state.user || !supabaseClient) return;
  submitButton.disabled = true;
  const rows = [...state.choices].map(([nomination_id, choice]) => ({ nomination_id, voter_id: state.user.id, nominee_id: choice.type === 'existing' ? choice.id : null, custom_nominee: choice.type === 'cross' ? choice.name : null, custom_nominee_discord_id: choice.type === 'cross' ? choice.discordId || null : null }));
  const { error } = await supabaseClient.from('slago_votes').insert(rows);
  if (error) { toast(error.code === '23505' ? 'Ваш голос уже был принят.' : error.message.includes('VOTING_CLOSED') ? 'Голосование закрыто.' : `Не удалось отправить: ${error.message}`); await loadVotingStatus(); updateProgress(); return; }
  toast('Голос принят. Спасибо за выбор!'); submitHint.textContent = 'Твой бюллетень уже отправлен.'; grid.querySelectorAll('.candidate, [data-custom-nomination]').forEach(control => control.disabled = true);
});
render();
document.querySelector('#nominationPrev').addEventListener('click', () => { state.closedDirection = -1; state.closedSlide--; renderClosedNominations(); });
document.querySelector('#nominationNext').addEventListener('click', () => { state.closedDirection = 1; state.closedSlide++; renderClosedNominations(); });
countdownTimer = setInterval(updateCountdown, 1000);
if (supabaseClient) { supabaseClient.auth.onAuthStateChange(() => syncUser()); loadNominations().catch(error => { console.warn('Не удалось загрузить номинации:', error); }); loadPlayers().catch(error => console.warn('Не удалось загрузить игроков:', error)); loadVotingStatus(); setInterval(loadVotingStatus, 30000); subscribeToNominationChanges(); syncUser().catch(error => console.warn('Не удалось проверить сессию:', error)); }
else if (isConfigured) { state.setupMessage = 'Supabase не загрузился. Открой сайт через Live Server и проверь интернет/CDN.'; render(); }
window.addEventListener('load', () => document.body.classList.add('is-ready'));
