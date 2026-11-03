// CELOL — Config & Helpers
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

const state = {
  teams: [],
  movements: [],
  currentDiv: 'CELOL A',
  editMode: false,
  overrides: {},
  players: {},
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
  s = s.replace(/^(NKZ|SBK|SBW|STE|STA|FL|FLA|FLC|MRE|IVT|JUV|NEON|BRX|BOT|DOC|ALV|SCL|VIX|TOR|VKT|PHE|OWN|OWB|SPH|LOS|IGG|MGG|APG|BRX|GLZ|LDG|DNY|LIVE)\s+/i, '');
  s = s.replace(/^[A-Z]{2,5}\s+/, '');
  const hash = s.indexOf('#');
  const nick = hash > 0 ? s.slice(0, hash).trim() : s;
  return { nick: nick || s, riot: String(riotId).trim() };
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

function makePlayerLink(riotId, displayName) {
  const encoded = encodeURIComponent(riotId);
  return `<a href="#/player/${encoded}" style="color:inherit;text-decoration:none;">${displayName}</a>`;
}
