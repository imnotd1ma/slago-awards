const SUPABASE_URL = 'https://yerptwwacgjftjpsfmdi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FqrZcdtx_rizOPJBFULWXg_cj7oS9X7';
const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = selector => document.querySelector(selector);
const adminAuth = $('#adminAuth');
const adminMessage = $('#adminMessage');
const adminControls = $('#adminControls');
const adminDashboard = $('#adminDashboard');
let currentData;

function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]); }
function discordIdFromUser(user) {
  const metadataId = user?.user_metadata?.provider_id || user?.user_metadata?.sub;
  if (metadataId) return String(metadataId);
  const identity = user?.identities?.find(item => item.provider === 'discord');
  const identityId = identity?.identity_data?.sub || identity?.identity_data?.provider_id;
  return identityId ? String(identityId) : '';
}
function moscowParts(value) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
}
function toMoscowInput(value) {
  if (!value) return '';
  const parts = moscowParts(value);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function moscowInputToISO(value) {
  return value ? new Date(`${value}:00+03:00`).toISOString() : null;
}
function formatMoscow(value) {
  if (!value) return 'не задано';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(value));
}
function updateVotingPeriod(settings) {
  $('#votingPeriod').textContent = !settings.starts_at && !settings.ends_at
    ? 'Период голосования не задан'
    : `Период: ${formatMoscow(settings.starts_at)} — ${formatMoscow(settings.ends_at)} МСК`;
}
function setMessage(message, error = false) { adminMessage.textContent = message; adminMessage.classList.toggle('is-error', error); }
function setSettings(settings) {
  $('#votingOpen').checked = settings.is_open;
  $('#votingStateLabel').textContent = settings.accepting_votes ? 'Голосование открыто' : settings.is_open ? 'Ожидает расписания' : 'Голосование закрыто';
  $('#votingStarts').value = toMoscowInput(settings.starts_at);
  $('#votingEnds').value = toMoscowInput(settings.ends_at);
  updateVotingPeriod(settings);
  $('#resultsFinal').checked = settings.results_final;
  $('#resultsState').textContent = settings.results_final ? 'Окончательные' : 'Предварительные';
}
function renderData(data) {
  currentData = data;
  setSettings(data.settings);
  $('#voteCount').textContent = data.vote_count;
  $('#voterCount').textContent = data.voter_count;
  const filter = $('#historyFilter');
  const previousValue = filter.value;
  const nominations = [...new Map(data.statistics.map(item => [item.nomination_id, item.nomination_title])).entries()];
  filter.innerHTML = '<option value="">Все номинации</option>' + nominations.map(([id, title]) => `<option value="${escapeHTML(id)}">${escapeHTML(title)}</option>`).join('');
  filter.value = previousValue;

  const stats = new Map();
  for (const item of data.statistics) {
    if (!stats.has(item.nomination_id)) stats.set(item.nomination_id, { title: item.nomination_title, rows: [] });
    stats.get(item.nomination_id).rows.push(item);
  }
  $('#resultsTable').innerHTML = [...stats.entries()].map(([id, group]) => {
    const total = group.rows.reduce((sum, row) => sum + row.votes, 0);
    return `<article class="result-group"><header><h3>${escapeHTML(group.title)}</h3><span>${total} голосов</span></header>${group.rows.map(row => `<div class="result-row"><span>${escapeHTML(row.nominee_name)}</span><span>${row.votes}</span><i style="width:${total ? row.votes / total * 100 : 0}%"></i></div>`).join('')}</article>`;
  }).join('');
  renderHistory();
}
function renderHistory() {
  if (!currentData) return;
  const nominationId = $('#historyFilter').value;
  const votes = currentData.votes.filter(vote => !nominationId || vote.nomination_id === nominationId);
  $('#historyRows').innerHTML = votes.length ? votes.map(vote => {
    const discordLogin = vote.discord_username || '';
    const voterLabel = discordLogin || vote.voter_name;
    const secondaryLabel = discordLogin && vote.voter_name !== discordLogin ? vote.voter_name : '';
    return `<tr><td>${new Date(vote.created_at).toLocaleString('ru-RU')}</td><td><span class="history-person">${vote.avatar_url ? `<img src="${escapeHTML(vote.avatar_url)}" alt="" loading="lazy">` : ''}<span>${escapeHTML(voterLabel)}${secondaryLabel ? `<small>${escapeHTML(secondaryLabel)}</small>` : ''}</span></span></td><td>${escapeHTML(vote.nomination_title)}</td><td>${escapeHTML(vote.nominee_name || '—')}</td></tr>`;
  }).join('') : '<tr><td colspan="4" class="empty-history">Голосов пока нет</td></tr>';
}
async function refresh() {
  if (!client) { setMessage('Supabase не загрузился. Обнови страницу.', true); return; }
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    adminControls.hidden = true; adminDashboard.hidden = true; adminAuth.textContent = 'Войти через Discord';
    setMessage('Войди через Discord, чтобы открыть панель администратора.'); return;
  }
  adminAuth.textContent = 'Выйти';
  const { data: isAdmin, error: profileError } = await client.rpc('is_slago_admin');
  if (profileError || isAdmin !== true) {
    adminControls.hidden = true; adminDashboard.hidden = true;
    setMessage(profileError
      ? `Не удалось проверить права: ${profileError.message}`
      : `Для Discord ID ${discordIdFromUser(session.user) || '(не найден)'} не найдена запись с is_admin = true в profiles.`, true);
    return;
  }
  const { data, error } = await client.rpc('get_slago_admin_data');
  if (error) { setMessage(`Не удалось загрузить данные: ${error.message}`, true); return; }
  adminControls.hidden = false; adminDashboard.hidden = false;
  setMessage(`Вход выполнен: ${session.user.user_metadata.full_name || session.user.email}`);
  renderData(data);
}
adminAuth.addEventListener('click', async () => {
  if (!client) return;
  const { data: { session } } = await client.auth.getSession();
  if (session) { await client.auth.signOut(); await refresh(); return; }
  const { error } = await client.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.href.split('#')[0] } });
  if (error) setMessage(error.message, true);
});
$('#refreshAdmin').addEventListener('click', refresh);
$('#historyFilter').addEventListener('change', renderHistory);
$('#votingOpen').addEventListener('change', () => {
  $('#votingStateLabel').textContent = $('#votingOpen').checked ? 'Голосование включено' : 'Голосование закрыто';
});
$('#saveSettings').addEventListener('click', async () => {
  const startsValue = $('#votingStarts').value;
  const endsValue = $('#votingEnds').value;
  const starts = startsValue ? new Date(moscowInputToISO(startsValue)) : null;
  const ends = endsValue ? new Date(moscowInputToISO(endsValue)) : null;
  if (starts && ends && ends <= starts) { $('#saveMessage').textContent = 'Окончание должно быть позже начала.'; return; }
  const { data, error } = await client.rpc('update_slago_vote_settings', {
    requested_open: $('#votingOpen').checked,
    requested_starts_at: starts?.toISOString() || null,
    requested_ends_at: ends?.toISOString() || null,
    requested_results_final: $('#resultsFinal').checked
  });
  if (error) { $('#saveMessage').textContent = `Ошибка: ${error.message}`; return; }
  $('#saveMessage').textContent = 'Сохранено';
  setSettings(data);
  setTimeout(() => { $('#saveMessage').textContent = ''; }, 2500);
});
client?.auth.onAuthStateChange(() => setTimeout(refresh, 0));
refresh();
