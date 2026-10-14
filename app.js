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

const state = { nominations: FALLBACK_NOMINATIONS, choices: new Map(), user: null, remoteNominations: false, setupMessage: '' };
const grid = document.querySelector('#nominationGrid');
const authButton = document.querySelector('#authButton');
const submitButton = document.querySelector('#submitVote');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const submitHint = document.querySelector('#submitHint');
let toastTimer;

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
  submitButton.disabled = count !== state.nominations.length || !state.user || !state.remoteNominations;
  submitHint.textContent = state.setupMessage || (!state.user ? 'Войди через Discord, чтобы твой голос был засчитан.' : count === state.nominations.length ? 'Всё готово. Проверь выбор и отправь бюллетень.' : 'Выбери кандидата в каждой номинации.');
}
function render() {
  const nominationCard = nomination => {
    const choice = state.choices.get(nomination.id);
    const candidates = nomination.nominees.map(person => `<button class="candidate ${choice?.type === 'existing' && choice.id === person.id ? 'selected' : ''}" type="button" data-nomination="${escapeHTML(nomination.id)}" data-person="${escapeHTML(person.id)}" aria-pressed="${choice?.type === 'existing' && choice.id === person.id}">${avatarMarkup(person)}<span class="candidate-name">${escapeHTML(person.name)}</span><i>✓</i></button>`).join('');
    const customName = choice?.type === 'custom' ? choice.name : '';
    return `<article class="nomination ${choice ? 'chosen' : ''}" style="animation-delay:${nomination.index * 55}ms"><span class="nomination-index">№ ${String(nomination.index).padStart(2, '0')}</span><h3>${escapeHTML(nomination.title)}</h3><p class="nomination-prompt">${choice ? `Выбрано: ${escapeHTML(selectedName(choice))}` : 'Выбери одного кандидата'}</p><div class="nomination-candidates">${candidates}</div><label class="custom-label" for="custom-${escapeHTML(nomination.id)}">Или предложи своего</label><input id="custom-${escapeHTML(nomination.id)}" class="custom-input" data-custom-nomination="${escapeHTML(nomination.id)}" maxlength="70" autocomplete="off" placeholder="Имя номинанта" value="${escapeHTML(customName)}" /></article>`;
  };
  grid.innerHTML = state.nominations.map(nominationCard).join('');
  grid.querySelectorAll('.candidate').forEach(button => button.addEventListener('click', () => {
    const nomination = state.nominations.find(item => item.id === button.dataset.nomination);
    const person = nomination?.nominees.find(item => item.id === button.dataset.person);
    if (!nomination || !person) return;
    state.choices.set(nomination.id, { type: 'existing', id: person.id, name: person.name });
    render();
  }));
  grid.querySelectorAll('[data-custom-nomination]').forEach(input => input.addEventListener('change', () => {
    const nominationId = input.dataset.customNomination;
    const customName = input.value.trim().replace(/\s+/g, ' ');
    if (customName) state.choices.set(nominationId, { type: 'custom', name: customName });
    else if (state.choices.get(nominationId)?.type === 'custom') state.choices.delete(nominationId);
    render();
  }));
  updateProgress();
}
async function loadNominations() {
  if (!supabaseClient) return render();
  const { data, error } = await supabaseClient.from('slago_nominations').select('id, slug, title, sort_order, is_featured, slago_nominees(id, name, discord_username, avatar_url, sort_order)').eq('is_active', true).order('sort_order').order('sort_order', { foreignTable: 'slago_nominees' });
  if (error || !data?.length) {
    state.setupMessage = error ? `Бюллетень временный: Supabase не вернул номинации (${error.message}).` : 'В Supabase пока нет активных номинаций. Выполни supabase/schema.sql.';
    return render();
  }
  state.nominations = data.map((item, index) => ({ id: item.id, title: item.title, index: index + 1, isFeatured: item.is_featured === true, nominees: (item.slago_nominees || []).map(person => ({ id: person.id, name: person.name, avatarUrl: person.avatar_url || '' })) }));
  state.remoteNominations = true; render();
}
async function syncUser() { if (!supabaseClient) return; const { data: { session } } = await supabaseClient.auth.getSession(); state.user = session?.user ?? null; authButton.textContent = state.user ? `Выйти: ${state.user.user_metadata.full_name || state.user.email}` : 'Войти через Discord'; render(); }
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
  const rows = [...state.choices].map(([nomination_id, choice]) => ({ nomination_id, voter_id: state.user.id, nominee_id: choice.type === 'existing' ? choice.id : null, custom_nominee: choice.type === 'custom' ? choice.name : null }));
  const { error } = await supabaseClient.from('slago_votes').insert(rows);
  if (error) { toast(error.code === '23505' ? 'Ваш голос уже был принят.' : `Не удалось отправить: ${error.message}`); render(); return; }
  toast('Голос принят. Спасибо за выбор!'); submitHint.textContent = 'Твой бюллетень уже отправлен.'; grid.querySelectorAll('.candidate, [data-custom-nomination]').forEach(control => control.disabled = true);
});
render();
if (supabaseClient) { supabaseClient.auth.onAuthStateChange(() => syncUser()); loadNominations().catch(error => { console.warn('Не удалось загрузить номинации:', error); }); syncUser().catch(error => console.warn('Не удалось проверить сессию:', error)); }
else if (isConfigured) { state.setupMessage = 'Supabase не загрузился. Открой сайт через Live Server и проверь интернет/CDN.'; render(); }
window.addEventListener('load', () => document.body.classList.add('is-ready'));
