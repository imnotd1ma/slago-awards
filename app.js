const FALLBACK_NOMINATIONS = [
  ['legend-year', 'Легенда года'], ['golden-burger', 'Премия золотого бургера'], ['doter-year', 'Дотер года'],
  ['xer-year', 'Ксер года'], ['meme-year', 'Мем года'], ['zavoz-year', 'Завоз года'],
  ['active-year', 'Актив года'], ['zavoz-year-2', 'Завоз года II'], ['toxic-year', 'Токсик года']
].map(([slug, title], index) => ({
  id: slug,
  title,
  index: index + 1,
  nominees: [1, 2, 3].map(number => ({ id: `${slug}-placeholder-${number}`, name: '???' }))
}));

// Заполни эти значения из Supabase Dashboard → Project Settings → API.
const SUPABASE_URL = 'https://cixxcrjvlgthtfhsujib.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z71xb3gpC5_ZnuXs7PlPCg_oTpjguU5';
const isConfigured = !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_');
// Карточки не должны зависеть от загрузки CDN: если Supabase временно недоступен,
// сайт всё равно показывает стартовые номинации.
let supabaseClient = null;
if (isConfigured && window.supabase?.createClient) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error('Supabase не запустился:', error);
  }
}

const state = { nominations: FALLBACK_NOMINATIONS, choices: new Map(), user: null, remoteNominations: false, setupMessage: '' };
const grid = document.querySelector('#nominationGrid');
const authButton = document.querySelector('#authButton');
const submitButton = document.querySelector('#submitVote');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const submitHint = document.querySelector('#submitHint');
let toastTimer;

function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400); }
function render() {
  grid.innerHTML = state.nominations.map(n => `<article class="nomination ${state.choices.has(n.id) ? 'chosen' : ''}"><span class="nomination-index">НОМИНАЦИЯ ${String(n.index).padStart(2, '0')}</span><h3>${n.title}</h3><p>Выбери одного номинанта</p><div class="person-options">${n.nominees.map((person, i) => `<button class="person ${state.choices.get(n.id) === person.id ? 'selected' : ''}" data-category="${n.id}" data-person="${person.id}">${person.name || person}</button>`).join('')}</div></article>`).join('');
  grid.querySelectorAll('.person').forEach(button => button.addEventListener('click', () => { state.choices.set(button.dataset.category, button.dataset.person); render(); }));
  const count = state.choices.size; progressText.textContent = `${count} из ${state.nominations.length} выбрано`; progressBar.style.width = `${count / state.nominations.length * 100}%`;
  submitButton.disabled = count !== state.nominations.length || !state.user || !state.remoteNominations;
  submitHint.textContent = state.setupMessage || (!state.user ? 'Войди через Discord, чтобы твой голос был засчитан.' : count === state.nominations.length ? 'Всё готово. Проверь выбор и отправь бюллетень.' : 'Выбери номинанта в каждой категории, чтобы отправить голос.');
}
async function loadNominations() {
  if (!supabaseClient) return render();
  const { data, error } = await supabaseClient.from('nominations').select('id, slug, title, sort_order, nominees(id, name, sort_order)').eq('is_active', true).order('sort_order').order('sort_order', { foreignTable: 'nominees' });
  if (error || !data?.length) {
    if (error) {
      console.warn('Ошибка загрузки бюллетеня:', error.message);
      state.setupMessage = `Бюллетень временный: Supabase не вернул номинации (${error.message}).`;
    } else {
      state.setupMessage = 'В Supabase пока нет активных номинаций. Выполни supabase/schema.sql.';
    }
    return render();
  }
  state.nominations = data.map((n, i) => ({ id: n.id, title: n.title, index: i + 1, nominees: (n.nominees || []).map(x => ({ id: x.id, name: x.name })) }));
  state.remoteNominations = true;
  render();
}
async function syncUser() { if (!supabaseClient) return; const { data: { session } } = await supabaseClient.auth.getSession(); state.user = session?.user ?? null; authButton.textContent = state.user ? `Вышел: ${state.user.user_metadata.full_name || state.user.email}` : 'Войти через Discord'; render(); }
authButton.addEventListener('click', async () => {
  if (!supabaseClient) return toast(isConfigured ? 'Supabase не загрузился. Запусти сайт через Live Server и обнови страницу.' : 'Добавь ключи Supabase в app.js.');
  if (state.user) { await supabaseClient.auth.signOut(); toast('Вы вышли из аккаунта.'); return; }
  if (window.location.protocol === 'file:') return toast('Сначала запусти сайт через Live Server, а не двойным кликом по index.html.');
  const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.href.split('#')[0] } });
  if (error) toast(`Ошибка входа: ${error.message}`);
});
submitButton.addEventListener('click', async () => { if (!state.user || !supabaseClient) return; submitButton.disabled = true; const rows = [...state.choices].map(([nomination_id, nominee_id]) => ({ nomination_id, nominee_id, voter_id: state.user.id })); const { error } = await supabaseClient.from('votes').insert(rows); if (error) { toast(error.code === '23505' ? 'Ваш голос уже был принят.' : `Не удалось отправить: ${error.message}`); render(); return; } toast('Голос принят. Спасибо за выбор!'); grid.querySelectorAll('.person').forEach(b => b.disabled = true); submitHint.textContent = 'Твой бюллетень уже отправлен.'; });
render();
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(() => syncUser());
  loadNominations().catch(error => { console.warn('Не удалось загрузить номинации:', error); });
  syncUser().catch(error => console.warn('Не удалось проверить сессию:', error));
} else if (isConfigured) {
  console.warn('Библиотека Supabase не загрузилась. Показаны временные номинации.');
  state.setupMessage = 'Supabase не загрузился. Открой сайт через Live Server и проверь интернет/CDN.';
  render();
}
