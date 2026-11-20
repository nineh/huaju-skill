/* 技能库：目录、搜索、筛选、排序 */
(function () {
  'use strict';
  var H = window.Hub, el = H.el;
  var grid = document.getElementById('grid'), q = document.getElementById('q'), source = document.getElementById('source'),
    sort = document.getElementById('sort'), cats = document.getElementById('cats'), count = document.getElementById('count'),
    starredWrap = document.getElementById('starred-wrap'), starred = document.getElementById('starred');
  var all = [], myStars = {}, cat = '';

  q.value = H.param('q') || ''; source.value = H.param('source') || ''; cat = H.param('cat') || '';
  if (H.param('sort')) sort.value = H.param('sort');

  function syncUrl() {
    var p = new URLSearchParams();
    if (q.value.trim()) p.set('q', q.value.trim()); if (source.value) p.set('source', source.value);
    if (cat) p.set('cat', cat); if (sort.value !== 'downloads') p.set('sort', sort.value);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }

  function card(s) {
    var c = el('a', 'skill-card'); c.href = 'skill.html?s=' + encodeURIComponent(s.slug);
    c.appendChild(H.tags(s));
    c.appendChild(el('h3', 'title-2', s.display_name));
    if (s.summary) c.appendChild(el('p', 'body-6 muted', s.summary));
    var by = el('div', 'author');
    by.appendChild(el('span', 'avatar', (s.author || '?').slice(0, 1)));
    var t = el('span', 'author-text'); t.appendChild(el('span', 'title-4', s.author));
    t.appendChild(el('span', 'caption-5 quiet', [s.license, s.latest_version ? 'v' + s.latest_version : ''].filter(Boolean).join(' · ') || '作者'));
    by.appendChild(t); c.appendChild(by);
    var st = el('div', 'stats caption-4 quiet');
    st.appendChild(el('span', 'stat', '下载 ' + s.download_count));
    st.appendChild(el('span', 'stat', s.rating_count ? '评分 ' + Number(s.rating_avg).toFixed(1) + '（' + s.rating_count + '）' : '暂无评分'));
    st.appendChild(el('span', 'stat', '收藏 ' + s.star_count));
    c.appendChild(st);
    return c;
  }

  function renderCats() {
    var list = []; all.forEach(function (s) { if (list.indexOf(s.category) < 0) list.push(s.category); });
    cats.innerHTML = '';
    [''].concat(list).forEach(function (c) {
      var b = el('button', 'chip', c || '全部'); b.type = 'button'; b.setAttribute('aria-pressed', String(c === cat));
      b.onclick = function () { cat = c; renderCats(); render(); };
      cats.appendChild(b);
    });
  }

  function render() {
    syncUrl();
    var kw = q.value.trim().toLowerCase();
    var rows = all.filter(function (s) {
      if (source.value && s.source !== source.value) return false;
      if (cat && s.category !== cat) return false;
      if (starred.checked && !myStars[s.id]) return false;
      if (!kw) return true;
      return [s.display_name, s.summary, s.author, s.slug, s.category].join(' ').toLowerCase().indexOf(kw) >= 0;
    });
    var key = sort.value;
    rows.sort(function (a, b) {
      if (key === 'rating') return (b.rating_avg - a.rating_avg) || (b.rating_count - a.rating_count) || (b.download_count - a.download_count);
      if (key === 'updated') return new Date(b.updated_at) - new Date(a.updated_at);
      return (b.download_count - a.download_count) || a.display_name.localeCompare(b.display_name, 'zh');
    });
    grid.innerHTML = '';
    count.textContent = '共 ' + rows.length + ' 个技能';
    if (!rows.length) { var e = el('div', 'empty body-6', all.length ? '没有符合条件的技能，换个关键词试试。' : '技能库还是空的。'); grid.appendChild(e); return; }
    rows.forEach(function (s) { grid.appendChild(card(s)); });
  }

  function load() {
    if (!H.sb) { grid.innerHTML = ''; grid.appendChild(el('div', 'empty body-6', '技能库数据库还没配置好，请联系平台维护人。')); return; }
    H.sb.from('hub_catalog').select('*').eq('status', 'published').then(function (r) {
      if (r.error) throw r.error;
      all = r.data || []; renderCats(); render();
    }).catch(function (e) { grid.innerHTML = ''; grid.appendChild(el('div', 'empty body-6 err', '技能库加载失败：' + H.errText(e))); });
  }

  H.onAuth(function (s) {
    starredWrap.hidden = !s.staff;
    if (!s.staff) return;
    H.sb.from('hub_stars').select('skill_id').then(function (r) {
      myStars = {}; (r.data || []).forEach(function (x) { myStars[x.skill_id] = true; }); if (starred.checked) render();
    });
  });
  [q, source, sort, starred].forEach(function (x) { x.addEventListener(x === q ? 'input' : 'change', render); });
  load();
})();
