const FALLBACK_NOMINATIONS = [
  ['legend-year', 'Легенда года'], ['golden-burger', 'Премия золотого бургера'], ['doter-year', 'Дотер года'],
  ['xer-year', 'Ксер года'], ['meme-year', 'Мем года'], ['zavoz-year', 'Завоз года'],
  ['active-year', 'Актив года'], ['zavoz-year-2', 'Завоз года II'], ['toxic-year', 'Токсик года']
].map(([id, title], index) => ({ id, title, index: index + 1, nominees: [1, 2, 3].map(number => ({ id: `${id}-placeholder-${number}`, name: '???' })) }));

const SUPABASE_URL = 'https://cixxcrjvlgthtfhsujib.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z71xb3gpC5_ZnuXs7PlPCg_oTpjguU5';
const isConfigured = !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_');
let supabaseClient = null;
if (isConfigured && window.supabase?.createClient) {
  try { supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (error) { console.error('Supabase не запустился:', error); }
}

const state = { nominations: FALLBACK_NOMINATIONS, choices: new Map(), user: null, remoteNominations: false, setupMessage: '', activeNomination: null };
const grid = document.querySelector('#nominationGrid');
const authButton = document.querySelector('#authButton');
const submitButton = document.querySelector('#submitVote');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const submitHint = document.querySelector('#submitHint');
const modal = document.querySelector('#voteModal');
const modalTitle = document.querySelector('#modalTitle');
const modalCandidates = document.querySelector('#modalCandidates');
const customNominee = document.querySelector('#customNominee');
const modalError = document.querySelector('#modalError');
const confirmNominee = document.querySelector('#confirmNominee');
let toastTimer;

function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]); }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3400); }
function selectedName(choice) { return choice?.type === 'custom' ? choice.name : choice?.name; }
function updateProgress() {
  const count = state.choices.size;
  progressText.textContent = `${count} из ${state.nominations.length} выбрано`;
  progressBar.style.width = `${count / state.nominations.length * 100}%`;
  submitButton.disabled = count !== state.nominations.length || !state.user || !state.remoteNominations;
  submitHint.textContent = state.setupMessage || (!state.user ? 'Войди через Discord, чтобы твой голос был засчитан.' : count === state.nominations.length ? 'Всё готово. Проверь выбор и отправь бюллетень.' : 'Открой каждую номинацию и выбери достойного кандидата.');
}
function render() {
  grid.innerHTML = state.nominations.map(nomination => {
    const choice = state.choices.get(nomination.id);
    const actionText = choice ? escapeHTML(selectedName(choice)) : 'Выбрать номинанта';
    return `<article class="nomination ${choice ? 'chosen' : ''}" style="animation-delay:${nomination.index * 45}ms"><span class="nomination-index">НОМИНАЦИЯ ${String(nomination.index).padStart(2, '0')}</span><h3>${escapeHTML(nomination.title)}</h3><p>${choice ? (choice.type === 'custom' ? 'Твой номинант' : 'Главный номинант') : 'Выбери одного достойного кандидата'}</p><button class="nomination-action" type="button" data-nomination="${escapeHTML(nomination.id)}"><span>${actionText}</span><span>${choice ? '✓' : '→'}</span></button></article>`;
  }).join('');
  grid.querySelectorAll('.nomination-action').forEach(button => button.addEventListener('click', () => openModal(button.dataset.nomination)));
  updateProgress();
}
function openModal(nominationId) {
  const nomination = state.nominations.find(item => item.id === nominationId);
  if (!nomination) return;
  state.activeNomination = nomination;
  const choice = state.choices.get(nomination.id);
  modalTitle.textContent = nomination.title;
  customNominee.value = choice?.type === 'custom' ? choice.name : '';
  modalError.textContent = '';
  modalCandidates.innerHTML = nomination.nominees.map(person => `<button class="candidate ${choice?.type === 'existing' && choice.id === person.id ? 'selected' : ''}" type="button" data-person="${escapeHTML(person.id)}"><span>${escapeHTML(person.name)}</span><i>✓</i></button>`).join('');
  modalCandidates.querySelectorAll('.candidate').forEach(button => button.addEventListener('click', () => {
    customNominee.value = '';
    modalCandidates.querySelectorAll('.candidate').forEach(item => item.classList.toggle('selected', item === button));
    modalError.textContent = '';
  }));
  modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  setTimeout(() => modalCandidates.querySelector('.selected, .candidate')?.focus(), 50);
}
function closeModal() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; state.activeNomination = null; }
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
customNominee.addEventListener('input', () => { if (customNominee.value.trim()) modalCandidates.querySelectorAll('.candidate').forEach(item => item.classList.remove('selected')); modalError.textContent = ''; });
confirmNominee.addEventListener('click', () => {
  const nomination = state.activeNomination;
  if (!nomination) return;
  const customName = customNominee.value.trim().replace(/\s+/g, ' ');
  const selected = modalCandidates.querySelector('.candidate.selected');
  if (customName) state.choices.set(nomination.id, { type: 'custom', name: customName });
  else if (selected) { const person = nomination.nominees.find(item => item.id === selected.dataset.person); state.choices.set(nomination.id, { type: 'existing', id: person.id, name: person.name }); }
  else { modalError.textContent = 'Выбери кандидата или напиши своего.'; return; }
  closeModal(); render();
});
async function loadNominations() {
  if (!supabaseClient) return render();
  const { data, error } = await supabaseClient.from('nominations').select('id, slug, title, sort_order, nominees(id, name, sort_order)').eq('is_active', true).order('sort_order').order('sort_order', { foreignTable: 'nominees' });
  if (error || !data?.length) {
    state.setupMessage = error ? `Бюллетень временный: Supabase не вернул номинации (${error.message}).` : 'В Supabase пока нет активных номинаций. Выполни supabase/schema.sql.';
    return render();
  }
  state.nominations = data.map((item, index) => ({ id: item.id, title: item.title, index: index + 1, nominees: (item.nominees || []).map(person => ({ id: person.id, name: person.name })) }));
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
  const { error } = await supabaseClient.from('votes').insert(rows);
  if (error) { toast(error.code === '23505' ? 'Ваш голос уже был принят.' : `Не удалось отправить: ${error.message}`); render(); return; }
  toast('Голос принят. Спасибо за выбор!'); submitHint.textContent = 'Твой бюллетень уже отправлен.'; grid.querySelectorAll('.nomination-action').forEach(button => button.disabled = true);
});
render();
if (supabaseClient) { supabaseClient.auth.onAuthStateChange(() => syncUser()); loadNominations().catch(error => { console.warn('Не удалось загрузить номинации:', error); }); syncUser().catch(error => console.warn('Не удалось проверить сессию:', error)); }
else if (isConfigured) { state.setupMessage = 'Supabase не загрузился. Открой сайт через Live Server и проверь интернет/CDN.'; render(); }
