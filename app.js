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
const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY';
const isConfigured = !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_');
const supabase = isConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = { nominations: FALLBACK_NOMINATIONS, choices: new Map(), user: null };
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
  submitButton.disabled = count !== state.nominations.length || !state.user;
  submitHint.textContent = !state.user ? 'Войди через Discord, чтобы твой голос был засчитан.' : count === state.nominations.length ? 'Всё готово. Проверь выбор и отправь бюллетень.' : 'Выбери номинанта в каждой категории, чтобы отправить голос.';
}
async function loadNominations() {
  if (!supabase) return render();
  const { data, error } = await supabase.from('nominations').select('id, slug, title, sort_order, nominees(id, name, sort_order)').eq('is_active', true).order('sort_order').order('sort_order', { foreignTable: 'nominees' });
  if (error || !data?.length) { if (error) console.warn(error.message); return render(); }
  state.nominations = data.map((n, i) => ({ id: n.id, title: n.title, index: i + 1, nominees: (n.nominees || []).map(x => ({ id: x.id, name: x.name })) })); render();
}
async function syncUser() { if (!supabase) return; const { data: { session } } = await supabase.auth.getSession(); state.user = session?.user ?? null; authButton.textContent = state.user ? `Вышел: ${state.user.user_metadata.full_name || state.user.email}` : 'Войти через Discord'; render(); }
authButton.addEventListener('click', async () => { if (!supabase) return toast('Добавь ключи Supabase в app.js — инструкция есть в README.'); if (state.user) { await supabase.auth.signOut(); toast('Вы вышли из аккаунта.'); return; } const { error } = await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.origin + window.location.pathname } }); if (error) toast(`Ошибка входа: ${error.message}`); });
submitButton.addEventListener('click', async () => { if (!state.user || !supabase) return; submitButton.disabled = true; const rows = [...state.choices].map(([nomination_id, nominee_id]) => ({ nomination_id, nominee_id, voter_id: state.user.id })); const { error } = await supabase.from('votes').insert(rows); if (error) { toast(error.code === '23505' ? 'Ваш голос уже был принят.' : `Не удалось отправить: ${error.message}`); render(); return; } toast('Голос принят. Спасибо за выбор!'); grid.querySelectorAll('.person').forEach(b => b.disabled = true); submitHint.textContent = 'Твой бюллетень уже отправлен.'; });
if (supabase) supabase.auth.onAuthStateChange(() => syncUser());
loadNominations(); syncUser();
