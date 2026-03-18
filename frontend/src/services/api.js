// src/services/api.js
const BASE    = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const WS_BASE = import.meta.env.VITE_WS_URL  || 'ws://localhost:4000/ws/telemetry';

let _token = null;
try { _token = localStorage.getItem('sentinel_token'); } catch (_) {}

export const setToken = (t) => {
  _token = t;
  try { t ? localStorage.setItem('sentinel_token',t) : localStorage.removeItem('sentinel_token'); } catch(_){}
};
export const getToken = () => _token;

const hdrs = (x={}) => ({ 'Content-Type':'application/json', ...(_token?{Authorization:`Bearer ${_token}`}:{}), ...x });

async function req(method, path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers:hdrs(), ...(body!==undefined?{body:JSON.stringify(body)}:{}) });
    if (res.status===401) { setToken(null); window.dispatchEvent(new Event('sentinel:logout')); throw new Error('Session expired'); }
    if (!res.ok) { const e=await res.json().catch(()=>({error:`HTTP ${res.status}`})); throw new Error(e.error||`${res.status}`); }
    return res.json();
  } catch(err) {
    if (err.message.includes('fetch')) throw new Error('Cannot reach Sentinel backend. Is the server running?');
    throw err;
  }
}

export const auth = {
  login:  (email,password) => req('POST','/auth/login',{email,password}),
  logout: () => req('POST','/auth/logout').catch(()=>{}),
  me:     () => req('GET','/auth/me'),
};
export const telemetry = {
  live:         () => req('GET','/telemetry/live'),
  fleetSummary: () => req('GET','/telemetry/fleet/summary'),
  latest:       id  => req('GET',`/telemetry/${id}/latest`),
  history:      (id,h=24) => req('GET',`/telemetry/${id}/history?hours=${h}`),
};
export const financials = {
  kpis:        () => req('GET','/financials/kpis'),
  savings:     () => req('GET','/financials/savings'),
  projections: () => req('GET','/financials/projections'),
  drag:        () => req('GET','/financials/drag'),
  caseStudies: () => req('GET','/financials/case-studies'),
};
export const vessels = {
  all:    (p={}) => req('GET',`/vessels?${new URLSearchParams(p)}`),
  byId:   id    => req('GET',`/vessels/${id}`),
  telSummary: id => req('GET',`/vessels/${id}/telemetry`),
  create: d => req('POST','/vessels',d),
  update: (id,d) => req('PATCH',`/vessels/${id}`,d),
};
export const routes = {
  all:          (p={}) => req('GET',`/routes?${new URLSearchParams(p)}`),
  byId:         id => req('GET',`/routes/${id}`),
  create:       d  => req('POST','/routes',d),
  updateStatus: (id,status,note) => req('PATCH',`/routes/${id}/status`,{status,rejection_note:note}),
  createSwarm:  d  => req('POST','/routes/swarm-requests',d),
  reviewSwarm:  (id,decision) => req('PATCH',`/routes/swarm-requests/${id}/review`,{decision}),
};
export const alerts = {
  all:            (p={}) => req('GET',`/alerts?${new URLSearchParams(p)}`),
  stats:          () => req('GET','/alerts/stats'),
  acknowledge:    id => req('PATCH',`/alerts/${id}/acknowledge`),
  acknowledgeAll: v  => req('PATCH','/alerts/acknowledge-all',{vessel_id:v}),
};
export const admin = {
  stats:     () => req('GET','/admin/stats'),
  users:     () => req('GET','/admin/users'),
  createUser:(d) => req('POST','/admin/users',d),
  updateUser:(id,d) => req('PATCH',`/admin/users/${id}`,d),
  resetPw:   (id,password) => req('POST',`/admin/users/${id}/reset-password`,{password}),
  deleteUser:id => req('DELETE',`/admin/users/${id}`),
  nodes:     () => req('GET','/admin/server-nodes'),
  updateNode:(id,d) => req('PATCH',`/admin/server-nodes/${id}`,d),
  overrides: () => req('GET','/admin/overrides'),
  createOverride:d => req('POST','/admin/overrides',d),
  deactivateOverride: id => req('PATCH',`/admin/overrides/${id}/deactivate`),
  auditLogs: (p={}) => req('GET',`/admin/audit-logs?${new URLSearchParams(p)}`),
};
export const ai = {
  chat:    (message,session_id) => req('POST','/ai/chat',{message,session_id}),
  history: s => req('GET',`/ai/history${s?`?session_id=${s}`:''}`),
  streamChat: async (message,session_id,onToken) => {
    const res = await fetch(`${BASE}/ai/chat/stream`,{method:'POST',headers:hdrs(),body:JSON.stringify({message,session_id})});
    if (!res.ok) throw new Error(`AI stream error: ${res.status}`);
    const reader=res.body.getReader(); const dec=new TextDecoder();
    while(true){
      const {done,value}=await reader.read(); if(done)break;
      const txt=dec.decode(value,{stream:true});
      for(const line of txt.split('\n')){
        if(!line.startsWith('data: '))continue;
        try{ const d=JSON.parse(line.slice(6)); if(d.token)onToken(d.token); if(d.done||d.error)return; }catch(_){}
      }
    }
  },
};
export const createWS = (onMessage) => {
  const token=getToken();
  const ws=new WebSocket(`${WS_BASE}${token?`?token=${token}`:''}`);
  ws.onmessage=e=>{ try{onMessage(JSON.parse(e.data));}catch(_){} };
  ws.onerror=e=>console.warn('[WS]',e.type);
  return ws;
};
export default {auth,telemetry,financials,vessels,routes,alerts,admin,ai,createWS,setToken,getToken};
