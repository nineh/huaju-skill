/* 技能详情：SKILL.md 在线阅读、文件、版本、下载、评分、收藏 */
(function () {
  'use strict';
  var H = window.Hub, el = H.el, box = document.getElementById('skill');
  var slug = H.param('s');
  var skill = null, versions = [], cur = null;

  function fail(t) { box.innerHTML = ''; box.appendChild(el('div', 'empty body-6', t)); }

  function load() {
    if (!H.sb) return fail('技能库数据库还没配置好，请联系平台维护人。');
    if (!slug) return fail('没有指定技能。');
    H.sb.from('hub_catalog').select('*').eq('slug', slug).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      skill = r.data;
      if (!skill) return fail('找不到这个技能，可能已下架或还在审核中。');
      document.title = skill.display_name + ' · 华炬 Skill 集市';
      return H.sb.from('hub_versions').select('id,version,changelog,skill_md,files,storage_path,static_url,size_bytes,status,review_note,created_at,submitted_by')
        .eq('skill_id', skill.id).order('created_at', { ascending: false }).then(function (v) {
          if (v.error) throw v.error;
          versions = (v.data || []).sort(function (a, b) { return cmp(b.version, a.version); });
          cur = versions.filter(function (x) { return x.status === 'published'; })[0] || versions[0] || null;
          render();
        });
    }).catch(function (e) { fail('加载失败：' + H.errText(e)); });
  }
  function cmp(a, b) { var x = a.split('.').map(Number), y = b.split('.').map(Number); for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }

  function render() {
    var st = H.state;
    box.innerHTML = '';
    var top = el('div', 'skill-top'); top.style.marginTop = '24px';
    var left = el('div');
    left.appendChild(H.tags(skill));
    left.appendChild(el('h1', 'heading-3', skill.display_name));
    if (skill.summary) left.appendChild(el('p', 'lead body-3 muted', skill.summary));
    var by = el('div', 'author big');
    by.appendChild(el('span', 'avatar', (skill.author || '?').slice(0, 1)));
    var t = el('span', 'author-text'); t.appendChild(el('span', 'title-3', skill.author)); t.appendChild(el('span', 'caption-5 quiet', skill.source === '开源' ? '原作者' : '作者'));
    by.appendChild(t); left.appendChild(by);
    var facts = el('div', 'facts');
    [['技能标识', skill.slug], ['最新版本', skill.latest_version ? 'v' + skill.latest_version : '—'], ['协议', skill.license || '未注明'],
     ['下载', String(skill.download_count)], ['评分', skill.rating_count ? Number(skill.rating_avg).toFixed(1) + ' / 5（' + skill.rating_count + ' 人）' : '暂无'],
     ['更新', H.fmtDate(skill.updated_at)]].forEach(function (f) {
      var d = el('div', 'fact'); d.appendChild(el('p', 'caption-5 quiet', f[0])); d.appendChild(el('p', 'title-3' + (f[0] === '技能标识' ? ' mono' : ''), f[1])); facts.appendChild(d);
    });
    left.appendChild(facts);
    top.appendChild(left);
    top.appendChild(side(st));
    box.appendChild(top);

    if (!cur) {
      var n = el('div', 'note'); n.style.marginTop = '40px';
      n.appendChild(el('p', 'body-3', skill.visibility === 'internal' && !st.staff
        ? '这是仅对所内同事开放的技能，登录后可以查看内容和下载。' : '这个技能不提供在线技能包。'));
      if (skill.detail_url) { var a = el('a', 'card-link button-sm', '查看图文介绍和获取方式'); a.href = '../' + skill.detail_url; n.appendChild(a); }
      box.appendChild(n); return;
    }
    tabs();
  }

  function side(st) {
    var s = el('aside', 'side'); s.setAttribute('aria-label', '获取方式');
    s.appendChild(el('p', 'title-3', '获取技能包'));
    var msg = el('p', 'caption-5'); msg.setAttribute('role', 'status');
    if (cur) {
      var b = el('button', 'btn button-md block', '下载 v' + cur.version + (cur.size_bytes ? '（' + H.fmtSize(cur.size_bytes) + '）' : '')); b.type = 'button';
      b.onclick = function () { b.disabled = true; H.download(skill, cur).catch(function (e) { msg.textContent = '下载失败：' + H.errText(e); msg.className = 'caption-5 err'; }).then(function () { b.disabled = false; }); };
      s.appendChild(b);
      if (cur.status !== 'published') s.appendChild(H.statusTag(cur.status));
    } else if (skill.visibility === 'internal' && !st.user) {
      var l = el('button', 'btn button-md block', '登录后查看'); l.type = 'button'; l.onclick = function () { H.openLogin('这个技能仅对所内同事开放。'); }; s.appendChild(l);
    }
    if (skill.detail_url) { var d = el('a', 'btn ghost button-md block', '图文介绍'); d.href = '../' + skill.detail_url; s.appendChild(d); }
    if (skill.source_url) { var o = el('a', 'btn ghost button-md block', '原项目地址'); o.href = skill.source_url; o.target = '_blank'; o.rel = 'noopener noreferrer'; s.appendChild(o); }
    s.appendChild(el('p', 'caption-5 quiet', '下载后解压，把文件夹放进 AI 助手的技能目录（例如 ~/.claude/skills/' + skill.slug + '），或在助手设置里上传 zip。'));
    s.appendChild(msg);
    s.appendChild(social(st));
    return s;
  }

  function social(st) {
    var w = el('div'); w.style.borderTop = '1px solid var(--line)'; w.style.paddingTop = '16px'; w.style.display = 'grid'; w.style.gap = '8px';
    if (!st.staff) {
      var b = el('button', 'btn ghost button-sm', '登录后可评分、收藏'); b.type = 'button'; b.onclick = function () { H.openLogin(); }; w.appendChild(b); return w;
    }
    w.appendChild(el('p', 'title-4', '我的评分'));
    var stars = el('div', 'stars'); stars.setAttribute('role', 'radiogroup'); stars.setAttribute('aria-label', '评分');
    var mine = 0, starred = false;
    function paint() { Array.prototype.forEach.call(stars.children, function (x, i) { x.classList.toggle('on', i < mine); x.setAttribute('aria-checked', String(i + 1 === mine)); }); }
    for (var i = 1; i <= 5; i++) (function (n) {
      var x = el('button', '', '★'); x.type = 'button'; x.setAttribute('role', 'radio'); x.setAttribute('aria-label', n + ' 星');
      x.onclick = function () {
        H.sb.from('hub_ratings').upsert({ user_id: st.user.id, skill_id: skill.id, score: n, updated_at: new Date().toISOString() }).then(function (r) {
          if (r.error) { alert(H.errText(r.error)); return; } mine = n; paint(); reloadStats();
        });
      };
      stars.appendChild(x);
    })(i);
    w.appendChild(stars);
    var fav = el('button', 'btn ghost button-sm', '收藏'); fav.type = 'button';
    function paintFav() { fav.textContent = starred ? '已收藏（点击取消）' : '收藏'; }
    fav.onclick = function () {
      fav.disabled = true;
      var p = starred ? H.sb.from('hub_stars').delete().eq('user_id', st.user.id).eq('skill_id', skill.id)
        : H.sb.from('hub_stars').insert({ user_id: st.user.id, skill_id: skill.id });
      p.then(function (r) { if (r.error) alert(H.errText(r.error)); else { starred = !starred; paintFav(); } fav.disabled = false; });
    };
    w.appendChild(fav);
    H.sb.from('hub_ratings').select('score').eq('skill_id', skill.id).eq('user_id', st.user.id).maybeSingle().then(function (r) { mine = r.data ? r.data.score : 0; paint(); });
    H.sb.from('hub_stars').select('skill_id').eq('skill_id', skill.id).eq('user_id', st.user.id).maybeSingle().then(function (r) { starred = !!r.data; paintFav(); });
    return w;
  }
  function reloadStats() {
    H.sb.from('hub_catalog').select('rating_avg,rating_count').eq('id', skill.id).maybeSingle().then(function (r) {
      if (!r.data) return; skill.rating_avg = r.data.rating_avg; skill.rating_count = r.data.rating_count;
      var f = box.querySelectorAll('.fact')[4]; if (f) f.lastChild.textContent = skill.rating_count ? Number(skill.rating_avg).toFixed(1) + ' / 5（' + skill.rating_count + ' 人）' : '暂无';
    });
  }

  function tabs() {
    var bar = el('div', 'tabs'); bar.setAttribute('role', 'tablist');
    var pane = el('div');
    var defs = [['md', 'SKILL.md'], ['files', '文件（' + (cur.files || []).length + '）'], ['versions', '版本（' + versions.length + '）']];
    function show(k) {
      Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute('aria-selected', String(b.dataset.k === k)); });
      pane.innerHTML = '';
      if (k === 'md') mdPane(pane); else if (k === 'files') filesPane(pane); else versionsPane(pane);
    }
    defs.forEach(function (d) { var b = el('button', 'tab', d[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.k = d[0]; b.onclick = function () { show(d[0]); }; bar.appendChild(b); });
    box.appendChild(bar); box.appendChild(pane); show('md');
  }
  function mdPane(p) {
    var head = el('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px;max-width:820px;flex-wrap:wrap';
    head.appendChild(el('p', 'caption-5 quiet', 'v' + cur.version + ' 的 SKILL.md：AI 就是照着这份说明在做事。'));
    var tog = el('button', 'btn ghost button-sm', '看原文'); tog.type = 'button'; head.appendChild(tog);
    p.appendChild(head);
    var body = el('div'); p.appendChild(body);
    var raw = false;
    function draw() {
      body.innerHTML = '';
      if (raw) { body.appendChild(el('pre', 'raw', cur.skill_md)); tog.textContent = '看排版'; return; }
      tog.textContent = '看原文';
      var fm = H.splitFrontmatter(cur.skill_md).fm;
      if (fm) {
        var g = el('div', 'fm body-6');
        fm.split(/\r?\n/).forEach(function (line) {
          var m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line); if (!m) return;
          g.appendChild(el('span', 'title-4 mono', m[1])); g.appendChild(el('span', 'muted', m[2].replace(/^["']|["']$/g, '')));
        });
        body.appendChild(g);
      }
      var mdBox = el('div'); body.appendChild(mdBox); H.renderMarkdown(mdBox, cur.skill_md);
    }
    tog.onclick = function () { raw = !raw; draw(); };
    draw();
  }
  function filesPane(p) {
    var ul = el('ul', 'files');
    (cur.files || []).slice().sort(function (a, b) { return a.path.localeCompare(b.path); }).forEach(function (f) {
      var li = el('li'); li.appendChild(el('span', 'mono', f.path)); li.appendChild(el('span', 'quiet', H.fmtSize(f.size))); ul.appendChild(li);
    });
    p.appendChild(ul);
  }
  function versionsPane(p) {
    var list = el('div', 'list'); list.style.maxWidth = '820px';
    versions.forEach(function (v) {
      var r = el('div', 'row-item');
      var top = el('div', 'top');
      var l = el('div', 'acts'); l.appendChild(el('span', 'title-3 mono', 'v' + v.version)); l.appendChild(H.statusTag(v.status)); top.appendChild(l);
      top.appendChild(el('span', 'caption-5 quiet', H.fmtDate(v.created_at)));
      r.appendChild(top);
      if (v.changelog) r.appendChild(el('p', 'body-6 muted', v.changelog));
      if (v.review_note) r.appendChild(el('p', 'body-6', '审核意见：' + v.review_note));
      var acts = el('div', 'acts');
      var view = el('button', 'btn ghost button-sm', '查看此版本'); view.type = 'button'; view.onclick = function () { cur = v; render(); }; acts.appendChild(view);
      r.appendChild(acts);
      list.appendChild(r);
    });
    p.appendChild(list);
  }

  var first = true;
  H.onAuth(function () { if (first) { first = false; load(); } else if (skill) load(); });
})();
