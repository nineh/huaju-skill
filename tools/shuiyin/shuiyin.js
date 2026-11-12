/*
 * 证件水印打码（华炬版）
 * 改编自 joyqi/sfz（https://github.com/joyqi/sfz），GPL-3.0。
 * 本文件同样以 GPL-3.0 发布。水印平铺算法沿用原项目；遮挡打码、多图、模板等为韩宇新增。
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('canvas'), ctx = canvas.getContext('2d');
  var images = [];        // {name, img, masks:[{x,y,w,h}]}
  var cur = -1;
  var masking = false, dragStart = null, dragRect = null;
  var downloadsP = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('downloads').catch(function () { return null; }) : Promise.resolve(null);

  // ---------- 水印文字 ----------
  function today() {
    var d = new Date();
    return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
  }
  function watermarkText() {
    var t = $('text').value.trim();
    if (!t) return '';
    return $('with-date').checked ? t + '  ' + today() : t;
  }
  function applyPreset() {
    var tpl = $('preset').value;
    $('purpose-field').hidden = !tpl;
    if (!tpl) return;
    var p = $('purpose').value.trim() || '××';
    $('text').value = tpl.replace('{用途}', p);
  }
  $('preset').addEventListener('change', function () { applyPreset(); render(); });
  $('purpose').addEventListener('input', function () { applyPreset(); render(); });
  $('text').addEventListener('input', function () { $('preset').value = ''; $('purpose-field').hidden = true; render(); });
  $('with-date').addEventListener('change', render);
  applyPreset();

  // ---------- 样式 ----------
  ['alpha', 'angle', 'space', 'size'].forEach(function (k) {
    var el = $(k), out = $(k + '-v');
    var show = function () { out.textContent = k === 'alpha' ? Math.round(el.value * 100) + '%' : k === 'angle' ? el.value + '°' : el.value; };
    show(); el.addEventListener('input', function () { show(); render(); });
  });
  $('color').addEventListener('input', render);
  document.querySelectorAll('.swatch').forEach(function (b) {
    b.addEventListener('click', function () { $('color').value = b.dataset.c; render(); });
  });
  function rgba() {
    var m = $('color').value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + $('alpha').value + ')';
  }

  // ---------- 绘制 ----------
  function drawMosaic(c, img, r) {
    var x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
    var w = Math.min(img.width - x, Math.round(r.w)), h = Math.min(img.height - y, Math.round(r.h));
    if (w < 2 || h < 2) return;
    var block = Math.max(8, Math.round(Math.min(img.width, img.height) / 40));
    var sw = Math.max(1, Math.ceil(w / block)), sh = Math.max(1, Math.ceil(h / block));
    var tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
    var t = tmp.getContext('2d');
    t.drawImage(img, x, y, w, h, 0, 0, sw, sh);
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
    c.restore();
  }
  function drawWatermark(c, W, H) {
    var text = watermarkText();
    if (!text) return;
    var size = $('size').value * Math.max(15, Math.min(W, H) / 25);
    var space = parseFloat($('space').value);
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate($('angle').value * Math.PI / 180);
    c.fillStyle = rgba();
    c.font = '600 ' + size + 'px "PingFang SC","Microsoft YaHei","Noto Sans SC","Hiragino Sans GB",sans-serif';
    var w = c.measureText(text).width, margin = c.measureText('啊').width;
    var diag = Math.sqrt(W * W + H * H);
    var nx = Math.ceil(diag / (w + margin)), ny = Math.ceil(diag / (space * size) / 2);
    for (var i = -nx; i <= nx; i++) {
      for (var j = -ny; j <= ny; j++) {
        // 隔行错开，避免水印排成整齐的竖列、容易被裁掉
        c.fillText(text, (w + margin) * i + (j % 2 ? (w + margin) / 2 : 0), space * size * j);
      }
    }
    c.restore();
  }
  function paint(c, item) {
    var img = item.img;
    c.clearRect(0, 0, img.width, img.height);
    c.drawImage(img, 0, 0);
    item.masks.forEach(function (r) { drawMosaic(c, img, r); });
    drawWatermark(c, img.width, img.height);
  }
  function render() {
    if (cur < 0) return;
    var item = images[cur];
    if (canvas.width !== item.img.width || canvas.height !== item.img.height) {
      canvas.width = item.img.width; canvas.height = item.img.height;
    }
    paint(ctx, item);
    if (dragRect) {
      ctx.save();
      ctx.strokeStyle = '#9D0522'; ctx.lineWidth = Math.max(2, item.img.width / 300);
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
      ctx.restore();
    }
    $('undo').disabled = !item.masks.length;
  }

  // ---------- 图片列表 ----------
  function showStage() {
    var has = images.length > 0;
    $('empty').hidden = has;
    ['thumbs', 'tools', 'wrap', 'dl'].forEach(function (id) { $(id).hidden = !has; });
    $('save-all').hidden = images.length < 2;
  }
  function renderThumbs() {
    var box = $('thumbs'); box.innerHTML = '';
    images.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'thumb' + (i === cur ? ' on' : '');
      b.setAttribute('aria-label', '编辑第 ' + (i + 1) + ' 张：' + it.name);
      var im = document.createElement('img'); im.src = it.url; im.alt = '';
      b.appendChild(im);
      b.addEventListener('click', function () { cur = i; renderThumbs(); render(); });
      box.appendChild(b);
    });
  }
  function addFiles(list) {
    var files = [].filter.call(list, function (f) { return /^image\/(png|jpeg|gif|webp)$/.test(f.type); });
    if (!files.length) { say('只支持 JPG、PNG、GIF、WEBP 图片。HEIC 格式请先在手机里转成 JPG。'); return; }
    var pending = files.length;
    files.forEach(function (f) {
      var url = URL.createObjectURL(f), img = new Image();
      img.onload = function () {
        images.push({ name: f.name.replace(/\.[^.]+$/, ''), img: img, url: url, masks: [] });
        if (--pending === 0) { cur = images.length - 1; showStage(); renderThumbs(); render(); say(''); }
      };
      img.onerror = function () { if (--pending === 0) { showStage(); renderThumbs(); render(); } say('有图片读取失败：' + f.name); };
      img.src = url;
    });
  }
  var drop = $('drop'), file = $('file');
  file.addEventListener('change', function () { addFiles(file.files); file.value = ''; });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { e.preventDefault(); addFiles(e.dataTransfer.files); });
  $('remove').addEventListener('click', function () {
    if (cur < 0) return;
    URL.revokeObjectURL(images[cur].url);
    images.splice(cur, 1);
    cur = Math.min(cur, images.length - 1);
    showStage(); renderThumbs(); render();
  });

  // ---------- 拖框打码 ----------
  function setMasking(on) {
    masking = on;
    $('mask-mode').classList.toggle('on', on);
    $('mask-mode').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('mask-mode').textContent = on ? '完成打码' : '拖框打码';
    $('mask-tip').hidden = !on;
    $('wrap').classList.toggle('masking', on);
  }
  $('mask-mode').addEventListener('click', function () { setMasking(!masking); });
  $('undo').addEventListener('click', function () { if (cur >= 0) { images[cur].masks.pop(); render(); } });
  function toImg(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (!masking || cur < 0) return;
    canvas.setPointerCapture(e.pointerId);
    dragStart = toImg(e); dragRect = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragStart) return;
    var p = toImg(e);
    dragRect = { x: Math.min(p.x, dragStart.x), y: Math.min(p.y, dragStart.y), w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y) };
    render();
  });
  function endDrag() {
    if (!dragStart) return;
    if (dragRect && dragRect.w > 4 && dragRect.h > 4) images[cur].masks.push(dragRect);
    dragStart = null; dragRect = null; render();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---------- 下载 ----------
  function say(t) { $('msg').textContent = t; }
  function exportBlob(item) {
    return new Promise(function (resolve) {
      var c = document.createElement('canvas');
      c.width = item.img.width; c.height = item.img.height;
      paint(c.getContext('2d'), item);
      var png = $('fmt').value === 'png';
      if (!png) { var bg = document.createElement('canvas'); bg.width = c.width; bg.height = c.height; var b = bg.getContext('2d'); b.fillStyle = '#fff'; b.fillRect(0, 0, c.width, c.height); b.drawImage(c, 0, 0); c = bg; }
      c.toBlob(resolve, png ? 'image/png' : 'image/jpeg', 0.92);
    });
  }
  function fileName(item) { return item.name + '-水印.' + ($('fmt').value === 'png' ? 'png' : 'jpg'); }
  function save(item) {
    return exportBlob(item).then(function (blob) {
      var name = fileName(item);
      return downloadsP.then(function (dl) {
        if (dl) return dl.save({ filename: name, data: blob }).then(function () { return name; });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        return name;
      });
    });
  }
  function check() {
    if (!watermarkText()) { say('请先填写水印内容。'); $('text').focus(); return false; }
    return true;
  }
  $('save-one').addEventListener('click', function () {
    if (cur < 0 || !check()) return;
    save(images[cur]).then(function (n) { say('已下载：' + n); }).catch(function (e) { say(e && e.code === 'declined' ? '已取消下载。' : '下载失败，请重试。'); });
  });
  $('save-all').addEventListener('click', function () {
    if (!images.length || !check()) return;
    var i = 0;
    (function next() {
      if (i >= images.length) { say('已全部下载，共 ' + images.length + ' 张。'); return; }
      save(images[i++]).then(function () { setTimeout(next, 400); }).catch(function () { say('第 ' + i + ' 张下载失败，请单独下载。'); });
    })();
  });
})();
