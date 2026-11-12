// Parties: /invite <name> (or J near a player), Y accept / N decline, /leave. Up to 4 members, kept on the server in memory.
// Members near a kill share its XP: +10% bonus, split evenly. The HUD lists the members with health bars.
import { P } from './actors.js';
import { addXP, floatText, toast, partyKill, takeQuest } from './game.js';
import { NET, sendNet } from './net.js';

export const PARTY = { id: 0, m: [] };   // m: [{ id, name }], first is the leader
const SHARE_R = 60;
let inv = null, hudT = 0;

const box = document.createElement('div');   // invite prompt
box.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);z-index:30;font:bold 18px monospace;color:#8fd3ff;text-shadow:0 0 6px #000,0 0 2px #000;text-align:center;pointer-events:none;white-space:pre';
const hud = document.createElement('div');   // member list, left edge
hud.style.cssText = 'position:fixed;left:10px;top:34%;z-index:20;font:12px monospace;color:#cfe6ff;text-shadow:0 0 4px #000;pointer-events:none;white-space:pre';
document.body.append(box, hud);

/* Key handling: returns true when the key was used by the party system */
export function partyKey(k) {
  if (inv) {
    if (k === 'y' || k === 'n') { sendNet({ t: 'party_r', ok: k === 'y' }); toast(k === 'y' ? 'Party invite accepted' : 'Party invite declined'); inv = null; box.textContent = ''; return true; }
    return false;
  }
  if (k !== 'j') return false;
  if (!NET.online) { toast('Parties need other players online'); return true; }
  let best = null, bd = 10;
  for (const R of NET.remotes.values()) { const d = Math.hypot(R.x - P.x, R.z - P.z); if (R.got && d < bd) { bd = d; best = R; } }
  if (!best) toast('No player close enough to invite (stand within 10 m, or type /invite <name>)'); else sendNet({ t: 'party', to: best.id });
  return true;
}

/* Chat commands: returns true when the line was a party command */
export function partyCmd(text) {
  const m = /^\/(invite|leave)\b\s*(.*)$/i.exec(text); if (!m) return false;
  if (!NET.online) { toast('Parties need other players online'); return true; }
  if (m[1].toLowerCase() === 'leave') sendNet({ t: 'party_leave' });
  else if (m[2].trim()) sendNet({ t: 'party', name: m[2].trim() }); else toast('Usage: /invite <name>');
  return true;
}

/* Server messages */
export function onPartyMsg(m) {
  if (m.t === 'party_inv') {
    if (!m.from) { inv = null; box.textContent = ''; return; }
    inv = { from: m.from }; box.textContent = m.name + ' invites you to a party\n[Y] accept   [N] decline';
  } else if (m.t === 'party') {
    PARTY.id = m.id || 0; PARTY.m = Array.isArray(m.m) ? m.m : []; hudT = 0;
  } else if (m.t === 'pxp') {
    addXP(m.xp); floatText('+' + m.xp + ' XP (party)', P.x, P.y + 2.6, P.z, 'info'); if (m.k) partyKill(m.k);
  } else if (m.t === 'pq') takeQuest(m.q);
}

/* The leader's accepted quest is offered to the whole party */
export function partyQuest(id) { if (PARTY.id && PARTY.m[0] && PARTY.m[0].id === NET.myId) sendNet({ t: 'pq', q: id }); }

/* XP the killer keeps for a kill worth xp; the same share and the kill credit (quest counters) go to the members standing near */
export function partyShare(xp, kind) {
  if (!PARTY.id) return xp;
  let n = 0; for (const mb of PARTY.m) { const R = NET.remotes.get(mb.id); if (R && R.got && Math.hypot(R.x - P.x, R.z - P.z) < SHARE_R) n++; }
  if (!n) return xp;
  const share = Math.max(1, Math.round(xp * 1.1 / (n + 1))); sendNet({ t: 'pxp', xp: share, k: kind }); return share;
}

export function updateParty(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = .25;
  if (!NET.online && PARTY.id) { PARTY.id = 0; PARTY.m = []; }
  if (!PARTY.id) { if (hud.textContent) hud.textContent = ''; return; }
  let t = 'PARTY';
  for (const [i, mb] of PARTY.m.entries()) {
    const me = mb.id === NET.myId, R = NET.remotes.get(mb.id), f = me ? P.hp / P.maxhp : R ? R.hp / (R.mh || 100) : 0, k = Math.max(0, Math.min(10, Math.round(f * 10)));
    t += '\n' + (i === 0 ? '* ' : '  ') + (mb.name + (me ? ' (you)' : '')).padEnd(18).slice(0, 18) + ' [' + '#'.repeat(k) + '.'.repeat(10 - k) + ']';
  }
  if (hud.textContent !== t) hud.textContent = t;
}
