/* 访问统计：每次打开页面记一条（只记页面路径和匿名访客编号），页脚显示汇总 */
(function () {
  'use strict';
  var cfg = window.HUAJU_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  var base = cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/';
  var h = { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  if (!/^sb_publishable_/.test(cfg.SUPABASE_ANON_KEY)) h.Authorization = 'Bearer ' + cfg.SUPABASE_ANON_KEY;
  var vid;
  try {
    vid = localStorage.getItem('huaju-vid');
    if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('huaju-vid', vid); }
  } catch (e) { vid = 'anon'; }
  if (/^(localhost|127\.)/.test(location.hostname)) return;
  fetch(base + 'page_views', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, h), body: JSON.stringify({ path: location.pathname.slice(0, 200), vid: vid }), keepalive: true })
    .catch(function () {})
    .then(function () { return fetch(base + 'rpc/site_stats', { method: 'POST', headers: h, body: '{}' }); })
    .then(function (r) { return r && r.ok ? r.json() : null; })
    .then(function (s) {
      var el = document.getElementById('site-stats');
      if (!el || !s) return;
      el.textContent = '累计访问 ' + s.pv + ' 次 · ' + s.uv + ' 位访客 · 今日 ' + s.today + ' 次';
    })
    .catch(function () {});
})();
