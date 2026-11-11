(function () {
  'use strict';
  var cfg = window.HUAJU_CONFIG || {};
  var form = document.getElementById('rec-form');
  if (!form) return;
  var list = document.getElementById('rec-list'), msg = document.getElementById('rec-msg'), btn = document.getElementById('rec-btn'), count = document.getElementById('rec-count');
  var ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var api = ready ? cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/recommendations' : '';
  var headers = {};
  if (ready) {
    headers = { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (!/^sb_publishable_/.test(cfg.SUPABASE_ANON_KEY)) headers.Authorization = 'Bearer ' + cfg.SUPABASE_ANON_KEY;
  }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function say(t, c) { msg.textContent = t; msg.className = 'body-6 ' + (c || ''); }
  var OPEN = /^(MIT|Apache|BSD|GPL|MPL|CC)/i;

  function render(rows) {
    list.innerHTML = '';
    count.textContent = '同事推荐（' + rows.length + '）';
    if (!rows.length) {
      var e = el('div', 'signup-item'); e.appendChild(el('p', 'title-3', '还没有推荐')); e.appendChild(el('p', 'body-6 muted', '发现好用的外部技能，填上面的表推荐给大家。')); list.appendChild(e); return;
    }
    rows.forEach(function (r) {
      var c = el('article', 'xcard');
      var tags = el('div', 'rtags');
      var lic = r.license || '未注明';
      tags.appendChild(el('span', 'tag caption-3' + (OPEN.test(lic) ? '' : ' warn'), lic));
      if (r.needs_account) tags.appendChild(el('span', 'tag caption-3 warn', '需要账号'));
      c.appendChild(tags);
      c.appendChild(el('h3', 'title-2', r.skill));
      if (r.note) c.appendChild(el('p', 'body-6 muted', r.note));
      c.appendChild(el('p', 'caption-5 quiet', '原作者：' + (r.author || '未注明')));
      var by = el('div', 'author');
      by.appendChild(el('span', 'avatar', r.recommender.slice(0, 1)));
      var t = el('span', 'author-text'); t.appendChild(el('span', 'title-4', r.recommender)); t.appendChild(el('span', 'caption-5 quiet', '推荐人'));
      by.appendChild(t); c.appendChild(by);
      if (/^https?:\/\//i.test(r.link)) { var a = el('a', 'card-link button-sm', '去原地址查看'); a.href = r.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.appendChild(a); }
      list.appendChild(c);
    });
  }
  function load() {
    if (!ready) { list.innerHTML = ''; btn.disabled = true; return; }
    list.innerHTML = '<div class="skel"></div>';
    fetch(api + '?select=*&order=created_at.desc&limit=200', { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(function () { list.innerHTML = ''; var e = el('div', 'signup-item'); e.appendChild(el('p', 'body-6 err', '推荐列表加载失败，请稍后刷新。')); list.appendChild(e); });
  }
  try { var n = localStorage.getItem('huaju-signup-name'); if (n) form.recommender.value = n; } catch (e) {}
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!ready || btn.disabled || form.website.value) return;
    var d = { recommender: form.recommender.value.trim(), skill: form.skill.value.trim(), link: form.link.value.trim(),
      author: form.author.value.trim(), license: form.license.value, note: form.note.value.trim(), needs_account: form.needs_account.checked };
    if (!d.recommender) { say('请填写你的姓名。', 'err'); form.recommender.focus(); return; }
    if (!d.skill) { say('请填写技能名称。', 'err'); form.skill.focus(); return; }
    if (!/^https?:\/\//i.test(d.link)) { say('请填写原项目地址，以 http:// 或 https:// 开头。', 'err'); form.link.focus(); return; }
    btn.disabled = true; say('正在提交…');
    fetch(api, { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, headers), body: JSON.stringify(d) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        try { localStorage.setItem('huaju-signup-name', d.recommender); } catch (e) {}
        ['skill', 'link', 'author', 'note'].forEach(function (k) { form[k].value = ''; }); form.needs_account.checked = false;
        say('已推荐：' + d.skill, 'ok'); load();
      })
      .catch(function () { say('提交失败。如果是第一次用，可能推荐表还没建好，请联系平台维护人。', 'err'); })
      .then(function () { btn.disabled = false; });
  });
  load();
})();
