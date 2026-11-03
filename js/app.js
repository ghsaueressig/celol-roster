// CELOL — Main (data loading, events, init)

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

// Tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentDiv = btn.dataset.div;
    renderTeams();
  });
});

// Discord popup: click to toggle, click outside to close
document.addEventListener('click', (e) => {
  const wrap = e.target.closest('.discord-wrap');
  const popup = wrap?.querySelector('.discord-popup');

  if (wrap && e.target.tagName === 'IMG') {
    const isOpen = popup.style.display === 'inline-flex';
    document.querySelectorAll('.discord-popup').forEach(p => p.style.display = 'none');
    popup.style.display = isOpen ? 'none' : 'inline-flex';
    return;
  }

  const btn = e.target.closest('.copy-discord');
  if (btn) {
    const text = btn.dataset.copy;
    navigator.clipboard.writeText(text).then(() => {
      btn.style.color = '#4ade80';
      setTimeout(() => { btn.style.color = 'var(--muted)'; }, 1200);
    }).catch(() => alert('Não foi possível copiar.'));
    return;
  }

  if (!wrap) {
    document.querySelectorAll('.discord-popup').forEach(p => p.style.display = 'none');
  }
});

// Player name links in team lists
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

// Init
loadOverrides();
loadPublicData();
