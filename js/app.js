// CELOL Roster & Transfers Viewer
// Carrega planilha XLSX (Movimentações + Elencos por time) e renderiza

const ROLE_ORDER = ['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Coach', 'Manager'];
const SISTER_ORGS = [
  ['NKZ VORAX', 'NKZ REVENGERS', 'NKZ Reapers'],
  ['Marere E-Sports', 'Marere Academy'],
  ['Smoke Tram eSports', 'Smoke Tram Ascension'],
  ['Final Level', 'Final Level Academy', 'Final Level Core'],
  ['Ownage Gaming', 'Ownage Black'],
  ['Shark Bite Furious Gaming Black', 'Shark Bite Furious Gaming White'],
  ['Juventus Gaming Red', 'Juventus Gaming White'],
];

let state = {
  teams: [],
  movements: [],
  currentDiv: 'CELOL A',
  editMode: false,
  overrides: {},
  players: {},          // extra info from players.json
};

const STORAGE_KEY = 'celol-overrides';

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.overrides = raw ? JSON.parse(raw) : {};
  } catch {
    state.overrides = {};
  }
}

function saveOverrides() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.overrides));
}

function getOverride(riotId) {
  return state.overrides[riotId] || {};
}

function applyOverride(player) {
  const o = getOverride(player.player);
  return {
    ...player,
    displayNick: o.nick || null,
    displayRole: o.role !== undefined ? o.role : player.role,
  };
}

// ---------- Helpers ----------
function normalizeTeam(name) {
  return String(name || '').replace(/\s*\[.+\]\s*/g, '').replace(/\s*·.*$/, '').trim();
}

function getSisterOrg(teamName) {
  const n = normalizeTeam(teamName);
  for (const group of SISTER_ORGS) {
    if (group.some(t => n.includes(t) || t.includes(n))) return group;
  }
  return null;
}

function cleanNickname(riotId) {
  if (!riotId) return { nick: '—', riot: '' };
  let s = String(riotId).trim();
  // Remove common team-tag prefixes (2-5 uppercase letters + space)
  s = s.replace(/^(NKZ|SBK|SBW|STE|STA|FL|FLA|FLC|MRE|IVT|JUV|NEON|BRX|BOT|DOC|ALV|SCL|VIX|TOR|VKT|PHE|OWN|OWB|SPH|LOS|IGG|MGG|APG|BRX|GLZ|LDG|DNY|LIVE)\s+/i, '');
  // Also generic 2-5 uppercase letters followed by space
  s = s.replace(/^[A-Z]{2,5}\s+/, '');
  const hash = s.indexOf('#');
  const nick = hash > 0 ? s.slice(0, hash).trim() : s;
  return { nick: nick || s, riot: String(riotId).trim() };
}

function renderPlayerRow(p, teamKey) {
  const applied = applyOverride(p);
  const { nick: autoNick, riot } = cleanNickname(p.player);
  const nick = applied.displayNick || autoNick;
  const role = applied.displayRole || '';
  const rc = roleClass(role);
  const hasOverride = !!state.overrides[p.player];

  let html = `<div class="player-row ${state.editMode ? 'editable' : ''}" data-riot="${p.player.replace(/"/g, '"')}" data-team="${teamKey}">
    <span class="role-pill ${rc}">${role || '—'}</span>
    <span class="nickname">${nick}</span>
    <span class="riotid">${riot}</span>
    ${hasOverride ? '<span style="color:#f59e0b;font-size:0.75rem;margin-left:4px;">✎</span>' : ''}
  </div>`;

  if (state.editMode) {
    html += `<div class="edit-panel" style="display:none;" data-panel="${p.player.replace(/"/g, '"')}">
      <label>Nickname</label>
      <input type="text" class="edit-nick" value="${(applied.displayNick || autoNick).replace(/"/g, '"')}">
      <label>Role</label>
      <select class="edit-role">
        <option value="">—</option>
        ${ROLE_ORDER.map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
      <div class="edit-actions">
        <button class="btn-save">Salvar</button>
        <button class="btn-reset">Resetar</button>
        <button class="btn-cancel">Fechar</button>
      </div>
    </div>`;
  }
  return html;
}

