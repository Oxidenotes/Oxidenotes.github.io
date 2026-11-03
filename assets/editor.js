/* Oxide in-place editor. Loaded by site.js when the URL has ?edit.
   Click any text to change it; every section and card is a block with its own buttons.
   "Save & publish" writes content.json to GitHub with your own token (kept in this browser only). */
(function () {
  var REPO = 'anasbq/Oxide.github.io', BRANCH = 'main', PATH = 'content.json';
  var KEY = 'oxide_admin_token', DRAFT = 'oxide_draft';
  var api, sha = null, dirty = false, hist = [], bar, saveBtn, undoBtn, stateEl, langEl;

  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, title, fn, cls) { var b = el('button', 'oxb ' + (cls || ''), text); b.type = 'button'; if (title) { b.title = title; b.setAttribute('aria-label', title); } b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); fn(e); }; return b; }
  function toast(m, err) { var t = el('div', 'oxtoast' + (err ? ' err' : ''), m); t.setAttribute('role', 'status'); document.body.append(t); setTimeout(function () { t.remove(); }, err ? 8000 : 4000); }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var D = function () { return api.data; };

  /* ---------- paths into content.json ---------- */
  function walk(path, create) {
    var keys = path.split('.'), o = D();
    for (var i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) { if (!create) return null; o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {}; }
      o = o[keys[i]];
    }
    return { obj: o, key: keys[keys.length - 1] };
  }
  function setText(path, v) {
    var w = walk(path, true), cur = w.obj[w.key];
    if (cur == null || typeof cur !== 'object') cur = w.obj[w.key] = typeof cur === 'string' ? { en: cur, ar: cur } : {};
    cur[api.lang] = v;
  }
  function setRaw(path, v) { var w = walk(path, true); if (v) w.obj[w.key] = v; else delete w.obj[w.key]; }

  /* ---------- history, draft, dirty ---------- */
  function snap() { hist.push(JSON.stringify(D())); if (hist.length > 80) hist.shift(); undoBtn.disabled = false; }
  function undo() { if (!hist.length) return; api.data = JSON.parse(hist.pop()); undoBtn.disabled = !hist.length; changed(); api.render(); }
  var draftT;
  function changed() {
    dirty = true; paint();
    clearTimeout(draftT); draftT = setTimeout(function () { ls.set(DRAFT, JSON.stringify({ data: D(), sha: sha, at: Date.now() })); }, 300);
  }
  function paint() {
    stateEl.textContent = dirty ? '● تعديلات ما انتشرت' : '✓ كل شيء منشور';
    stateEl.className = 'oxstate' + (dirty ? ' dirty' : '');
    saveBtn.disabled = !dirty;
    langEl.textContent = '';
  }
  /* a structural change: remember the old state, apply, redraw */
  function op(fn) { snap(); fn(); changed(); api.render(); }

  /* ---------- GitHub ---------- */
  function gh(path, opts) {
    opts = opts || {};
    var tok = ls.get(KEY), h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (tok) h.Authorization = 'Bearer ' + tok;
    if (opts.body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + REPO + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) throw new Error('مفتاح GitHub غير صالح أو منتهي. حدّثه من زر 🔑.');
        if (r.status === 403 || r.status === 404) throw new Error('المفتاح ما يقدر يكتب على ' + REPO + ' (لازم صلاحية Contents: Read and write).');
        if (r.status === 409 || r.status === 422) throw new Error('الملف تغيّر من مكان ثاني. اضغط حفظ مرة ثانية.');
        if (!r.ok) throw new Error('رفض GitHub الطلب (' + r.status + ').');
        return r.json();
      });
  }
  var b64 = function (s) { return btoa(unescape(encodeURIComponent(s))); };
  var unb64 = function (s) { return decodeURIComponent(escape(atob(s.replace(/\n/g, '')))); };
  function remote() { return gh('/contents/' + PATH + '?ref=' + BRANCH).then(function (f) { return { sha: f.sha, data: JSON.parse(unb64(f.content)) }; }); }

  function save() {
    if (!ls.get(KEY)) { tokenPanel(true); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'ينشر…';
    var active = document.activeElement; if (active && active.blur) active.blur();
    remote().then(function (r) {
      if (sha && r.sha !== sha && !confirm('content.json تغيّر على GitHub بعد ما فتحت التعديل. تبي تكتب نسختك فوقه؟')) throw new Error('ما انحفظ شيء.');
      return gh('/contents/' + PATH, { method: 'PUT', body: { message: 'Update site content (in-page editor)', content: b64(JSON.stringify(D(), null, 1) + '\n'), branch: BRANCH, sha: r.sha } });
    }).then(function (r) {
      sha = r.content.sha; dirty = false; ls.del(DRAFT); paint();
      toast('انتشر ✓ الموقع العام يتحدّث خلال دقيقة أو دقيقتين.');
    }).catch(function (e) { toast(e.message, true); saveBtn.disabled = !dirty; })
      .then(function () { saveBtn.textContent = 'حفظ ونشر'; });
  }
  function discard() {
    if (!dirty && !hist.length) return;
    if (!confirm('تمسح كل التعديلات اللي ما انتشرت وترجع للنسخة المنشورة؟')) return;
    ls.del(DRAFT); dirty = false; location.reload();
  }

  /* ---------- side panels ---------- */
  var panel;
  function openPanel(title) {
    closePanel();
    panel = el('aside', 'oxpanel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', title);
    var hd = el('div', 'oxph'); hd.append(el('strong', '', title), btn('✕', 'إغلاق', closePanel)); panel.append(hd);
    var body = el('div', 'oxpb'); panel.append(body); document.body.append(panel);
    return body;
  }
  function closePanel() { if (panel) { panel.remove(); panel = null; } }

  function tokenPanel(forSave) {
    var b = openPanel('🔑 مفتاح GitHub');
    if (forSave) b.append(el('p', 'oxwarn', 'عشان تنشر، حط مفتاحك مرة وحدة.'));
    b.append(el('p', '', 'المفتاح يبقى في هذا المتصفح بس، ويُستخدم لكتابة content.json في ' + REPO + '.'));
    var ol = el('ol'); ['افتح github.com/settings/personal-access-tokens/new', 'Repository access: Only select repositories → ' + REPO, 'Permissions → Contents: Read and write', 'Generate token وانسخه هنا'].forEach(function (t) { ol.append(el('li', '', t)); }); b.append(ol);
    var i = el('input'); i.type = 'password'; i.autocomplete = 'off'; i.placeholder = ls.get(KEY) ? '•••••••• (محفوظ)' : 'github_pat_…'; i.className = 'oxin'; b.append(i);
    var msg = el('p', 'oxmsg'); var row = el('div', 'oxrow');
    row.append(btn('حفظ وتجربة', '', function () {
      var v = i.value.trim(); if (v) ls.set(KEY, v);
      if (!ls.get(KEY)) { msg.textContent = 'الصق المفتاح أول.'; return; }
      msg.textContent = 'يجرب…';
      gh('').then(function (r) {
        if (!r.permissions || !r.permissions.push) throw new Error('المفتاح يقرأ بس، ما يقدر يكتب.');
        i.value = ''; i.placeholder = '•••••••• (محفوظ)'; msg.textContent = '✓ المفتاح شغّال.';
        if (!sha) remote().then(function (x) { sha = x.sha; });
        if (forSave) { closePanel(); save(); }
      }).catch(function (e) { msg.textContent = e.message; });
    }, 'pri'));
    if (ls.get(KEY)) row.append(btn('حذف المفتاح', '', function () { ls.del(KEY); i.placeholder = 'github_pat_…'; msg.textContent = 'انحذف من هذا المتصفح.'; }));
    b.append(row, msg); i.focus();
  }

  function pagesPanel() {
    var b = openPanel('📄 الصفحات');
    var pages = D().pages = D().pages || [], here = new URLSearchParams(location.search).get('p');
    pages.forEach(function (p, i) {
      var r = el('div', 'oxpage');
      var t = el('div', 'oxpt'); t.append(el('strong', '', (p.title && (p.title[api.lang] || p.title.en)) || p.slug), el('code', '', 'page.html?p=' + p.slug)); r.append(t);
      var nav = el('label', 'oxchk'), cb = el('input'); cb.type = 'checkbox'; cb.checked = p.nav !== false;
      cb.onchange = function () { op(function () { p.nav = cb.checked; }); }; nav.append(cb, el('span', '', 'في القائمة')); r.append(nav);
      var a = el('a', 'oxb', 'فتح'); a.href = 'page.html?p=' + encodeURIComponent(p.slug) + '&edit'; r.append(a);
      if (i > 0) r.append(btn('⬆', 'قدّمها', function () { op(function () { pages.splice(i - 1, 0, pages.splice(i, 1)[0]); }); pagesPanel(); }));
      r.append(btn('🗑', 'حذف الصفحة', function () {
        if (!confirm('تحذف صفحة «' + p.slug + '»؟ (تقدر تتراجع قبل النشر)')) return;
        op(function () { pages.splice(i, 1); });
        if (p.slug === here) location.href = './?edit'; else pagesPanel();
      }, 'del'));
      b.append(r);
    });
    b.append(el('h4', '', 'صفحة جديدة'));
    var i = el('input'); i.className = 'oxin'; i.placeholder = 'العنوان، مثلاً: الأسعار';
    var msg = el('p', 'oxmsg');
    b.append(i, btn('+ أنشئ الصفحة', '', function () {
      var title = i.value.trim(); if (!title) { msg.textContent = 'اكتب عنوان.'; return; }
      var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page-' + (pages.length + 1);
      while (pages.some(function (p) { return p.slug === slug; })) slug += '-2';
      var t = {}; t[api.lang] = title; var body = {}; body[api.lang] = api.lang === 'ar' ? 'اكتب محتوى الصفحة هنا.' : 'Write the page here.';
      snap(); pages.push({ slug: slug, nav: true, title: t, body: body }); changed(); ls.set(DRAFT, JSON.stringify({ data: D(), sha: sha, at: Date.now() }));
      location.href = 'page.html?p=' + encodeURIComponent(slug) + '&edit';
    }, 'pri'), msg);
  }

  function mdPanel(path, target) {
    var b = openPanel('✍️ نص الصفحة');
    b.append(el('p', 'oxhint', 'Markdown: ## عنوان · **عريض** · - نقطة · [رابط](https://…) · > ملاحظة. التغيير يبان على الصفحة وأنت تكتب.'));
    var w = walk(path, true), cur = w.obj[w.key] || {}, ta = el('textarea', 'oxin oxmd');
    ta.value = (typeof cur === 'string' ? cur : cur[api.lang]) || ''; ta.dir = api.lang === 'ar' ? 'rtl' : 'ltr';
    var first = true;
    ta.oninput = function () {
      if (first) { snap(); first = false; }
      setText(path, ta.value); changed();
      target.innerHTML = window.marked && window.DOMPurify ? DOMPurify.sanitize(marked.parse(ta.value)) : '';
      if (!window.marked) target.textContent = ta.value;
    };
    b.append(ta); ta.focus();
  }

  /* ---------- blocks ---------- */
  var T = function (en, ar) { return { en: en, ar: ar }; };
  var TEMPLATES = {
    cards: function () { return { id: 'sec-' + Date.now().toString(36), layout: 'cards', title: T('New section', 'قسم جديد'), items: [{ icon: '✨', title: T('Card title', 'عنوان البطاقة'), text: T('A short description.', 'وصف قصير.') }] }; },
    steps: function () { return { id: 'sec-' + Date.now().toString(36), layout: 'steps', title: T('How it works', 'كيف يشتغل'), items: [{ title: T('First step', 'الخطوة الأولى'), text: T('', '') }, { title: T('Second step', 'الخطوة الثانية'), text: T('', '') }] }; },
    text: function () { return { id: 'sec-' + Date.now().toString(36), layout: 'text', title: T('A heading', 'عنوان'), lead: T('A paragraph of text.', 'فقرة نص.') }; }
  };
  function newItem(s) { return s.layout === 'steps' ? { title: T('New step', 'خطوة جديدة'), text: T('', '') } : { icon: '✨', title: T('New card', 'بطاقة جديدة'), text: T('', '') }; }
  function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; arr.splice(j, 0, arr.splice(i, 1)[0]); }

  function inserter(at) {
    var w = el('div', 'oxins'), line = el('div', 'oxinsl');
    var add = btn('+ قسم هنا', 'أضف قسم في هذا المكان', function () {
      line.innerHTML = '';
      [['cards', '▦ بطاقات'], ['steps', '①②③ خطوات'], ['text', '¶ نص']].forEach(function (x) {
        line.append(btn(x[1], '', function () { op(function () { (D().sections = D().sections || []).splice(at, 0, TEMPLATES[x[0]]()); }); }));
      });
      line.append(btn('✕', 'إلغاء', function () { line.innerHTML = ''; line.append(add); }));
    });
    line.append(add); w.append(line); return w;
  }

  function sectionBar(sec, si) {
    var secs = D().sections, s = secs[si], tb = el('div', 'oxtb oxsec');
    tb.append(el('span', 'oxlbl', 'قسم'));
    if (si > 0) tb.append(btn('⬆', 'حرّك القسم لفوق', function () { op(function () { move(secs, si, -1); }); }));
    if (si < secs.length - 1) tb.append(btn('⬇', 'حرّك القسم لتحت', function () { op(function () { move(secs, si, 1); }); }));
    var sel = el('select', 'oxsel'); sel.title = 'شكل القسم';
    [['cards', 'بطاقات'], ['steps', 'خطوات'], ['text', 'نص فقط']].forEach(function (x) { var o = el('option', '', x[1]); o.value = x[0]; sel.append(o); });
    sel.value = s.layout || 'cards';
    sel.onchange = function () { op(function () { s.layout = sel.value; if (sel.value !== 'text' && !(s.items && s.items.length)) s.items = [newItem(s)]; }); };
    tb.append(sel);
    tb.append(btn(s.bg === 'grey' ? '◻ أبيض' : '◼ رمادي', 'لون الخلفية', function () { op(function () { if (s.bg === 'grey') delete s.bg; else s.bg = 'grey'; }); }));
    if (s.layout !== 'text') tb.append(btn('+ ' + (s.layout === 'steps' ? 'خطوة' : 'بطاقة'), 'أضف عنصر', function () { op(function () { (s.items = s.items || []).push(newItem(s)); }); }));
    tb.append(btn('⧉', 'كرّر القسم', function () { op(function () { var c = clone(s); c.id = (s.id || 'sec') + '-copy'; secs.splice(si + 1, 0, c); }); }));
    tb.append(btn('🗑', 'احذف القسم', function () { op(function () { secs.splice(si, 1); }); toast('انحذف القسم. ↶ تراجع يرجّعه.'); }, 'del'));
    sec.prepend(tb);
  }
  function itemBar(node, s, ii) {
    var items = s.items, tb = el('div', 'oxtb oxitem');
    if (ii > 0) tb.append(btn('⬆', 'قدّم', function () { op(function () { move(items, ii, -1); }); }));
    if (ii < items.length - 1) tb.append(btn('⬇', 'أخّر', function () { op(function () { move(items, ii, 1); }); }));
    tb.append(btn('⧉', 'كرّر', function () { op(function () { items.splice(ii + 1, 0, clone(items[ii])); }); }));
    tb.append(btn('✕', 'احذف', function () { op(function () { items.splice(ii, 1); }); }, 'del'));
    node.append(tb);
  }
  function listControls(container, selector, arrPath, label) {
    var w = walk(arrPath, true); if (!Array.isArray(w.obj[w.key])) w.obj[w.key] = [];
    var arr = w.obj[w.key];
    container.querySelectorAll(selector).forEach(function (n, i) {
      var x = btn('✕', 'احذف', function () { op(function () { arr.splice(i, 1); }); }, 'del oxx');
      var host = n.parentNode.tagName === 'LI' ? n.parentNode : n;
      host.classList.add('oxli');
      if (host === n) n.after(x); else host.append(x);
    });
    return btn('+ ' + label, '', function () {
      op(function () { arr.push(T('', '')); });
      setTimeout(function () { var all = container.querySelectorAll(selector); if (all.length) all[all.length - 1].focus(); }, 0);
    }, 'oxadd');
  }

  /* ---------- editable text ---------- */
  var PT = (function () { var d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; })();
  function editable(n, onText) {
    n.contentEditable = PT; n.spellcheck = true; n.classList.add('oxed');
    var started = false;
    n.addEventListener('focus', function () { started = false; });
    n.addEventListener('input', function () { if (!started) { snap(); started = true; } onText(n.innerText.replace(/\s*\n\s*/g, ' ').replace(/ /g, ' ').trim()); changed(); });
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); n.blur(); } if (e.key === 'Escape') n.blur(); });
    n.addEventListener('paste', function (e) { e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s+/g, ' '); document.execCommand('insertText', false, t); });
    n.addEventListener('blur', function () { if (!n.textContent.trim()) n.textContent = ''; });
  }

  function decorate() {
    document.body.classList.add('ox-editing');
    var main = document.getElementById('top');

    document.querySelectorAll('[data-p]').forEach(function (n) {
      if (!n.dataset.hint) n.dataset.hint = api.lang === 'ar' ? 'اكتب هنا…' : 'Type here…';
      editable(n, function (v) { setText(n.dataset.p, v); if (n.dataset.p === 'hero.button') document.getElementById('navcta').textContent = v; });
    });
    document.querySelectorAll('[data-raw]').forEach(function (n) {
      if (!n.dataset.hint || n.dataset.hint === 'note') n.dataset.hint = n.dataset.raw === 'pilot.email' ? 'name@example.com' : 'Folder / note (optional)';
      editable(n, function (v) { setRaw(n.dataset.raw, v); });
    });
    document.querySelectorAll('[data-icon]').forEach(function (n) {
      n.title = 'اضغط وغيّر الإيموجي'; n.classList.add('oxicon');
      if (n.classList.contains('ph-ic')) n.textContent = '';
      n.dataset.hint = '＋';
      editable(n, function (v) { setRaw(n.dataset.icon, v.slice(0, 12)); });
    });
    document.querySelectorAll('[data-md]').forEach(function (n) {
      n.classList.add('oxmdblock'); n.title = 'اضغط عشان تعدّل نص الصفحة';
      n.addEventListener('click', function (e) { e.preventDefault(); mdPanel(n.dataset.md, n); });
      if (!n.textContent.trim()) n.append(el('p', 'oxhint', api.lang === 'ar' ? 'اضغط هنا واكتب محتوى الصفحة…' : 'Click to write this page…'));
    });

    if (api.mode === 'home') {
      var secs = D().sections || [], nodes = main.querySelectorAll('section[data-si]');
      nodes.forEach(function (sec) {
        var si = +sec.dataset.si, s = secs[si]; sec.classList.add('oxblock');
        sectionBar(sec, si);
        sec.querySelectorAll('[data-ii]').forEach(function (n) { n.classList.add('oxcard'); itemBar(n, s, +n.dataset.ii); });
        sec.after(inserter(si + 1));
      });
      var anchor = main.querySelector('.ribbon') || main.querySelector('.hero');
      if (anchor) anchor.after(inserter(0));
      var rib = main.querySelector('.ribbon .wrap');
      if (rib) rib.append(listControls(rib, '.rib', 'ribbon', 'عبارة'));
      var ul = main.querySelector('#pilot .contact ul');
      if (ul) ul.after(listControls(ul, 'li > [data-p]', 'pilot.bullets', 'نقطة'));
      var pilot = main.querySelector('#pilot .pilot');
      if (pilot) pilot.append(el('p', 'oxnote', D().pilot.form_url ? 'نموذج التسجيل يرسل إلى Google Sheet (pilot.form_url).' : 'لتفعيل نموذج التسجيل، حط رابط Apps Script في content.json → pilot.form_url.'));
    }

    /* keep ?edit on links inside the site; stop editable links from navigating */
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!h || h[0] === '#' || /^[a-z]+:/i.test(h) || /[?&]edit\b/.test(h)) return;
      var hash = h.split('#'), u = hash[0] || './';
      a.setAttribute('href', u + (u.indexOf('?') > -1 ? '&' : '?') + 'edit' + (hash[1] ? '#' + hash[1] : ''));
    });
    if (bar) paint();
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (a && (a.isContentEditable || a.querySelector('.oxed'))) e.preventDefault();
  }, true);
  addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty) save(); }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z' && !(document.activeElement && document.activeElement.isContentEditable) && !/TEXTAREA|INPUT/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); }
  });
  /* moving between pages keeps the draft, so only warn when the tab itself closes */
  addEventListener('beforeunload', function (e) { if (dirty) { ls.set(DRAFT, JSON.stringify({ data: D(), sha: sha, at: Date.now() })); } });

  function buildBar() {
    bar = el('div', 'oxbar'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'أدوات التعديل');
    var l = el('div', 'oxbl'); l.append(el('strong', '', '✏️ وضع التعديل'));
    langEl = el('span', 'oxlang'); stateEl = el('span', 'oxstate'); l.append(langEl, stateEl);
    var r = el('div', 'oxbr');
    undoBtn = btn('↶ تراجع', 'تراجع (Ctrl+Z)', undo); undoBtn.disabled = true;
    saveBtn = btn('حفظ ونشر', 'Ctrl+S', save, 'pri');
    r.append(undoBtn, btn('📄 الصفحات', 'إدارة الصفحات', pagesPanel), btn('🔑', 'مفتاح GitHub', function () { tokenPanel(false); }), btn('إلغاء التعديلات', 'رجوع للنسخة المنشورة', discard), saveBtn,
      btn('خروج', 'شوف الموقع مثل الزوار', function () {
        if (dirty && !confirm('عندك تعديلات ما انتشرت. تبقى محفوظة كمسودة في هذا المتصفح. تطلع؟')) return;
        location.href = location.pathname + location.search.replace(/[?&]edit(=[^&]*)?/, '').replace(/^&/, '?') + location.hash;
      }));
    bar.append(l, r); document.body.append(bar);
  }

  function css() {
    var s = document.createElement('style');
    s.textContent = [
      'body.ox-editing{padding-bottom:84px}',
      '.oxed{outline:1.5px dashed transparent;outline-offset:3px;border-radius:6px;cursor:text;transition:outline-color .12s}',
      '.oxed:hover{outline-color:rgba(30,90,168,.45)}',
      '.oxed:focus{outline:2px solid var(--teal);background:rgba(20,184,166,.07)}',
      '.oxed:empty::before{content:attr(data-hint);color:#98A2AE;font-style:italic;pointer-events:none}',
      '.pilot .oxed:empty::before,.ribbon .oxed:empty::before{color:rgba(255,255,255,.65)}',
      '.oxicon{min-width:1.4em;display:inline-block}',
      '.oxblock{position:relative}',
      '.oxblock:hover{box-shadow:inset 0 0 0 2px rgba(30,90,168,.18)}',
      '.oxtb{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-family:var(--body);font-size:13px;direction:rtl}',
      '.oxsec{position:absolute;top:10px;inset-inline-end:max(16px,calc(50% - 544px));z-index:5;background:#16212E;color:#fff;border-radius:12px;padding:5px;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:.25;transition:opacity .15s}',
      '.oxblock:hover>.oxsec,.oxsec:focus-within{opacity:1}',
      '.oxlbl{padding:0 6px;color:#9FB3C8;font-weight:600}',
      '.oxcard{position:relative}',
      '.oxitem{position:absolute;top:8px;inset-inline-end:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:3px;opacity:0;transition:opacity .15s}',
      '.oxcard:hover>.oxitem,.oxitem:focus-within{opacity:1}',
      '.oxb{font:inherit;font-size:13px;line-height:1.2;border:0;border-radius:8px;padding:6px 9px;background:transparent;color:inherit;cursor:pointer;text-decoration:none;white-space:nowrap}',
      '.oxb:hover{background:rgba(127,140,160,.2)}',
      '.oxb:disabled{opacity:.4;cursor:default}',
      '.oxb.del:hover{background:#B4232A;color:#fff}',
      '.oxb.pri{background:var(--teal);color:#fff;font-weight:600}',
      '.oxb.pri:hover{background:#0F9A8B}',
      '.oxsel{font:inherit;font-size:13px;border-radius:8px;border:0;padding:5px;background:#2A3747;color:#fff}',
      '.oxins{height:0;position:relative;z-index:4}',
      '.oxinsl{position:absolute;inset-inline:0;top:-17px;display:flex;justify-content:center;gap:6px;opacity:.35;transition:opacity .15s}',
      '.oxins:hover .oxinsl,.oxinsl:focus-within{opacity:1}',
      '.oxinsl .oxb{background:var(--blue);color:#fff;box-shadow:0 3px 10px rgba(30,90,168,.3);border-radius:999px;padding:7px 14px}',
      '.oxli{position:relative}',
      '.oxx{padding:0 6px;margin-inline-start:2px;opacity:0;font-size:12px}',
      '.oxli:hover .oxx{opacity:1}',
      '.oxadd{border:1.5px dashed currentColor;opacity:.7;border-radius:999px}',
      '.ribbon .oxadd{color:#fff}',
      '.oxnote{grid-column:1/-1;font-size:13px;opacity:.75;margin:0}',
      '.oxmdblock{cursor:pointer;border-radius:12px;outline:1.5px dashed rgba(30,90,168,.35);outline-offset:10px;min-height:60px}',
      '.oxmdblock:hover{outline-color:var(--teal)}',
      '.oxhint{color:var(--ink-2);font-size:13.5px}',
      '.oxbar{position:fixed;bottom:12px;inset-inline:12px;z-index:50;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;background:#16212E;color:#fff;border-radius:16px;padding:8px 10px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-family:var(--body);font-size:14px;direction:rtl}',
      '.oxbl,.oxbr{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}',
      '.oxbr{gap:4px}',
      '.oxlang{color:#9FB3C8;font-size:13px}',
      '.oxstate{font-size:13px;color:#7EE0D3}.oxstate.dirty{color:#FFD27A}',
      '.oxpanel{position:fixed;top:0;bottom:0;inset-inline-start:0;width:min(440px,100%);z-index:60;background:#fff;color:var(--ink);box-shadow:0 0 40px rgba(0,0,0,.2);display:flex;flex-direction:column;direction:rtl;font-family:var(--body)}',
      '.oxph{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line)}',
      '.oxpb{padding:16px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:10px;font-size:14.5px}',
      '.oxpb ol{margin:0;padding-inline-start:20px;color:var(--ink-2)}',
      '.oxpb h4{margin:14px 0 0;font-family:var(--display)}',
      '.oxin{width:100%;font:inherit;font-size:15px;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;color:var(--ink)}',
      '.oxmd{flex:1;min-height:55vh;font-family:var(--mono);font-size:14px;line-height:1.6;resize:vertical}',
      '.oxrow{display:flex;gap:6px;flex-wrap:wrap}',
      '.oxpanel .oxb{background:var(--grey)}.oxpanel .oxb.pri{background:var(--teal)}',
      '.oxmsg{font-size:13.5px;color:var(--ink-2);margin:0}.oxwarn{color:var(--amber);font-weight:600}',
      '.oxpage{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px;border:1px solid var(--line);border-radius:12px}',
      '.oxpt{flex:1;min-width:150px;display:flex;flex-direction:column}.oxpt code{font-size:12px;color:var(--ink-2);direction:ltr;text-align:start}',
      '.oxchk{display:flex;gap:4px;align-items:center;font-size:13px}',
      '.oxtoast{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);z-index:70;background:#0B7D71;color:#fff;padding:10px 16px;border-radius:12px;font-family:var(--body);font-size:14px;max-width:min(560px,92vw);box-shadow:0 8px 24px rgba(0,0,0,.2)}',
      '.oxtoast.err{background:#B4232A}',
      '@media (max-width:700px){.oxsec{position:static;opacity:1;margin:0 16px 12px;width:auto}.oxitem{opacity:1;position:static;margin-top:10px;width:fit-content}.oxinsl{opacity:1}.oxx{opacity:1}.oxbar{inset-inline:6px;bottom:6px}}'
    ].join('\n');
    document.head.append(s);
  }

  window.OxideEditor = {
    init: function (a) {
      api = a; css(); buildBar();
      var draft = null; try { draft = JSON.parse(ls.get(DRAFT) || 'null'); } catch (e) {}
      var go = ls.get(KEY) ? remote().catch(function (e) { toast(e.message, true); return null; }) : Promise.resolve(null);
      return go.then(function (r) {
        if (r) { sha = r.sha; api.data = r.data; }
        if (draft && draft.data) {
          api.data = draft.data; dirty = true;
          if (r && draft.sha && draft.sha !== r.sha) toast('رجّعت مسودتك اللي ما انتشرت، بس content.json تغيّر بعدها على GitHub.', true);
          else toast('رجّعت مسودتك اللي ما انتشرت.');
        }
        paint();
        if (!ls.get(KEY)) toast('اضغط على أي نص وعدّله. للنشر تحتاج مفتاح GitHub (زر 🔑).');
      });
    },
    decorate: decorate
  };
})();
