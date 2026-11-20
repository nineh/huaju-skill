/* 技能库公共脚本：Supabase 连接、登录（所里邮箱验证码）、常用小工具 */
(function () {
  'use strict';
  var cfg = window.HUAJU_CONFIG || {};
  var domain = String(cfg.HUB_EMAIL_DOMAIN || 'huajulaw.com').toLowerCase();
  var ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  var sb = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'huaju-hub-auth' }
  }) : null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtDate(ts) { if (!ts) return ''; var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtSize(n) { if (n == null) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function param(k) { return new URLSearchParams(location.search).get(k); }
  function errText(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || '');
    if (/Database error saving new user|只允许/.test(m)) return '只允许 @' + domain + ' 邮箱登录。';
    if (/rate limit|too many/i.test(m)) return '操作太频繁，请稍后再试。';
    if (/expired|invalid.*(otp|token)|Token has expired/i.test(m)) return '验证码不正确或已过期，请重新获取。';
    if (/Failed to fetch|NetworkError/i.test(m)) return '网络连接失败，请检查网络后重试。';
    return m || '出错了，请稍后再试。';
  }

  var state = { user: null, email: '', staff: false, admin: false };
  var listeners = [];
  function emailOk(email) { return /^[^@\s]+@[^@\s]+$/.test(email) && email.toLowerCase().slice(-(domain.length + 1)) === '@' + domain; }

  function refresh() {
    if (!sb) return Promise.resolve(state);
    return sb.auth.getSession().then(function (r) {
      var u = r.data && r.data.session ? r.data.session.user : null;
      state.user = u; state.email = u ? String(u.email || '').toLowerCase() : '';
      state.staff = !!(u && emailOk(state.email));
      if (!state.staff) { state.admin = false; return state; }
      return sb.rpc('hub_is_admin').then(function (x) { state.admin = x.data === true; return state; });
    }).catch(function () { return state; });
  }
  var resolved = false;
  var readyP = refresh().then(function (s) { resolved = true; renderAuth(); listeners.forEach(function (f) { f(s); }); return s; });
  if (sb) sb.auth.onAuthStateChange(function (ev) {
    if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') refresh().then(function (s) { renderAuth(); listeners.forEach(function (f) { f(s); }); });
  });

  function renderAuth() {
    var box = document.getElementById('hub-auth');
    document.querySelectorAll('[data-nav="admin"]').forEach(function (a) { a.hidden = !state.admin; });
    if (!box) return;
    box.innerHTML = '';
    if (!sb) { box.appendChild(el('span', 'caption-5 quiet', '数据库未配置')); return; }
    if (state.user) {
      box.appendChild(el('span', 'who caption-4', state.email));
      var out = el('button', 'btn ghost button-sm', '退出'); out.type = 'button';
      out.onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
      box.appendChild(out);
    } else {
      var b = el('button', 'btn button-sm', '登录'); b.type = 'button'; b.onclick = function () { openLogin(); };
      box.appendChild(b);
    }
  }

  function openLogin(reason) {
    if (!sb) { alert('数据库还没配置好，请联系平台维护人。'); return; }
    var dlg = document.getElementById('hub-login');
    if (dlg) dlg.remove();
    dlg = el('dialog', 'login-dlg'); dlg.id = 'hub-login';
    var f = el('form'); f.noValidate = true; dlg.appendChild(f);
    f.appendChild(el('h2', 'heading-6', '用所里邮箱登录'));
    f.appendChild(el('p', 'body-6 muted', (reason ? reason + ' ' : '') + '输入 @' + domain + ' 邮箱，我们会发一封带验证码的邮件。第一次登录会自动开通账号。'));
    var lab1 = el('label', 'hub-field'); lab1.appendChild(el('span', 'title-4', '邮箱'));
    var email = el('input'); email.type = 'email'; email.name = 'email'; email.autocomplete = 'email'; email.placeholder = '姓名拼音@' + domain;
    try { email.value = localStorage.getItem('huaju-hub-email') || ''; } catch (e) {}
    lab1.appendChild(email); f.appendChild(lab1);
    var lab2 = el('label', 'hub-field'); lab2.hidden = true; lab2.appendChild(el('span', 'title-4', '验证码'));
    var code = el('input'); code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.name = 'code'; code.maxLength = 10; code.placeholder = '邮件里的数字验证码';
    lab2.appendChild(code); lab2.appendChild(el('span', 'caption-5 quiet', '也可以直接点邮件里的登录链接。没收到请看垃圾邮件。')); f.appendChild(lab2);
    var msg = el('p', 'body-6'); msg.setAttribute('role', 'status'); f.appendChild(msg);
    var acts = el('div', 'acts');
    var cancel = el('button', 'btn ghost button-sm', '取消'); cancel.type = 'button'; cancel.onclick = function () { dlg.close(); };
    var go = el('button', 'btn button-sm', '发送验证码'); go.type = 'submit';
    acts.appendChild(cancel); acts.appendChild(go); f.appendChild(acts);
    document.body.appendChild(dlg);
    var sent = false;
    function say(t, c) { msg.textContent = t; msg.className = 'body-6 ' + (c || ''); }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var e = email.value.trim().toLowerCase();
      if (!emailOk(e)) { say('请填写 @' + domain + ' 结尾的邮箱。', 'err'); email.focus(); return; }
      go.disabled = true;
      if (!sent) {
        say('正在发送…');
        sb.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true, emailRedirectTo: location.href.split('#')[0] } }).then(function (r) {
          if (r.error) throw r.error;
          try { localStorage.setItem('huaju-hub-email', e); } catch (x) {}
          sent = true; lab2.hidden = false; email.readOnly = true; go.textContent = '登录'; code.focus();
          say('验证码已发送到 ' + e, 'ok');
        }).catch(function (x) { say(errText(x), 'err'); }).then(function () { go.disabled = false; });
      } else {
        var t = code.value.replace(/\s/g, '');
        if (!/^\d{6,10}$/.test(t)) { say('请填写邮件里的数字验证码。', 'err'); go.disabled = false; code.focus(); return; }
        say('正在登录…');
        sb.auth.verifyOtp({ email: e, token: t, type: 'email' }).then(function (r) {
          if (r.error) throw r.error;
          location.reload();
        }).catch(function (x) { say(errText(x), 'err'); go.disabled = false; });
      }
    });
    dlg.showModal(); (email.value ? (email.select(), email) : email).focus();
  }

  // 下载技能包：网站自带的走静态文件，网页上传的从存储桶取
  function download(skill, ver, root) {
    var name = skill.slug + '-' + ver.version + '.zip';
    var p;
    if (ver.static_url) {
      p = Promise.resolve((root || '../') + ver.static_url);
    } else if (ver.storage_path) {
      p = sb.storage.from('hub-packages').download(ver.storage_path).then(function (r) {
        if (r.error) throw r.error;
        return URL.createObjectURL(r.data);
      });
    } else return Promise.reject(new Error('这个版本没有技能包'));
    return p.then(function (url) {
      var a = el('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      if (url.indexOf('blob:') === 0) setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      if (ver.status === 'published') sb.rpc('hub_count_download', { p_slug: skill.slug }).then(function () {}, function () {});
    });
  }

  function splitFrontmatter(md) {
    var m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md || '');
    return m ? { fm: m[1], body: md.slice(m[0].length) } : { fm: '', body: md || '' };
  }
  function renderMarkdown(target, md) {
    var parts = splitFrontmatter(md);
    target.innerHTML = '';
    var html = window.marked ? window.marked.parse(parts.body, { gfm: true }) : '';
    var div = el('div', 'md');
    if (window.DOMPurify && html) div.innerHTML = window.DOMPurify.sanitize(html);
    else div.textContent = parts.body;
    div.querySelectorAll('a[href]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    target.appendChild(div);
  }

  function tags(s) {
    var t = el('div', 'rtags');
    t.appendChild(el('span', 'tag caption-3' + (s.source === '所内' ? ' hot' : ''), s.source === '所内' ? '所内技能' : '开源技能'));
    t.appendChild(el('span', 'tag caption-3', s.category));
    if (s.visibility === 'internal') t.appendChild(el('span', 'tag lock caption-3', '仅所内'));
    if (s.status === 'pending') t.appendChild(el('span', 'tag warn caption-3', '待审核'));
    if (s.status === 'hidden') t.appendChild(el('span', 'tag warn caption-3', '已下架'));
    return t;
  }
  function statusTag(st) {
    var map = { pending: ['待审核', 'warn'], published: ['已上架', 'ok'], rejected: ['已驳回', 'warn'], withdrawn: ['已撤回', ''], hidden: ['已下架', 'warn'] };
    var x = map[st] || [st, ''];
    return el('span', 'tag caption-3 ' + x[1], x[0]);
  }

  window.Hub = {
    sb: sb, ready: ready, domain: domain, state: state, el: el, fmtDate: fmtDate, fmtSize: fmtSize, param: param,
    errText: errText, emailOk: emailOk, openLogin: openLogin, onAuth: function (f) { listeners.push(f); if (resolved) f(state); },
    whenReady: function () { return readyP; }, download: download, renderMarkdown: renderMarkdown,
    splitFrontmatter: splitFrontmatter, tags: tags, statusTag: statusTag
  };
})();