function roleClass(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('top')) return 'top';
  if (r.includes('jungle') || r === 'jg') return 'jungle';
  if (r.includes('mid')) return 'mid';
  if (r.includes('bot') || r.includes('adc')) return 'bot';
  if (r.includes('sup')) return 'support';
  if (r.includes('coach')) return 'coach';
  if (r.includes('manager')) return 'manager';
  return 'none';
}

function sortByRole(players) {
  return [...players].sort((a, b) => {
    const ra = (getOverride(a.player).role !== undefined ? getOverride(a.player).role : a.role) || '';
    const rb = (getOverride(b.player).role !== undefined ? getOverride(b.player).role : b.role) || '';
    const ia = ROLE_ORDER.indexOf(ra);
    const ib = ROLE_ORDER.indexOf(rb);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ---------- Parsing ----------
function parseWorkbook(wb) {
  const movSheet = wb.Sheets['Movimentações'] || wb.Sheets[wb.SheetNames[0]];
  const elencoSheet = wb.Sheets['Elencos por time'] || wb.Sheets[wb.SheetNames[1]];

  // Movements
  const movData = XLSX.utils.sheet_to_json(movSheet, { header: 1, defval: '' });
  const movHeader = movData[0].map(h => String(h).trim());
  const movements = [];
  for (let i = 1; i < movData.length; i++) {
    const row = movData[i];
    if (!row[0]) continue;
    const obj = {};
    movHeader.forEach((h, idx) => { obj[h] = row[idx]; });
    movements.push({
      date: obj['Data'] ? new Date(obj['Data']) : null,
      division: obj['Divisão'] || '',
      team: normalizeTeam(obj['Time']),
      tag: obj['Tag'] || '',
      player: obj['Jogador (Riot ID)'] || '',
      role: obj['Função'] || '',
      movement: obj['Movimento'] || '',
      phase: obj['Fase'] || '',
      detail: obj['Detalhe'] || '',
    });
  }
  state.movements = movements.filter(m => m.date && !isNaN(m.date));

  // Elencos
  const elencoData = XLSX.utils.sheet_to_json(elencoSheet, { header: 1, defval: '' });
  const teamsMap = new Map(); // key: division|team
  let currentDiv = null;
  let currentTeam = null;

  for (const row of elencoData) {
    const first = String(row[0] || '').trim();
    if (first === 'CELOL A' || first === 'CELOL B') {
      currentDiv = first;
      continue;
    }
    if (first.includes('[') && first.includes(']')) {
      const teamName = normalizeTeam(first);
      const tagMatch = first.match(/\[([^\]]+)\]/);
      const tag = tagMatch ? tagMatch[1] : '';
      currentTeam = { division: currentDiv, team: teamName, tag, titulares: [], reservas: [] };
      const key = `${currentDiv}|${teamName}`;
      teamsMap.set(key, currentTeam);
      continue;
    }
    if (!first || first === 'Time / Jogador (Riot ID)') continue;
    if (!currentTeam) continue;

    const role = String(row[1] || '').trim();
    const position = String(row[2] || '').trim();
    const status = String(row[6] || '').trim();
    if (status === 'No elenco') {
      const p = { player: first, role: role || '', position };
      if (position === 'Titular') currentTeam.titulares.push(p);
      else if (position === 'Reserva') currentTeam.reservas.push(p);
    }
  }

  state.teams = Array.from(teamsMap.values()).sort((a, b) => a.team.localeCompare(b.team));
}

function getCurrentPlayers() {
  const set = new Set();
  state.teams.forEach(t => {
    [...t.titulares, ...t.reservas].forEach(p => set.add(p.player));
  });
  return set;
}

function computeFreeAgents() {
  const current = getCurrentPlayers();
  const playerInfo = new Map(); // riotId -> { lastRole, lastTeam, lastDate }

  // From movements, track last known info
  state.movements.forEach(m => {
    if (!m.player) return;
    const existing = playerInfo.get(m.player) || { lastRole: '', lastTeam: '', lastDate: null };
    if (!existing.lastDate || (m.date && m.date > existing.lastDate)) {
      existing.lastDate = m.date;
      existing.lastTeam = m.team;
      if (m.role) existing.lastRole = m.role;
    }
    playerInfo.set(m.player, existing);
  });

  const free = [];
  playerInfo.forEach((info, player) => {
    if (!current.has(player)) {
      const o = getOverride(player);
      free.push({
        player,
        role: o.role !== undefined ? o.role : (info.lastRole || ''),
        lastTeam: info.lastTeam || '',
        lastDate: info.lastDate,
      });
    }
  });

  return free.sort((a, b) => {
    const { nick: na } = cleanNickname(a.player);
    const { nick: nb } = cleanNickname(b.player);
    return na.localeCompare(nb);
  });
}

function renderFreeAgents() {
  const container = document.getElementById('teamsContainer');
  const free = computeFreeAgents();

  if (!free.length) {
    container.innerHTML = '<div class="empty-msg">Nenhum free agent encontrado.</div>';
    return;
  }

  const columns = {
    Top: [], Jungle: [], Mid: [], Bot: [], Support: [], Coach: [], Manager: [], none: []
  };

  free.forEach(p => {
    const role = p.role || '';
    const key = ROLE_ORDER.includes(role) ? role : 'none';
    columns[key].push(p);
  });

  let html = '<div class="free-agents-grid">';
  [...ROLE_ORDER, 'none'].forEach(roleKey => {
    const list = columns[roleKey];
    if (!list.length && roleKey === 'none') return;
    const label = roleKey === 'none' ? 'Sem role' : roleKey;
    const cls = roleKey.toLowerCase();
    html += `<div class="fa-column ${cls}"><h3>${label} (${list.length})</h3>`;
    list.forEach(p => {
      const applied = applyOverride({ player: p.player, role: p.role });
      const { nick: autoNick, riot } = cleanNickname(p.player);
      const nick = applied.displayNick || autoNick;
      const role = applied.displayRole || '';
      const hasOverride = !!state.overrides[p.player];
      const last = p.lastTeam ? `<span class="fa-last-team">último: ${p.lastTeam}</span>` : '';

      html += `<div class="fa-player ${state.editMode ? 'editable' : ''}" data-riot="${p.player.replace(/"/g, '"')}">
        <span class="nickname">${nick}</span>
        <span class="riotid">${riot}</span>
        ${hasOverride ? '<span style="color:#f59e0b;font-size:0.75rem;margin-left:4px;">✎</span>' : ''}
        ${last}
      </div>`;

      if (state.editMode) {
        html += `<div class="edit-panel" style="display:none;" data-panel="${p.player.replace(/"/g, '"')}">
          <label>Nickname</label>
          <input type="text" class="edit-nick" value="${(applied.displayNick || autoNick).replace(/"/g, '"')}">
          <label>Role</label>
          <select class="edit-role">
            <option value="">—</option>
            ${ROLE_ORDER.map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
          <div class="edit-actions">
            <button class="btn-save">Salvar</button>
            <button class="btn-reset">Resetar</button>
            <button class="btn-cancel">Fechar</button>
          </div>
        </div>`;
      }
    });
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderTeams() {
  if (state.currentDiv === 'FREE') {
    renderFreeAgents();
    return;
  }
  const container = document.getElementById('teamsContainer');
  const filtered = state.teams.filter(t => t.division === state.currentDiv);

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-msg">Nenhum time encontrado nesta divisão.</div>';
    return;
  }

  container.innerHTML = filtered.map(t => {
    const hasPlayers = t.titulares.length || t.reservas.length;
    const titulares = sortByRole(t.titulares);
    const reservas = sortByRole(t.reservas);

    let html = `<div class="team-card ${hasPlayers ? '' : 'empty'}">`;
    html += `<div class="team-header"><span class="team-name">${t.team}</span><span class="team-tag">[${t.tag}]</span></div>`;

    if (titulares.length) {
      html += '<div class="section-label">Titulares</div>';
      titulares.forEach(p => {
        html += renderPlayerRow(p, `${t.division}|${t.team}`);
      });
    }
    if (reservas.length) {
      html += '<div class="section-label">Reservas</div>';
      reservas.forEach(p => {
        html += renderPlayerRow(p, `${t.division}|${t.team}`);
      });
    }
    if (!hasPlayers) {
      html += '<div class="section-label" style="margin-top:8px;">Sem elenco ativo</div>';
    }
    html += '</div>';
    return html;
  }).join('');
}

function renderTransfers() {
  const container = document.getElementById('transfersContainer');
  if (!state.movements.length) {
    container.innerHTML = '<div class="empty-msg">Nenhuma movimentação carregada.</div>';
    return;
  }

  // Group by date (YYYY-MM-DD)
  const byDate = {};
  state.movements.forEach(m => {
    const key = m.date.toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  });

  const dates = Object.keys(byDate).sort().reverse(); // newest first

  let html = '';
  dates.forEach(dateKey => {
    const items = byDate[dateKey];
    const d = new Date(dateKey);
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

    // Pair transfers (same player, opposite movements)
    const processed = new Set();
    const lines = [];

    items.forEach((m, idx) => {
      if (processed.has(idx)) return;

      // Look for matching opposite movement of same player
      const opposite = m.movement === 'Entrou' ? 'Saiu' : m.movement === 'Saiu' ? 'Entrou' : null;
      let pairIdx = -1;
      if (opposite) {
        pairIdx = items.findIndex((other, j) =>
          j !== idx && !processed.has(j) &&
          other.player === m.player && other.movement === opposite
        );
      }

      const { nick: autoNick } = cleanNickname(m.player);
      const nick = getOverride(m.player).nick || autoNick;
      const sister = getSisterOrg(m.team);

      if (pairIdx >= 0) {
        const other = items[pairIdx];
        processed.add(idx);
        processed.add(pairIdx);

        const entry = m.movement === 'Entrou' ? m : other;
        const exit = m.movement === 'Saiu' ? m : other;
        const entrySister = getSisterOrg(entry.team);
        const isSister = entrySister && entrySister.some(t => normalizeTeam(exit.team).includes(t) || t.includes(normalizeTeam(exit.team)));

        // Entry first
        let entryText = `<span class="player-name">${nick}</span> <span class="action">entra.</span>`;
        if (isSister) {
          entryText = `<span class="player-name">${nick}</span> <span class="action">entra</span> da equipe irmã <strong>${exit.team}</strong>.`;
        }
        lines.push({ type: 'in', tag: entry.tag || entry.team.slice(0, 4).toUpperCase(), text: entryText });

        // Exit below
        let exitText = `<span class="player-name">${nick}</span> <span class="action">sai.</span>`;
        if (isSister) {
          exitText = `<span class="player-name">${nick}</span> <span class="action">sai</span> para a equipe irmã <strong>${entry.team}</strong>.`;
        }
        lines.push({ type: 'out', tag: exit.tag || exit.team.slice(0, 4).toUpperCase(), text: exitText });
      } else {
        processed.add(idx);
        let text = '';
        let type = 'role';
        if (m.movement === 'Entrou') {
          type = 'in';
          text = `<span class="player-name">${nick}</span> <span class="action">entra.</span>`;
          if (m.detail && m.detail.toLowerCase().includes('como reserva')) text += ' <span class="sister-note">(reserva)</span>';
        } else if (m.movement === 'Saiu') {
          type = 'out';
          text = `<span class="player-name">${nick}</span> <span class="action">sai.</span>`;
          if (m.detail && m.detail.toLowerCase().includes('foi para')) {
            const dest = m.detail.replace(/foi para /i, '').replace(/ \(.*\)/, '');
            text = `<span class="player-name">${nick}</span> <span class="action">sai</span> para ${dest}.`;
          }
        } else if (m.movement === 'Virou titular') {
          text = `<span class="player-name">${nick}</span> <span class="action">virou titular.</span>`;
        } else if (m.movement === 'Virou reserva') {
          text = `<span class="player-name">${nick}</span> <span class="action">virou reserva.</span>`;
        }
        if (text) {
          lines.push({ type, tag: m.tag || m.team.slice(0, 4).toUpperCase(), text });
        }
      }
    });

    if (lines.length) {
      html += `<div class="date-group"><div class="date-header">${label}</div>`;
      lines.forEach(l => {
        html += `<div class="transfer-line ${l.type}">
          <span class="team-tag-mini">${l.tag}</span>
          <span>${l.text}</span>
        </div>`;
      });
      html += '</div>';
    }
  });

  container.innerHTML = html || '<div class="empty-msg">Nenhuma movimentação.</div>';
}

function renderAll() {
  renderTeams();
  renderTransfers();
}

// ---------- Events ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentDiv = btn.dataset.div;
    renderTeams();
  });
});

