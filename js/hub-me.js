/* 我的：提交记录、审核结果、收藏 */
(function () {
  'use strict';
  var H = window.Hub, el = H.el;
  var gate = document.getElementById('gate'), wrap = document.getElementById('me'), subs = document.getElementById('subs'), starsBox = document.getElementById('stars');

  function loadSubs(uid) {
    subs.innerHTML = '<div class="skel"></div>';
    H.sb.from('hub_versions').select('id,version,status,review_note,changelog,created_at,reviewed_at,skill:hub_skills(slug,display_name,status)')
      .eq('submitted_by', uid).order('created_at', { ascending: false }).then(function (r) {
        subs.innerHTML = '';
        if (r.error) { subs.appendChild(el('div', 'empty body-6 err', H.errText(r.error))); return; }
        if (!r.data.length) {
          var e = el('div', 'empty body-6', '还没有提交过技能。'); var a = el('a', 'card-link button-sm', '去发布'); a.href = 'publish.html'; a.style.marginLeft = '8px'; e.appendChild(a); subs.appendChild(e); return;
        }
        r.data.forEach(function (v) {
          var it = el('div', 'row-item'), top = el('div', 'top'), l = el('div', 'acts');
          var a = el('a', 'title-3', (v.skill ? v.skill.display_name : '?') + ' v' + v.version); a.href = 'skill.html?s=' + encodeURIComponent(v.skill ? v.skill.slug : '');
          l.appendChild(a); l.appendChild(H.statusTag(v.status)); top.appendChild(l);
          top.appendChild(el('span', 'caption-5 quiet', '提交于 ' + H.fmtDate(v.created_at) + (v.reviewed_at ? ' · 审核于 ' + H.fmtDate(v.reviewed_at) : '')));
          it.appendChild(top);
          if (v.changelog) it.appendChild(el('p', 'body-6 muted', v.changelog));
          if (v.review_note) it.appendChild(el('p', 'body-6' + (v.status === 'rejected' ? ' err' : ''), '审核意见：' + v.review_note));
          if (v.status === 'pending') {
            var acts = el('div', 'acts'), w = el('button', 'btn danger button-sm', '撤回'); w.type = 'button';
            w.onclick = function () {
              if (!confirm('撤回这个待审核的版本？')) return;
              H.sb.rpc('hub_withdraw', { p_version_id: v.id }).then(function (x) { if (x.error) alert(H.errText(x.error)); loadSubs(uid); });
            };
            acts.appendChild(w); it.appendChild(acts);
          }
          subs.appendChild(it);
        });
      });
  }

  function loadStars() {
    H.sb.from('hub_stars').select('skill_id').then(function (r) {
      var ids = (r.data || []).map(function (x) { return x.skill_id; });
      starsBox.innerHTML = '';
      if (!ids.length) { starsBox.appendChild(el('div', 'empty body-6', '还没有收藏。在技能详情页点「收藏」。')); return; }
      return H.sb.from('hub_catalog').select('slug,display_name,summary,source,category,visibility,status').in('id', ids).then(function (c) {
        (c.data || []).forEach(function (s) {
          var a = el('a', 'skill-card'); a.href = 'skill.html?s=' + encodeURIComponent(s.slug);
          a.appendChild(H.tags(s)); a.appendChild(el('h3', 'title-2', s.display_name)); if (s.summary) a.appendChild(el('p', 'body-6 muted', s.summary));
          starsBox.appendChild(a);
        });
      });
    });
  }

  H.onAuth(function (s) {
    gate.innerHTML = ''; wrap.hidden = !s.staff;
    if (s.staff) { loadSubs(s.user.id); loadStars(); return; }
    var n = el('div', 'empty'); n.appendChild(el('p', 'body-3', '请先用 @' + H.domain + ' 邮箱登录。'));
    var b = el('button', 'btn button-md', '登录'); b.type = 'button'; b.style.marginTop = '16px'; b.onclick = function () { H.openLogin(); }; n.appendChild(b);
    gate.appendChild(n);
  });
})();
