// Player page
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

  // Default entry dates when no movement is recorded
  const DEFAULT_DATES = {
    'CELOL A': new Date('2026-09-12'),
    'CELOL B': new Date('2026-09-12'),
    'CELOL A-playoffs': new Date('2026-10-18'),
    'CELOL B-playoffs': new Date('2026-10-17'),
  };

  currentTeams.forEach(ct => {
    const hasEntry = historyItems.some(h => h.text.includes(ct.team) && h.text.includes('entrou'));
    if (!hasEntry) {
      const defaultDate = DEFAULT_DATES[ct.division] || new Date('2026-09-12');
      historyItems.push({
        date: defaultDate,
        text: `${defaultDate.toLocaleDateString('pt-BR')} · ${ct.team} [${ct.tag}] · entrou${ct.role ? ' (' + ct.role + ')' : ''} · ${ct.pos}`
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

  // Leaguepedia link (uses local SVG, supports custom page name)
  const lpPage = pInfo.leaguepedia || nick.replace(/\s+/g, '_');
  const lpUrl = `https://lol.fandom.com/wiki/${encodeURIComponent(lpPage)}`;
  const lpIcon = `
    <a href="${lpUrl}" target="_blank" title="Leaguepedia">
      <img src="images/icn_sns_leag.svg" width="24" height="24" alt="Leaguepedia">
    </a>
  `;

  const socials = pInfo.socials || {};
  const xHandle = socials.x ? socials.x.replace(/^@/, '') : '';
  const igHandle = socials.instagram ? socials.instagram.replace(/^@/, '') : '';
  const dcHandle = socials.discord || '';

  const socialHtml = (xHandle || igHandle || dcHandle || lpIcon) ? `
    <div style="display:flex;gap:12px;margin:16px 0;align-items:center;">
      ${xHandle ? `<a href="https://x.com/${xHandle}" target="_blank" title="X"><img src="https://cdn.simpleicons.org/x/ffffff" width="20" height="20" alt="X"></a>` : ''}
      ${igHandle ? `<a href="https://instagram.com/${igHandle}" target="_blank" title="Instagram"><img src="https://cdn.simpleicons.org/instagram/ffffff" width="20" height="20" alt="Instagram"></a>` : ''}
      ${dcHandle ? `
        <span class="discord-wrap" style="position:relative;display:inline-flex;align-items:center;">
          <img src="https://cdn.simpleicons.org/discord/ffffff" width="20" height="20" alt="Discord" style="cursor:pointer;" title="Discord">
          <span class="discord-popup" style="display:none;position:absolute;left:28px;top:50%;transform:translateY(-50%);background:#1e293b;border:1px solid var(--border);border-radius:6px;padding:6px 10px;white-space:nowrap;z-index:10;align-items:center;gap:6px;">
            <span>${dcHandle}</span>
            <button class="copy-discord" data-copy="${dcHandle}" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px;display:inline-flex;align-items:center;" title="Copiar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </span>
        </span>
      ` : ''}
      ${lpIcon}
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