// Only attach if elements exist (local version has them, public version doesn't)
const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById('fileStatus');
    status.textContent = 'Lendo...';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        parseWorkbook(wb);
        status.textContent = `Carregado: ${file.name}`;
        renderAll();
      } catch (err) {
        status.textContent = 'Erro ao ler arquivo';
        console.error(err);
        alert('Não foi possível ler a planilha. Verifique se é o arquivo correto da Liga GG.');
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

const exportBtn = document.getElementById('exportOverrides');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(state.overrides, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celol-edicoes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

const importInput = document.getElementById('importOverrides');
if (importInput) {
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported !== 'object' || imported === null) throw new Error('Formato inválido');
        Object.assign(state.overrides, imported);
        saveOverrides();
        renderAll();
        document.getElementById('fileStatus').textContent = 'Edições importadas';
      } catch (err) {
        alert('Arquivo de edições inválido.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  });
}

const editToggle = document.getElementById('editToggle');
if (editToggle) {
  editToggle.addEventListener('click', () => {
    state.editMode = !state.editMode;
    editToggle.classList.toggle('active', state.editMode);
    editToggle.textContent = state.editMode ? 'Sair da edição' : 'Editar';
    renderTeams();
  });
}

// Delegate clicks for edit panels
document.getElementById('teamsContainer').addEventListener('click', (e) => {
  if (!state.editMode) return;
  const row = e.target.closest('.player-row.editable, .fa-player.editable');
  if (!row) return;
  const riot = row.dataset.riot;
  const panel = document.querySelector(`.edit-panel[data-panel="${CSS.escape(riot)}"]`);
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
});

document.getElementById('teamsContainer').addEventListener('click', (e) => {
  const btn = e.target;
  if (!btn.classList.contains('btn-save') && !btn.classList.contains('btn-reset') && !btn.classList.contains('btn-cancel')) return;
  const panel = btn.closest('.edit-panel');
  if (!panel) return;
  const riot = panel.dataset.panel;

  if (btn.classList.contains('btn-save')) {
    const nick = panel.querySelector('.edit-nick').value.trim();
    const role = panel.querySelector('.edit-role').value;
    if (!state.overrides[riot]) state.overrides[riot] = {};
    state.overrides[riot].nick = nick || null;
    state.overrides[riot].role = role || null;
    // Clean empty
    if (!state.overrides[riot].nick && !state.overrides[riot].role) delete state.overrides[riot];
    saveOverrides();
  } else if (btn.classList.contains('btn-reset')) {
    delete state.overrides[riot];
    saveOverrides();
  }
  panel.style.display = 'none';
  renderTeams();
});

// Load data from public JSON (GitHub Pages friendly)
async function loadPublicData() {
  const status = document.getElementById('fileStatus');
  try {
    const dataRes = await fetch('data.json');
    if (!dataRes.ok) throw new Error('data.json não encontrado (' + dataRes.status + ')');
    const data = await dataRes.json();
    state.teams = data.teams || [];
    state.movements = (data.movements || []).map(m => ({
      ...m,
      date: m.date ? new Date(m.date) : null,
    })).filter(m => m.date && !isNaN(m.date));

    try {
      const ovRes = await fetch('overrides.json');
      if (ovRes.ok) {
        const remoteOverrides = await ovRes.json();
        state.overrides = { ...remoteOverrides, ...state.overrides };
      }
    } catch (e) {
      console.warn('overrides.json não carregado');
    }

    try {
      const plRes = await fetch('players.json');
      if (plRes.ok) {
        state.players = await plRes.json();
      }
    } catch (e) {
      console.warn('players.json não carregado');
      state.players = {};
    }

    status.textContent = `Dados carregados (${state.teams.length} times)`;
  } catch (err) {
    status.textContent = 'Erro ao carregar dados';
    console.error(err);
    document.getElementById('teamsContainer').innerHTML =
      '<div class="empty-msg">Erro ao carregar dados. Verifique o console (F12).</div>';
  }
  renderAll();
  handleRoute();
}

function handleRoute() {
  const hash = location.hash || '';
  const playerMatch = hash.match(/^#\/player\/(.+)$/);
  const mainView = document.getElementById('mainView');
  const playerView = document.getElementById('playerView');

  if (playerMatch) {
    const riotId = decodeURIComponent(playerMatch[1]);
    mainView.style.display = 'none';
    playerView.style.display = 'block';
    renderPlayerPage(riotId);
  } else {
    mainView.style.display = 'block';
    playerView.style.display = 'none';
    renderTeams();
  }
}

function renderPlayerPage(riotId) {
  const container = document.getElementById('playerView');
  const o = getOverride(riotId);
  const pInfo = state.players[riotId] || {};
  const { nick: autoNick } = cleanNickname(riotId);
  const nick = o.nick || autoNick;

  // Collect all current teams
  const currentTeams = [];
  let roleFromRoster = '';
  for (const t of state.teams) {
    for (const p of [...t.titulares, ...t.reservas]) {
      if (p.player === riotId) {
        const pos = t.titulares.includes(p) ? 'Titular' : 'Reserva';
        currentTeams.push({ team: t.team, tag: t.tag, division: t.division, pos, role: p.role });
        if (!roleFromRoster && p.role) roleFromRoster = p.role;
      }
    }
  }

  const role = (o.role !== undefined && o.role !== null) ? o.role : roleFromRoster;

  // History
  const historyItems = state.movements
    .filter(m => m.player === riotId)
    .map(m => ({
      date: m.date,
      text: `${m.date.toLocaleDateString('pt-BR')} · ${m.team} · ${
        m.movement === 'Entrou' ? 'entrou' :
        m.movement === 'Saiu' ? 'saiu' :
        m.movement === 'Virou titular' ? 'virou titular' :
        m.movement === 'Virou reserva' ? 'virou reserva' : m.movement
      }${m.role ? ' (' + m.role + ')' : ''}`
    }));

  currentTeams.forEach(ct => {
    const hasEntry = historyItems.some(h => h.text.includes(ct.team) && h.text.includes('entrou'));
    if (!hasEntry) {
      historyItems.push({
        date: new Date(0),
        text: `Atualmente · ${ct.team} [${ct.tag}] · ${ct.pos}${ct.role ? ' (' + ct.role + ')' : ''}`
      });
    }
  });

  historyItems.sort((a, b) => b.date - a.date);
  const history = historyItems.map(h =>
    `<div class="transfer-line"><span>${h.text}</span></div>`
  ).join('');

  const teamsHtml = currentTeams.length
    ? currentTeams.map(ct => `
        <div class="team-card" style="margin-bottom:12px;">
          <div class="team-header">
            <span class="team-name">${ct.team}</span>
            <span class="team-tag">[${ct.tag}] · ${ct.pos}</span>
          </div>
          <div class="section-label">${ct.division}</div>
        </div>
      `).join('')
    : '<div style="color:var(--muted);margin-bottom:20px;">Free Agent</div>';

  // Extra info
  const nameHtml = pInfo.name ? `<div style="margin-bottom:4px;"><strong>Nome:</strong> ${pInfo.name}</div>` : '';
  const birthHtml = pInfo.birthdate ? `<div style="margin-bottom:12px;"><strong>Nascimento:</strong> ${new Date(pInfo.birthdate).toLocaleDateString('pt-BR')}</div>` : '';

  const socials = pInfo.socials || {};
  const socialHtml = Object.keys(socials).length ? `
    <div style="display:flex;gap:12px;margin:16px 0;">
      ${socials.x ? `<a href="${socials.x}" target="_blank" title="X"><img src="https://cdn.simpleicons.org/x/ffffff" width="20" height="20" alt="X"></a>` : ''}
      ${socials.instagram ? `<a href="${socials.instagram}" target="_blank" title="Instagram"><img src="https://cdn.simpleicons.org/instagram/ffffff" width="20" height="20" alt="Instagram"></a>` : ''}
      ${socials.discord ? `<span title="Discord: ${socials.discord}"><img src="https://cdn.simpleicons.org/discord/ffffff" width="20" height="20" alt="Discord"> ${socials.discord}</span>` : ''}
    </div>
  ` : '';

  container.innerHTML = `
    <div style="max-width:640px;margin:0 auto;">
      <a href="#/" style="color:var(--muted);font-size:0.9rem;">← Voltar</a>
      <h2 style="margin:16px 0 4px;">${nick}</h2>
      <div style="color:var(--muted);margin-bottom:16px;">${riotId}</div>
      <div style="margin-bottom:20px;">
        ${role ? `<span class="role-pill ${roleClass(role)}">${role}</span>` : '<span class="role-pill none">Sem role</span>'}
      </div>
      ${nameHtml}
      ${birthHtml}
      ${socialHtml}
      <h3 style="margin-bottom:8px;">Times atuais</h3>
      ${teamsHtml}
      <h3 style="margin:20px 0 8px;">Histórico de movimentações</h3>
      <div class="transfers">${history || '<div class="empty-msg">Nenhuma movimentação registrada.</div>'}</div>
    </div>
  `;
}

// Make player names link to their page
function makePlayerLink(riotId, displayName) {
  const encoded = encodeURIComponent(riotId);
  return `<a href="#/player/${encoded}" style="color:inherit;text-decoration:none;">${displayName}</a>`;
}

// Patch renderPlayerRow to use links (simple approach: post-process after render)
const originalRenderTeams = renderTeams;
renderTeams = function() {
  originalRenderTeams();
  if (state.currentDiv === 'FREE') return;
  document.querySelectorAll('.player-row .nickname').forEach(el => {
    const row = el.closest('.player-row');
    const riot = row?.dataset.riot;
    if (riot && el.textContent) {
      el.innerHTML = makePlayerLink(riot, el.textContent);
    }
  });
};

window.addEventListener('hashchange', handleRoute);

// Initial load
loadOverrides();
loadPublicData();
