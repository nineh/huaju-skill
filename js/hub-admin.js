/* 审核管理：待审核队列、上下架、操作记录（权限由数据库校验，页面只是入口） */
(function () {
  'use strict';
  var H = window.Hub, el = H.el;
  var gate = document.getElementById('gate'), wrap = document.getElementById('admin');
  var ACTIONS = { submit: '提交', approve: '通过', reject: '驳回', withdraw: '撤回', hide: '下架', unhide: '上架' };

  document.querySelectorAll('.tab').forEach(function (t) {
    t.onclick = function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      document.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; });
      ({ queue: loadQueue, skills: loadSkills, audit: loadAudit })[t.dataset.tab]();
    };
  });

  function loadQueue() {
    var box = document.getElementById('queue'); box.innerHTML = '<div class="skel"></div>';
    H.sb.from('hub_versions').select('id,version,changelog,skill_md,files,meta,storage_path,static_url,size_bytes,status,submitted_email,created_at,skill:hub_skills(id,slug,display_name,status,latest_version)')
      .eq('status', 'pending').order('created_at').then(function (r) {
        box.innerHTML = '';
        document.getElementById('qn').textContent = r.data && r.data.length ? '（' + r.data.length + '）' : '';
        if (r.error) { box.appendChild(el('div', 'empty body-6 err', H.errText(r.error))); return; }
        if (!r.data.length) { box.appendChild(el('div', 'empty body-6', '没有待审核的提交。')); return; }
        r.data.forEach(function (v) { box.appendChild(item(v)); });
      });
  }

  function item(v) {
    var m = v.meta || {}, it = el('div', 'row-item'), top = el('div', 'top'), l = el('div', 'acts');
    l.appendChild(el('span', 'title-2', (m.display_name || v.skill.display_name) + ' v' + v.version));
    l.appendChild(el('span', 'tag caption-3', v.skill.latest_version ? '新版本（当前 v' + v.skill.latest_version + '）' : '新技能'));
    if (m.visibility === 'internal') l.appendChild(el('span', 'tag lock caption-3', '仅所内'));
    top.appendChild(l);
    top.appendChild(el('span', 'caption-5 quiet', v.submitted_email + ' · ' + H.fmtDate(v.created_at)));
    it.appendChild(top);
    it.appendChild(el('p', 'body-6 muted', [v.skill.slug, m.category, m.author, m.license, H.fmtSize(v.size_bytes), (v.files || []).length + ' 个文件'].filter(Boolean).join(' · ')));
    if (m.summary) it.appendChild(el('p', 'body-6', m.summary));
    if (v.changelog) it.appendChild(el('p', 'body-6 muted', '改动：' + v.changelog));
    var det = el('details'); det.appendChild(el('summary', 'title-4', '查看 SKILL.md 和文件列表'));
    var mdBox = el('div'); mdBox.style.margin = '12px 0'; det.appendChild(mdBox);
    var ul = el('ul', 'files'); (v.files || []).forEach(function (f) { var li = el('li'); li.appendChild(el('span', 'mono', f.path)); li.appendChild(el('span', 'quiet', H.fmtSize(f.size))); ul.appendChild(li); });
    det.appendChild(ul);
    det.addEventListener('toggle', function () { if (det.open && !mdBox.firstChild) H.renderMarkdown(mdBox, v.skill_md); });
    it.appendChild(det);
    var note = el('input'); note.placeholder = '审核意见（驳回必填）'; note.maxLength = 300;
    note.style.cssText = 'font:inherit;font-size:14px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;flex:1;min-width:200px';
    var acts = el('div', 'acts'), msg = el('span', 'caption-5');
    var dl = el('button', 'btn ghost button-sm', '下载包检查'); dl.type = 'button';
    dl.onclick = function () { H.download(v.skill, v).catch(function (e) { msg.textContent = H.errText(e); msg.className = 'caption-5 err'; }); };
    var ok = el('button', 'btn button-sm', '通过并上架'); ok.type = 'button';
    var no = el('button', 'btn danger button-sm', '驳回'); no.type = 'button';
    function review(approve) {
      if (!approve && !note.value.trim()) { msg.textContent = '驳回请写明理由'; msg.className = 'caption-5 err'; note.focus(); return; }
      ok.disabled = no.disabled = true;
      H.sb.rpc('hub_review', { p_version_id: v.id, p_approve: approve, p_note: note.value.trim() || null }).then(function (r) {
        if (r.error) { msg.textContent = H.errText(r.error); msg.className = 'caption-5 err'; ok.disabled = no.disabled = false; return; }
        loadQueue();
      });
    }
    ok.onclick = function () { review(true); }; no.onclick = function () { review(false); };
    acts.appendChild(dl); acts.appendChild(note); acts.appendChild(ok); acts.appendChild(no); acts.appendChild(msg);
    it.appendChild(acts);
    return it;
  }

  function loadSkills() {
    var box = document.getElementById('skills'); box.innerHTML = '<div class="skel"></div>';
    H.sb.from('hub_catalog').select('slug,display_name,status,visibility,source,category,latest_version,download_count,rating_avg,rating_count,updated_at').order('updated_at', { ascending: false }).then(function (r) {
      box.innerHTML = '';
      if (r.error) { box.appendChild(el('div', 'empty body-6 err', H.errText(r.error))); return; }
      r.data.forEach(function (s) {
        var it = el('div', 'row-item'), top = el('div', 'top'), l = el('div', 'acts');
        var a = el('a', 'title-3', s.display_name); a.href = 'skill.html?s=' + encodeURIComponent(s.slug); l.appendChild(a);
        l.appendChild(H.statusTag(s.status)); if (s.visibility === 'internal') l.appendChild(el('span', 'tag lock caption-3', '仅所内'));
        top.appendChild(l);
        var acts = el('div', 'acts');
        acts.appendChild(el('span', 'caption-5 quiet', [s.slug, s.latest_version ? 'v' + s.latest_version : '无版本', '下载 ' + s.download_count, s.rating_count ? '评分 ' + Number(s.rating_avg).toFixed(1) : ''].filter(Boolean).join(' · ')));
        if (s.status !== 'pending') {
          var b = el('button', 'btn ghost button-sm', s.status === 'hidden' ? '重新上架' : '下架'); b.type = 'button';
          b.onclick = function () {
            if (s.status !== 'hidden' && !confirm('下架「' + s.display_name + '」？下架后技能库里看不到，但数据保留。')) return;
            H.sb.rpc('hub_set_status', { p_slug: s.slug, p_status: s.status === 'hidden' ? 'published' : 'hidden' }).then(function (x) { if (x.error) alert(H.errText(x.error)); loadSkills(); });
          };
          acts.appendChild(b);
        }
        top.appendChild(acts); it.appendChild(top); box.appendChild(it);
      });
    });
  }

  function loadAudit() {
    var box = document.getElementById('audit'); box.innerHTML = '<div class="skel"></div>';
    H.sb.from('hub_audit').select('*').order('created_at', { ascending: false }).limit(200).then(function (r) {
      box.innerHTML = '';
      if (r.error) { box.appendChild(el('div', 'empty body-6 err', H.errText(r.error))); return; }
      if (!r.data.length) { box.appendChild(el('div', 'empty body-6', '还没有操作记录。')); return; }
      r.data.forEach(function (a) {
        var it = el('div', 'row-item'), top = el('div', 'top');
        top.appendChild(el('span', 'body-6', (a.actor_email || '系统') + ' ' + (ACTIONS[a.action] || a.action) + ' ' + (a.target || '')));
        top.appendChild(el('span', 'caption-5 quiet', new Date(a.created_at).toLocaleString('zh-CN')));
        it.appendChild(top);
        if (a.detail && a.detail.note) it.appendChild(el('p', 'caption-5 muted', '意见：' + a.detail.note));
        box.appendChild(it);
      });
    });
  }

  H.onAuth(function (s) {
    gate.innerHTML = ''; wrap.hidden = !s.admin;
    if (s.admin) { loadQueue(); return; }
    var n = el('div', 'empty'); n.appendChild(el('p', 'body-3', s.user ? '当前账号不是管理员。管理员名单在数据库 hub_admins 表里维护。' : '请先登录管理员账号。'));
    if (!s.user) { var b = el('button', 'btn button-md', '登录'); b.type = 'button'; b.style.marginTop = '16px'; b.onclick = function () { H.openLogin(); }; n.appendChild(b); }
    gate.appendChild(n);
  });
})();
