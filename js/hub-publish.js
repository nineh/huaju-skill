/* 发布技能：浏览器里解析 zip、检查 SKILL.md 和敏感信息，上传后提交审核 */
(function () {
  'use strict';
  var H = window.Hub, el = H.el;
  var gate = document.getElementById('gate'), wrap = document.getElementById('publish'), drop = document.getElementById('drop'),
    file = document.getElementById('file'), checkBox = document.getElementById('check'), checks = document.getElementById('checks'),
    form = document.getElementById('form'), msg = document.getElementById('msg'), btn = document.getElementById('submit');
  var MAX = 20 * 1024 * 1024, MAX_FILES = 500;
  var pkg = null, existing = null;
  var TEXT = /\.(md|txt|py|js|ts|json|ya?ml|csv|html?|xml|sh|ps1|bat|ini|toml|cfg)$/i;
  var RULES = [
    ['身份证号', /(?:^|[^\d])([1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx])(?!\d)/],
    ['手机号', /(?:^|[^\d])(1[3-9]\d{9})(?!\d)/],
    ['案号', /[（(](?:19|20)\d{2}[）)][\u4e00-\u9fa5]{1,4}\d{0,4}[\u4e00-\u9fa5]{1,4}\d{1,6}号/],
    ['银行卡号', /(?:^|[^\d])(62\d{14,17})(?!\d)/],
    ['密钥或密码', /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|(?:password|passwd|api[_-]?key|secret)\s*[:=]\s*['"][^'"\s]{6,})/i]
  ];

  function say(t, c) { msg.textContent = t; msg.className = 'body-6 ' + (c || ''); }
  function check(kind, text) { var li = el('li', kind); li.appendChild(el('span', 'i', kind === 'pass' ? '✓' : kind === 'fail' ? '✕' : '!')); li.appendChild(el('span', '', text)); checks.appendChild(li); }

  // 简单的 frontmatter 解析：支持 key: value、引号、> 和 | 多行，以及 metadata: 下一层
  function parseFm(src) {
    var out = {}, lines = src.split(/\r?\n/), parent = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]; if (!line.trim() || /^\s*#/.test(line)) continue;
      var m = /^(\s*)([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line); if (!m) continue;
      var indent = m[1].length, key = m[2], val = m[3];
      if (indent === 0) parent = null;
      if (val === '' && indent === 0) { parent = key; out[key] = out[key] || {}; continue; }
      if (/^[>|][-+]?$/.test(val)) {
        var buf = [], fold = val[0] === '>';
        while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || !lines[i + 1].trim())) buf.push(lines[++i].trim());
        val = buf.join(fold ? ' ' : '\n').trim();
      } else val = val.replace(/^(["'])([\s\S]*)\1$/, '$2');
      if (indent > 0 && parent && typeof out[parent] === 'object') out[parent][key] = val; else out[key] = val;
    }
    return out;
  }
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64); }
  function bump(v) { var p = v.split('.').map(Number); p[2] += 1; return p.join('.'); }

  function handle(f) {
    checks.innerHTML = ''; checkBox.hidden = false; form.hidden = true; pkg = null; existing = null; say('');
    if (!/\.zip$/i.test(f.name)) { check('fail', '请上传 .zip 格式的技能包。'); return; }
    if (f.size > MAX) { check('fail', '技能包超过 20 MB（' + H.fmtSize(f.size) + '），请去掉视频等大文件。'); return; }
    check('pass', '文件：' + f.name + '（' + H.fmtSize(f.size) + '）');
    JSZip.loadAsync(f).then(function (zip) {
      var entries = []; zip.forEach(function (p, e) { if (!e.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(p)) entries.push(e); });
      if (entries.length > MAX_FILES) throw new Error('文件太多（' + entries.length + ' 个），上限 ' + MAX_FILES + ' 个。');
      if (entries.some(function (e) { return /(^|\/)\.\.(\/|$)/.test(e.name) || /^\//.test(e.name); })) throw new Error('技能包里有不安全的文件路径。');
      var md = entries.filter(function (e) { return /(^|\/)SKILL\.md$/.test(e.name) && e.name.split('/').length <= 2; });
      if (!md.length) throw new Error('没有找到 SKILL.md。它要放在 zip 最外层，或唯一的一个文件夹里。');
      var root = md[0].name.slice(0, md[0].name.length - 'SKILL.md'.length);
      var files = entries.filter(function (e) { return e.name.indexOf(root) === 0; }).map(function (e) { return { path: e.name.slice(root.length), size: e._data && e._data.uncompressedSize || 0, entry: e }; });
      check('pass', '找到 SKILL.md，共 ' + files.length + ' 个文件');
      return md[0].async('string').then(function (text) {
        var parts = H.splitFrontmatter(text);
        if (!parts.fm) throw new Error('SKILL.md 开头缺少 --- 包起来的 frontmatter（要有 name 和 description）。');
        var fm = parseFm(parts.fm);
        if (!fm.name) throw new Error('SKILL.md 缺少 name 字段。');
        if (!fm.description) throw new Error('SKILL.md 缺少 description 字段（写清楚什么时候用这个技能）。');
        check('pass', 'name：' + fm.name);
        check('pass', 'description：' + String(fm.description).slice(0, 80) + (String(fm.description).length > 80 ? '…' : ''));
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(fm.name)) check('warn', 'name 不是英文短横线格式，建议改成像 contract-review 这样，中文名写到 metadata 的 display-name。下面会让你填写技能标识。');
        if (text.length > 100000) throw new Error('SKILL.md 超过 10 万字，请把细节拆到 references/ 目录。');
        return scan(files).then(function (hits) {
          if (!hits.length) check('pass', '敏感信息自查：未发现身份证号、手机号、案号、银行卡号、密钥');
          else hits.slice(0, 20).forEach(function (h) { check('warn', '疑似' + h.rule + '：' + h.path + ' 第 ' + h.line + ' 行（' + h.sample + '）'); });
          if (hits.length > 20) check('warn', '还有 ' + (hits.length - 20) + ' 处疑似敏感信息未列出');
          pkg = { file: f, text: text, fm: fm, files: files.map(function (x) { return { path: x.path, size: x.size }; }), hits: hits.length };
          fill();
        });
      });
    }).catch(function (e) { check('fail', e.message || '读取 zip 失败，文件可能已损坏。'); });
  }

  function scan(files) {
    var hits = [];
    return Promise.all(files.filter(function (f) { return TEXT.test(f.path) && f.size < 2 * 1024 * 1024; }).map(function (f) {
      return f.entry.async('string').then(function (s) {
        s.split(/\r?\n/).forEach(function (line, i) {
          RULES.forEach(function (r) {
            var m = r[1].exec(line);
            if (m) { var v = (m[1] || m[0]).trim(); hits.push({ rule: r[0], path: f.path, line: i + 1, sample: v.slice(0, 4) + '…' + v.slice(-2) }); }
          });
        });
      });
    })).then(function () { return hits; });
  }

  function fill() {
    var fm = pkg.fm, meta = typeof fm.metadata === 'object' ? fm.metadata : {};
    var slug = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(fm.name) ? fm.name : slugify(pkg.file.name.replace(/\.zip$/i, ''));
    form.slug.value = slug; form.slug.readOnly = false;
    form.display_name.value = meta['display-name'] || (/[\u4e00-\u9fa5]/.test(fm.name) ? fm.name : '') || form.display_name.value;
    form.summary.value = (meta['short-description'] || String(fm.description)).slice(0, 200);
    try { form.author.value = form.author.value || localStorage.getItem('huaju-signup-name') || ''; } catch (e) {}
    form.version.value = /^\d+\.\d+\.\d+$/.test(meta.version || fm.version || '') ? (meta.version || fm.version) : '1.0.0';
    form.hidden = false;
    lookup();
  }

  function lookup() {
    var slug = form.slug.value.trim(), hint = document.getElementById('slug-hint'), vh = document.getElementById('ver-hint');
    existing = null; hint.className = 'caption-5 hint'; hint.textContent = '小写字母、数字和短横线，发布后不能改，例如 contract-review';
    vh.textContent = '格式 主版本.次版本.修订号';
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) return;
    H.sb.from('hub_skills').select('id,slug,display_name,summary,category,author,license,visibility,latest_version,owner_id').eq('slug', slug).maybeSingle().then(function (r) {
      if (!r.data) { hint.textContent = '新技能，标识可用'; hint.className = 'caption-5 ok'; return; }
      existing = r.data;
      var mine = existing.owner_id === H.state.user.id || H.state.admin;
      if (!mine) { hint.textContent = '这个标识已被其他技能使用，请换一个'; hint.className = 'caption-5 err'; return; }
      hint.textContent = '将为「' + existing.display_name + '」发布新版本'; hint.className = 'caption-5 ok';
      return H.sb.from('hub_versions').select('version').eq('skill_id', existing.id).in('status', ['published', 'pending']).then(function (v) {
        var vs = (v.data || []).map(function (x) { return x.version; }).sort(function (a, b) { var x = a.split('.').map(Number), y = b.split('.').map(Number); return (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]); });
        var last = vs[vs.length - 1];
        if (last) { vh.textContent = '当前最新 v' + last + '，新版本号要更大'; form.version.value = bump(last); }
        ['display_name', 'summary', 'category', 'author', 'license', 'visibility'].forEach(function (k) { if (existing[k] && (!form[k].value || k === 'visibility' || k === 'category')) form[k].value = existing[k]; });
      });
    });
  }

  form.slug.addEventListener('change', lookup);
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!pkg || btn.disabled) return;
    var d = {}; ['slug', 'version', 'display_name', 'author', 'summary', 'category', 'visibility', 'license', 'changelog'].forEach(function (k) { d[k] = form[k].value.trim(); });
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(d.slug)) { say('技能标识只能用小写字母、数字和短横线。', 'err'); form.slug.focus(); return; }
    if (!/^\d+\.\d+\.\d+$/.test(d.version)) { say('版本号格式应为 1.0.0。', 'err'); form.version.focus(); return; }
    if (!d.display_name) { say('请填写显示名称。', 'err'); form.display_name.focus(); return; }
    if (!d.author) { say('请填写作者。', 'err'); form.author.focus(); return; }
    if (!form.confirm.checked) { say('请勾选确认不含客户信息。', 'err'); return; }
    if (pkg.hits && !confirm('自动检查发现 ' + pkg.hits + ' 处疑似敏感信息。确定都不是真实客户信息、继续提交吗？')) return;
    btn.disabled = true; say('正在上传技能包…');
    var path = H.state.user.id + '/' + d.slug + '/' + d.version + '-' + Date.now() + '.zip';
    H.sb.storage.from('hub-packages').upload(path, pkg.file, { contentType: 'application/zip', upsert: false }).then(function (r) {
      if (r.error) throw r.error;
      say('正在提交审核…');
      return H.sb.rpc('hub_submit', {
        p_slug: d.slug, p_version: d.version, p_skill_md: pkg.text, p_files: pkg.files, p_storage_path: path, p_size: pkg.file.size,
        p_display_name: d.display_name, p_summary: d.summary, p_category: d.category, p_author: d.author,
        p_visibility: d.visibility, p_license: d.license || null, p_changelog: d.changelog
      });
    }).then(function (r) {
      if (r.error) throw r.error;
      try { localStorage.setItem('huaju-signup-name', d.author); } catch (e) {}
      form.hidden = true; checkBox.hidden = true;
      gate.innerHTML = '';
      var n = el('div', 'note'); n.appendChild(el('p', 'title-3', '已提交：' + d.display_name + ' v' + d.version));
      n.appendChild(el('p', 'body-6 muted', '管理员审核通过后会出现在技能库。审核进度可以在「我的」里查看。'));
      var a = el('a', 'card-link button-sm', '去「我的」看进度'); a.href = 'me.html'; n.appendChild(a);
      gate.appendChild(n); wrap.hidden = true;
    }).catch(function (e) { say('提交失败：' + H.errText(e), 'err'); btn.disabled = false; });
  });

  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
  drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
  file.addEventListener('change', function () { if (file.files[0]) handle(file.files[0]); file.value = ''; });

  H.onAuth(function (s) {
    gate.innerHTML = '';
    wrap.hidden = !s.staff;
    if (s.staff) return;
    var n = el('div', 'empty');
    n.appendChild(el('p', 'body-3', s.user ? '当前账号不是 @' + H.domain + ' 邮箱，不能发布。' : '发布技能需要先用 @' + H.domain + ' 邮箱登录。'));
    if (!s.user) { var b = el('button', 'btn button-md', '登录'); b.type = 'button'; b.style.marginTop = '16px'; b.onclick = function () { H.openLogin(); }; n.appendChild(b); }
    gate.appendChild(n);
  });
})();
