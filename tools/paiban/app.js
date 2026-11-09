(function () {
  'use strict';
  var CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
  var MAX = 20 * 1024 * 1024;
  var $ = function (id) { return document.getElementById(id); };

  var state = { ready: false, busy: false, input: null, inputName: '', ref: null, refName: '', out: null, outName: '', seq: 0 };
  var pending = {};
  var downloadsP = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('downloads').catch(function () { return null; })
    : Promise.resolve(null);

  // ---------- 引擎 ----------
  var worker = new Worker('worker.js');
  function setEngine(text, pct, cls) {
    $('engine-text').textContent = text;
    if (pct != null) $('engine-fill').style.transform = 'scaleX(' + Math.max(0.05, pct / 100) + ')';
    if (cls) $('engine').classList.add(cls);
  }
  worker.onmessage = function (e) {
    var m = e.data;
    if (m.type === 'progress') { setEngine(m.text, m.pct); return; }
    if (m.type === 'ready') { state.ready = true; setEngine('排版引擎已就绪，可以断网使用', 100, 'ready'); refresh(); return; }
    var cb = pending[m.id];
    if (m.type === 'error' && m.id == null) {
      setEngine('排版引擎加载失败：' + m.message + '。请检查网络后刷新页面。', 100, 'failed');
      return;
    }
    if (cb) { delete pending[m.id]; cb(m); }
  };
  setTimeout(function () {
    if (!state.ready && !$('engine').classList.contains('failed')) {
      $('engine-text').textContent += ' 加载较慢，请保持页面打开；一直不动的话，请检查网络或联系平台维护人。';
    }
  }, 45000);
  worker.onerror = function (ev) {
    setEngine('排版引擎加载失败：' + (ev.message || '未知错误') + '。请刷新页面重试。', 100, 'failed');
  };
  function call(msg) {
    return new Promise(function (resolve) {
      msg.id = ++state.seq; pending[msg.id] = resolve; worker.postMessage(msg);
    });
  }
  function head(u) { return fetch(u, { method: 'HEAD' }).then(function (r) { return r.ok; }).catch(function () { return false; }); }
  Promise.all([head('pyodide/pyodide.js'), head('pyodide/python_stdlib.zip')]).then(function (ok) {
    var local = ok[0];
    worker.postMessage({
      cmd: 'init',
      base: local ? new URL('pyodide/', location.href).href : CDN,
      bundleUrl: new URL('pybundle.json', location.href).href,
      pkgBundleUrl: local && !ok[1] ? new URL('pyodide/pkgbundle.json', location.href).href : null
    });
  });

  // ---------- 文件选择 ----------
  function bindDrop(dropId, inputId, onFile) {
    var drop = $(dropId), input = $(inputId);
    input.addEventListener('change', function () { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
    drop.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (ev) { ev.preventDefault(); if (ev.dataTransfer.files[0]) onFile(ev.dataTransfer.files[0]); });
  }
  function check(file) {
    if (!/\.docx$/i.test(file.name)) return '只支持 .docx 文件。.doc 或 .wps 请先在 Word / WPS 里另存为 .docx。';
    if (file.size > MAX) return '文件超过 20 MB，请压缩图片后再试。';
    return null;
  }
  function showName(dropId, name, size) {
    var drop = $(dropId), t = drop.querySelector('.drop-text .title-3');
    t.textContent = name + '（' + (size / 1024).toFixed(0) + ' KB）';
    drop.classList.add('has');
  }
  function setInput(name, buf) {
    state.input = buf; state.inputName = name; state.out = null;
    showName('drop-input', name, buf.byteLength); hideResult(); refresh();
  }
  function setRef(name, buf) {
    state.ref = buf; state.refName = name;
    showName('drop-ref', name, buf.byteLength);
    $('ref-summary').hidden = true;
    inspectRef();
    refresh();
  }
  bindDrop('drop-input', 'file-input', function (f) {
    var err = check(f); if (err) return showError(err);
    f.arrayBuffer().then(function (b) { setInput(f.name, b); });
  });
  bindDrop('drop-ref', 'file-ref', function (f) {
    var err = check(f); if (err) return showError(err);
    f.arrayBuffer().then(function (b) { setRef(f.name, b); });
  });
  $('use-sample').addEventListener('click', function () {
    fetch('samples.json')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var dec = function (b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
        var bs = [dec(j.input), dec(j.reference)];
        setInput('示例-借款律师函（格式混乱）.docx', bs[0]);
        setRef('示例-华炬律师函样板.docx', bs[1]);
      })
      .catch(function () { showError('示例文件加载失败，请刷新页面重试。'); });
  });

  function inspectRef() {
    if (!state.ref || !state.ready) return;
    call({ cmd: 'inspect', reference: state.ref.slice(0) }).then(function (m) {
      if (m.type === 'error') return showError('样板读取失败：' + m.message);
      var ul = $('ref-lines'); ul.innerHTML = '';
      m.summary.split('\n').forEach(function (line) { var li = document.createElement('li'); li.textContent = line; ul.appendChild(li); });
      $('ref-summary').hidden = false;
    });
  }

  // ---------- 处理方式 ----------
  function mode() { return document.querySelector('input[name=mode]:checked').value; }
  document.querySelectorAll('input[name=mode]').forEach(function (r) {
    r.addEventListener('change', function () {
      $('sub-smart').hidden = mode() !== 'smart';
      $('sub-mimic').hidden = mode() !== 'mimic';
      $('sub-custom').hidden = mode() !== 'custom';
      $('go').textContent = { smart: '开始排版', mimic: '参照样板排版', custom: '按自定义格式排版', analyze: '开始诊断', punctuation: '修复标点' }[mode()];
      if (mode() === 'custom' && !state.custom) loadStart();
      if (mode() === 'mimic' && state.ref && $('ref-summary').hidden) inspectRef();
      hideResult(); refresh();
    });
  });

  function refresh() {
    var hint = '';
    if (!state.input) hint = '请先选择文档';
    else if (mode() === 'mimic' && !state.ref) hint = '请上传样板文件';
    else if (mode() === 'custom' && !state.custom) hint = '正在载入格式…';
    else if (!state.ready) hint = '排版引擎还在加载，稍等片刻';
    var ok = !hint && !state.busy;
    $('go').setAttribute('aria-disabled', ok ? 'false' : 'true');
    $('go-hint').textContent = state.busy ? '正在处理…' : hint;
    if (state.ready && state.ref && mode() === 'mimic' && $('ref-summary').hidden) inspectRef();
    if (state.ready && mode() === 'custom' && !state.custom && !state.loadingCustom) loadStart();
  }

  function showError(msg) { $('error').textContent = msg; $('error').hidden = false; }
  function hideResult() { $('result').hidden = true; $('error').hidden = true; }


  // ---------- 自定义排版 ----------
  var SLOTS = [['title', '主标题'], ['heading1', '一级标题'], ['heading2', '二级标题'], ['heading3', '三级标题'], ['heading4', '四级标题'], ['body', '正文']];
  var FONTS = ['方正小标宋简体', '仿宋_GB2312', '仿宋', '黑体', '楷体_GB2312', '楷体', '宋体', '微软雅黑', '等线'];
  var SIZES = [[42, '初号'], [36, '小初'], [26, '一号'], [24, '小一'], [22, '二号'], [18, '小二'], [16, '三号'], [15, '小三'], [14, '四号'], [12, '小四'], [10.5, '五号'], [9, '小五']];
  var ALIGNS = [['left', '左对齐'], ['center', '居中'], ['right', '右对齐'], ['justify', '两端对齐']];
  var STORE = 'huaju-paiban-custom';

  (function buildRows() {
    var dl = document.createElement('datalist'); dl.id = 'c-fonts';
    FONTS.forEach(function (f) { var o = document.createElement('option'); o.value = f; dl.appendChild(o); });
    document.body.appendChild(dl);
    var opt = function (list) { return list.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join(''); };
    $('c-rows').innerHTML = SLOTS.map(function (s) {
      return '<tr data-slot="' + s[0] + '"><td class="title-4">' + s[1] + '</td>' +
        '<td><input class="cn-font" list="c-fonts" data-k="font_cn" aria-label="' + s[1] + '中文字体"></td>' +
        '<td><select data-k="size" aria-label="' + s[1] + '字号">' + opt(SIZES.map(function (z) { return [z[0], z[1] + ' ' + z[0]]; })) + '</select></td>' +
        '<td><input type="checkbox" data-k="bold" aria-label="' + s[1] + '加粗"></td>' +
        '<td><select data-k="align" aria-label="' + s[1] + '对齐">' + opt(ALIGNS) + '</select></td>' +
        '<td><input type="number" class="ind" min="0" max="10" step="0.5" data-k="indent" aria-label="' + s[1] + '首行缩进字符"></td>' +
        '<td><select data-k="lstype" aria-label="' + s[1] + '行距方式"><option value="exact">固定值</option><option value="multiple">倍数</option></select> ' +
        '<input type="number" class="ls" min="0.5" step="0.5" data-k="ls" aria-label="' + s[1] + '行距"></td></tr>';
    }).join('');
  })();

  function ensureSize(sel, v) {
    if (![].some.call(sel.options, function (o) { return Number(o.value) === Number(v); })) {
      var o = document.createElement('option'); o.value = v; o.textContent = v + ' 磅'; sel.appendChild(o);
    }
    sel.value = String(v);
  }
  function fillForm(p) {
    state.custom = JSON.parse(JSON.stringify(p));
    var pg = p.page || {};
    $('c-top').value = pg.top; $('c-bottom').value = pg.bottom; $('c-left').value = pg.left; $('c-right').value = pg.right;
    SLOTS.forEach(function (s) {
      var f = p[s[0]] || {}, row = document.querySelector('tr[data-slot="' + s[0] + '"]');
      var q = function (k) { return row.querySelector('[data-k="' + k + '"]'); };
      q('font_cn').value = f.font_cn || '';
      ensureSize(q('size'), f.size || 16);
      q('bold').checked = !!f.bold;
      q('align').value = f.align || 'left';
      q('indent').value = f.size ? Math.round((f.indent || 0) / f.size * 2) / 2 : 0;
      if (f.line_spacing_multiple) { q('lstype').value = 'multiple'; q('ls').value = f.line_spacing_multiple; }
      else if (f.line_spacing || !('line_spacing' in f)) { q('lstype').value = 'exact'; q('ls').value = f.line_spacing || 28; }
      else { q('lstype').value = 'multiple'; q('ls').value = 1.5; }
    });
    $('c-pn').checked = !!p.page_number;
    $('c-pn-style').value = p.page_number_style || 'dash';
    $('c-pn-pos').value = p.page_number_position || 'outside';
    refresh();
  }
  function num(id, d) { var v = parseFloat($(id).value); return isNaN(v) ? d : v; }
  function readForm() {
    var p = JSON.parse(JSON.stringify(state.custom || {}));
    p.page = { top: num('c-top', 3.7), bottom: num('c-bottom', 3.5), left: num('c-left', 2.8), right: num('c-right', 2.6) };
    SLOTS.forEach(function (s) {
      var row = document.querySelector('tr[data-slot="' + s[0] + '"]');
      var q = function (k) { return row.querySelector('[data-k="' + k + '"]'); };
      var f = p[s[0]] = p[s[0]] || {};
      var size = parseFloat(q('size').value) || 16;
      f.font_cn = q('font_cn').value.trim() || '仿宋_GB2312';
      f.font_en = f.font_en || 'Times New Roman';
      f.size = size; f.bold = q('bold').checked; f.align = q('align').value;
      f.indent = Math.max(0, parseFloat(q('indent').value) || 0) * size;
      var ls = parseFloat(q('ls').value);
      if (q('lstype').value === 'exact') { f.line_spacing = ls > 0 ? ls : 28; delete f.line_spacing_multiple; }
      else { f.line_spacing = null; f.line_spacing_multiple = ls > 0 ? ls : 1.5; }
    });
    p.page_number = $('c-pn').checked;
    p.page_number_style = $('c-pn-style').value;
    p.page_number_position = $('c-pn-pos').value;
    return p;
  }
  function cmsg(t) { $('c-msg').textContent = t; }
  function loadStart() {
    if (!state.ready) return;
    var v = $('c-start').value;
    if (v === 'reference' && !state.ref) { cmsg('请先在"参照样板排版"里上传样板。'); return; }
    state.loadingCustom = true;
    var p = v === 'reference' ? call({ cmd: 'refpreset', reference: state.ref.slice(0) }) : call({ cmd: 'preset', name: v });
    p.then(function (m) {
      state.loadingCustom = false;
      if (m.type === 'error') return cmsg('载入失败：' + m.message);
      fillForm(JSON.parse(m.preset));
      cmsg(v === 'reference' ? '已载入样板格式，可以在此基础上修改。' : '已载入，可以开始修改。');
    });
  }
  $('c-load').addEventListener('click', loadStart);

  function readStore() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } }
  function writeStore(o) { try { localStorage.setItem(STORE, JSON.stringify(o)); return true; } catch (e) { return false; } }
  function listSaved() {
    var o = readStore(), sel = $('c-saved');
    sel.innerHTML = '<option value="">' + (Object.keys(o).length ? '选择已保存的格式' : '（未保存）') + '</option>';
    Object.keys(o).forEach(function (k) { var op = document.createElement('option'); op.value = k; op.textContent = k; sel.appendChild(op); });
  }
  listSaved();
  $('c-saved').addEventListener('change', function () {
    var o = readStore(), k = $('c-saved').value;
    if (k && o[k]) { fillForm(o[k]); cmsg('已载入：' + k); }
  });
  $('c-save').addEventListener('click', function () {
    if (!state.custom) return cmsg('请先载入一个起点格式。');
    var name = ($('c-name').value || '').trim() || ('我的格式 ' + new Date().toLocaleDateString('zh-CN'));
    var o = readStore(); var p = readForm(); p.name = name; o[name] = p;
    if (writeStore(o)) { listSaved(); $('c-saved').value = name; cmsg('已保存在这台电脑的浏览器里：' + name); }
    else cmsg('这个浏览器不允许保存，请用"导出 JSON"另存。');
  });
  $('c-export').addEventListener('click', function () {
    if (!state.custom) return cmsg('请先载入一个起点格式。');
    var text = JSON.stringify({ preset: readForm() }, null, 2);
    var fname = '我的排版格式.json';
    downloadsP.then(function (dl) {
      if (dl) return dl.save({ filename: fname, data: text }).then(function () { cmsg('已导出：' + fname); }).catch(function () { cmsg('已取消导出。'); });
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove(); cmsg('已导出：' + fname);
    });
  });
  $('c-import').addEventListener('change', function () {
    var f = $('c-import').files[0]; $('c-import').value = '';
    if (!f) return;
    f.text().then(function (t) {
      var j = JSON.parse(t); var p = j.preset || j;
      if (!p.body || !p.page) throw new Error('bad');
      fillForm(p); cmsg('已导入：' + f.name);
    }).catch(function () { cmsg('导入失败：文件不是本工具导出的格式 JSON。'); });
  });

  // ---------- 执行 ----------
  $('go').addEventListener('click', function () {
    if ($('go').getAttribute('aria-disabled') === 'true') return;
    hideResult();
    state.busy = true; $('go').classList.add('busy'); refresh();
    var m = mode();
    var opts = {
      preset: $('preset').value,
      revision: $('opt-revision').checked,
      no_page_number: $('opt-nopage').checked,
      smart_table_align: $('opt-table').checked,
      space_mode: $('opt-space').value
    };
    if (m === 'custom') opts.custom_preset = readForm();
    var p = m === 'analyze'
      ? call({ cmd: 'analyze', input: state.input.slice(0) })
      : call({ cmd: 'run', mode: m, input: state.input.slice(0), reference: m === 'mimic' ? state.ref.slice(0) : null, opts: opts });
    p.then(function (res) {
      state.busy = false; $('go').classList.remove('busy'); refresh();
      if (res.type === 'error') return showError('处理失败：' + res.message + '。可以把文件发给平台维护人排查。');
      var chips = $('chips'); chips.innerHTML = '';
      $('report').hidden = true; $('download').hidden = true; $('download-note').textContent = '';
      if (res.type === 'analyzed') {
        $('result-title').textContent = '诊断结果';
        $('report').textContent = res.report.split('\n').filter(function (l) { return !/formatter\.py|^建议/.test(l.trim()); }).join('\n').trim();
        $('report').hidden = false;
      } else {
        $('result-title').textContent = m === 'punctuation' ? '标点修复完成' : '排版完成';
        var counts = (res.result && res.result.counts) || {};
        Object.keys(counts).forEach(function (k) {
          var s = document.createElement('span'); s.className = 'chip caption-4'; s.textContent = k + ' ' + counts[k] + ' 段'; chips.appendChild(s);
        });
        state.out = res.file;
        state.outName = state.inputName.replace(/\.docx$/i, '') + (m === 'punctuation' ? '-标点已修复' : '-已排版') + '.docx';
        $('download').hidden = false;
      }
      $('result').hidden = false;
    });
  });

  $('download').addEventListener('click', function () {
    if (!state.out) return;
    var blob = new Blob([state.out], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadsP.then(function (dl) {
      if (dl) {
        return dl.save({ filename: state.outName, data: blob })
          .then(function () { $('download-note').textContent = '已保存：' + state.outName; })
          .catch(function (err) {
            $('download-note').textContent = err && err.code === 'declined' ? '已取消下载。' : '这里无法下载，请在部署后的网站上使用。';
          });
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = state.outName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      $('download-note').textContent = '已开始下载：' + state.outName;
    });
  });
})();
