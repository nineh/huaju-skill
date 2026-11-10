(function () {
  'use strict';
  var cfg = window.HUAJU_CONFIG || {};
  var form = document.getElementById('signup-form');
  if (!form) return;
  var list = document.getElementById('signup-list');
  var msg = document.getElementById('signup-msg');
  var btn = document.getElementById('signup-btn');
  var count = document.getElementById('signup-count');
  var ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var api = ready ? cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/signups' : '';
  var headers = ready ? { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' } : {};

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function say(text, cls) { msg.textContent = text; msg.className = 'body-6 ' + (cls || ''); }
  function fmt(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function render(rows) {
    list.innerHTML = '';
    count.textContent = '已报名下期分享（' + rows.length + '）';
    if (!rows.length) {
      var empty = el('div', 'signup-item');
      empty.appendChild(el('p', 'title-3', '还没有人报名'));
      empty.appendChild(el('p', 'body-6 muted', '填上面的表，就能出现在这里。'));
      list.appendChild(empty); return;
    }
    rows.forEach(function (r) {
      var item = el('article', 'signup-item');
      var top = el('div', 'top');
      top.appendChild(el('p', 'title-3', r.skill));
      top.appendChild(el('span', 'caption-5 quiet', fmt(r.created_at)));
      item.appendChild(top);
      var by = el('div', 'author');
      by.appendChild(el('span', 'avatar', (r.name || '?').slice(0, 1)));
      var t = el('span', 'author-text'); t.appendChild(el('span', 'title-4', r.name)); t.appendChild(el('span', 'caption-5 quiet', r.tools || '作者'));
      by.appendChild(t); item.appendChild(by);
      if (r.intro) item.appendChild(el('p', 'body-6 muted', r.intro));
      if (r.link && /^https?:\/\//i.test(r.link)) {
        var a = el('a', 'caption-4', r.link); a.href = r.link; a.rel = 'noopener noreferrer'; a.target = '_blank'; item.appendChild(a);
      }
      list.appendChild(item);
    });
  }

  function load() {
    if (!ready) {
      list.innerHTML = '';
      var tip = el('div', 'signup-item');
      tip.appendChild(el('p', 'title-3', '在线报名即将开通'));
      tip.appendChild(el('p', 'body-6 muted', '报名数据库还在配置中，暂时请直接联系平台维护人报名。'));
      list.appendChild(tip);
      btn.setAttribute('aria-disabled', 'true'); btn.disabled = true;
      return;
    }
    list.innerHTML = '<div class="skel"></div><div class="skel"></div>';
    fetch(api + '?select=id,created_at,name,skill,intro,tools,link&order=created_at.desc&limit=200', { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(function () { list.innerHTML = ''; var e = el('div', 'signup-item'); e.appendChild(el('p', 'body-6 err', '报名列表加载失败，请检查网络后刷新页面。')); list.appendChild(e); });
  }

  try { var saved = localStorage.getItem('huaju-signup-name'); if (saved) form.name.value = saved; } catch (e) {}

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!ready || btn.disabled) return;
    if (form.website.value) return; // 防机器人
    var data = {
      name: form.name.value.trim(), skill: form.skill.value.trim(), intro: form.intro.value.trim(),
      tools: form.tools.value, link: form.link.value.trim()
    };
    if (!data.name) { say('请填写姓名。', 'err'); form.name.focus(); return; }
    if (!data.skill) { say('请填写要分享的技能。', 'err'); form.skill.focus(); return; }
    if (data.link && !/^https?:\/\//i.test(data.link)) { say('链接请以 http:// 或 https:// 开头。', 'err'); form.link.focus(); return; }
    btn.disabled = true; btn.classList.add('busy'); say('正在提交…');
    fetch(api, { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, headers), body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        try { localStorage.setItem('huaju-signup-name', data.name); } catch (e) {}
        form.skill.value = ''; form.intro.value = ''; form.link.value = '';
        say('已报名：' + data.skill, 'ok'); load();
      })
      .catch(function () { say('提交失败，请稍后再试，或联系平台维护人。', 'err'); })
      .then(function () { btn.disabled = false; btn.classList.remove('busy'); });
  });

  load();
})();
