// Render functions
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

function renderAll() {
  renderTeams();
  renderTransfers();
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
      const nickLink = `<a href="#/player/${encodeURIComponent(m.player)}" style="color:inherit;text-decoration:none;">${nick}</a>`;
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
        let entryText = `<span class="player-name">${nickLink}</span> <span class="action">entra.</span>`;
        if (isSister) {
          entryText = `<span class="player-name">${nickLink}</span> <span class="action">entra</span> da equipe irmã <strong>${exit.team}</strong>.`;
        }
        lines.push({ type: 'in', tag: entry.tag || entry.team.slice(0, 4).toUpperCase(), text: entryText });

        // Exit below
        let exitText = `<span class="player-name">${nickLink}</span> <span class="action">sai.</span>`;
        if (isSister) {
          exitText = `<span class="player-name">${nickLink}</span> <span class="action">sai</span> para a equipe irmã <strong>${entry.team}</strong>.`;
        }
        lines.push({ type: 'out', tag: exit.tag || exit.team.slice(0, 4).toUpperCase(), text: exitText });
      } else {
        processed.add(idx);
        let text = '';
        let type = 'role';
        if (m.movement === 'Entrou') {
          type = 'in';
          text = `<span class="player-name">${nickLink}</span> <span class="action">entra.</span>`;
          if (m.detail && m.detail.toLowerCase().includes('como reserva')) text += ' <span class="sister-note">(reserva)</span>';
        } else if (m.movement === 'Saiu') {
          type = 'out';
          text = `<span class="player-name">${nickLink}</span> <span class="action">sai.</span>`;
          if (m.detail && m.detail.toLowerCase().includes('foi para')) {
            const dest = m.detail.replace(/foi para /i, '').replace(/ \(.*\)/, '');
            text = `<span class="player-name">${nickLink}</span> <span class="action">sai</span> para ${dest}.`;
          }
        } else if (m.movement === 'Virou titular') {
          text = `<span class="player-name">${nickLink}</span> <span class="action">virou titular.</span>`;
        } else if (m.movement === 'Virou reserva') {
          text = `<span class="player-name">${nickLink}</span> <span class="action">virou reserva.</span>`;
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
