/* Oxide site: everything is drawn from content.json.
   index.html calls Oxide.home(), page.html calls Oxide.page().
   Add ?edit to any page URL to edit it in place (assets/editor.js). */
(function () {
  /* Arabic first (the main audience); English for visitors whose browser is in another language, or who switch */
  var data = null, lang = 'ar', mode = 'home';
  try { lang = localStorage.getItem('oxide-lang') || (/^ar/.test(navigator.language || 'ar') ? 'ar' : 'en'); } catch (e) {}
  var q = new URLSearchParams(location.search).get('lang'); if (q === 'en' || q === 'ar') lang = q;
  var EDIT = /[?&]edit(?:=|&|$)/.test(location.search);
  function tx(o) { return o ? (o[lang] || '') : ''; }  /* an empty field hides the text instead of showing the other language */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var L = function (en, ar) { return lang === 'ar' ? ar : en; };
  var main = document.getElementById('top');

  /* a text bound to a field of content.json; in edit mode empty optional fields still show, as placeholders */
  function bound(tag, cls, path, obj, hint) {
    var v = tx(obj);
    if (!v && !EDIT) return null;
    var e = el(tag, cls, v); e.dataset.p = path; if (hint) e.dataset.hint = hint;
    return e;
  }
  function add(parent, child) { if (child) parent.append(child); return child; }

  function chrome() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    var links = document.getElementById('links'); links.innerHTML = '';
    var here = new URLSearchParams(location.search).get('p');
    if (mode === 'page') { var h = el('a', '', L('Home', 'الرئيسية')); h.href = './'; links.append(h); }
    (data.pages || []).filter(function (p) { return p.nav !== false && p.slug; }).forEach(function (p) {
      var a = el('a', p.slug === here ? 'on' : '', tx(p.title) || p.slug); a.href = 'page.html?p=' + encodeURIComponent(p.slug); links.append(a);
    });
    document.getElementById('lang').textContent = lang === 'ar' ? 'English' : 'عربي';
    var cta = document.getElementById('navcta'); cta.textContent = tx(data.hero && data.hero.button) || L('Join the pilot', 'انضم للتجربة'); cta.href = mode === 'home' ? '#pilot' : './#pilot';
    var foot = document.getElementById('foot'); foot.textContent = tx(data.footer); foot.dataset.p = 'footer';
    var d = document.querySelector('meta[name=description]'); if (d && data.site) d.content = tx(data.site.description);
  }

  function emailBlock(p) {
    var ct = el('div', 'contact');
    ct.append(el('div', '', L('Email', 'راسلنا على')));
    var addr = el('div', 'addr', p.email || ''); addr.dataset.raw = 'pilot.email'; ct.append(addr);
    var ul = el('ul'); (p.bullets || []).forEach(function (x, i) { var b = bound('span', '', 'pilot.bullets.' + i, x, L('Point', 'نقطة')); if (b) { var li = el('li'); li.append(b); ul.append(li); } }); ct.append(ul);
    return ct;
  }
  /* sign-up form: posts to the Google Apps Script web app in content.json (pilot.form_url), which appends a row to a Google Sheet */
  function signupForm(p) {
    var f = el('form', 'contact signup');
    function field(name, label, type, req, opts) {
      var w = el('label', 'fld'); w.append(el('span', '', label + (req ? ' *' : '')));
      var i;
      if (opts) { i = el('select'); opts.forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; i.append(op); }); }
      else if (type === 'textarea') { i = el('textarea'); i.rows = 3; }
      else { i = el('input'); i.type = type || 'text'; }
      i.name = name; i.id = 'f-' + name; if (req) i.required = true; w.append(i); f.append(w); return i;
    }
    f.append(el('h3', '', L('Join the pilot', 'سجّل في التجربة')));
    field('name', L('Name', 'الاسم'), 'text', true).autocomplete = 'name';
    field('email', L('Email', 'الإيميل'), 'email', true).autocomplete = 'email';
    field('role', L('Role', 'الدور'), null, true, [['', L('Choose…', 'اختر…')], ['student', L('Student', 'طالب')], ['supervisor', L('Supervisor / PI', 'مشرف')], ['lab_manager', L('Lab manager', 'مسؤول معمل')], ['other', L('Other', 'غير ذلك')]]);
    field('university', L('University / institute', 'الجامعة أو المعهد'), 'text', true).autocomplete = 'organization';
    field('field', L('Research field', 'مجال البحث'), 'text', false);
    field('obsidian', L('Does your group use Obsidian?', 'هل مجموعتك تستخدم Obsidian؟'), null, false, [['', '—'], ['yes', L('Yes', 'نعم')], ['no', L('No', 'لا')], ['some', L('Some of us', 'بعضنا')]]);
    field('note', L('Anything to add', 'شي تحب تضيفه'), 'textarea', false);
    var hp = el('input'); hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.className = 'hp'; hp.setAttribute('aria-hidden', 'true'); f.append(hp);
    var cw = el('label', 'consent'), cb = el('input'); cb.type = 'checkbox'; cb.required = true; cb.name = 'consent';
    cw.append(cb, el('span', '', L('I agree that Oxide keeps these details to contact me about the pilot. I can ask for them to be deleted at any time.', 'أوافق إن Oxide يحفظ هذي البيانات عشان يتواصل معي بخصوص التجربة، وأقدر أطلب حذفها بأي وقت.')));
    f.append(cw);
    var sb = el('button', 'btn', L('Send', 'إرسال')); sb.type = 'submit'; f.append(sb);
    var msg = el('p', 'fmsg'); msg.setAttribute('role', 'status'); f.append(msg);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (EDIT) { msg.textContent = L('The form is off while editing.', 'النموذج موقّف في وضع التعديل.'); return; }
      if (!f.reportValidity() || hp.value) return;
      sb.disabled = true; sb.textContent = L('Sending…', 'يرسل…');
      var fd = new URLSearchParams();
      ['name', 'email', 'role', 'university', 'field', 'obsidian', 'note'].forEach(function (k) { fd.append(k, f.elements[k].value.trim()); });
      fd.append('lang', lang); fd.append('page', location.href);
      fetch(p.form_url, { method: 'POST', mode: 'no-cors', body: fd }).then(function () {
        f.innerHTML = ''; f.append(el('h3', '', L('Thank you! 🎉', 'شكراً لك! 🎉')), el('p', 'fmsg ok', L('You are on the list. We will email you when the pilot starts.', 'انضفت للقائمة، وبنراسلك أول ما تبدأ التجربة.')));
      }).catch(function () {
        sb.disabled = false; sb.textContent = L('Send', 'إرسال');
        msg.className = 'fmsg err'; msg.textContent = L('Could not send. Check your connection and try again' + (p.email ? ', or email ' + p.email : '') + '.', 'ما انرسل. تأكد من النت وجرّب مرة ثانية' + (p.email ? '، أو راسلنا على ' + p.email : '') + '.');
      });
    });
    return f;
  }

  function home() {
    main.innerHTML = '';
    var hero = data.hero || {}, h = el('section', 'hero'), w = el('div');
    var pill = el('span', 'pill'); pill.append(el('i')); add(pill, bound('span', '', 'hero.pill', hero.pill, L('Short tag', 'شارة قصيرة'))); if (pill.children.length > 1) w.append(pill);
    var h1 = el('h1'), title = tx(hero.title);
    if (EDIT) { h1.textContent = title; h1.dataset.p = 'hero.title'; }
    else { var words = title.split(' '); h1.append(document.createTextNode(words.slice(0, -2).join(' ') + (words.length > 2 ? ' ' : '')), el('span', 'accent', words.slice(-2).join(' '))); }
    w.append(h1); add(w, bound('p', 'lead', 'hero.text', hero.text));
    var b = bound('a', 'btn', 'hero.button', hero.button); if (b) { b.href = '#pilot'; w.append(b); }
    var hw = el('div', 'wrap'); hw.append(w);
    var img = el('img', 'mascot'); img.src = 'assets/logo.svg'; img.alt = L('The Oxide panda in a lab coat holding a flask', 'باندا Oxide بالبالطو ماسك قارورة معمل'); hw.append(img);
    h.append(hw); main.append(h);

    if ((data.ribbon || []).some(function (x) { return tx(x); }) || EDIT) {
      var r = el('div', 'ribbon'), rw = el('div', 'wrap'); r.dataset.block = 'ribbon';
      (data.ribbon || []).forEach(function (x, i) { var s = bound('span', 'rib', 'ribbon.' + i, x, L('Phrase', 'عبارة')); if (s) { s.dataset.i = i; rw.append(s); } });
      r.append(rw); main.append(r);
    }

    (data.sections || []).forEach(function (s, si) {
      var base = 'sections.' + si;
      var sec = el('section', s.bg === 'grey' ? 'grey' : ''), sw = el('div', 'wrap');
      if (s.id) sec.id = s.id;
      sec.dataset.si = si;
      var h2 = el('h2'); add(h2, bound('span', '', base + '.title', s.title, L('Section title', 'عنوان القسم')));
      add(h2, bound('span', 'badge', base + '.badge', s.badge, L('Badge', 'شارة')));
      sw.append(h2);
      add(sw, bound('p', 'lead', base + '.lead', s.lead, L('A line under the title (optional)', 'سطر تحت العنوان (اختياري)')));
      var items = s.items || [];
      if (s.layout === 'steps') {
        var ol = el('ol', 'steps');
        items.forEach(function (it, ii) { var li = el('li'); li.dataset.ii = ii; add(li, bound('h3', '', base + '.items.' + ii + '.title', it.title, L('Step', 'خطوة'))); add(li, bound('p', '', base + '.items.' + ii + '.text', it.text, L('Text', 'نص'))); ol.append(li); });
        sw.append(ol);
      } else if (s.layout !== 'text') {
        var g = el('div', 'cards');
        items.forEach(function (it, ii) {
          var ib = base + '.items.' + ii, c = el('div', 'card'); c.dataset.ii = ii;
          if (it.icon || EDIT) { var ic = el('span', 'ic', it.icon || '＋'); ic.dataset.icon = ib + '.icon'; if (!it.icon) ic.classList.add('ph-ic'); c.append(ic); }
          add(c, bound('h3', '', ib + '.title', it.title, L('Title', 'العنوان')));
          add(c, bound('span', 'tag', ib + '.tag', it.tag, L('Tag', 'وسم')));
          add(c, bound('p', '', ib + '.text', it.text, L('Text', 'النص')));
          if (it.note || EDIT) { var n = el('span', 'note', it.note || ''); n.dataset.raw = ib + '.note'; n.dataset.hint = 'note'; c.append(n); }
          g.append(c);
        });
        sw.append(g);
      }
      sec.append(sw); main.append(sec);
    });

    var p = data.pilot || {}, ps = el('section'); ps.id = 'pilot'; ps.dataset.block = 'pilot';
    var pw = el('div', 'wrap'), box = el('div', 'pilot'), left = el('div');
    add(left, bound('h2', '', 'pilot.title', p.title)); add(left, bound('p', '', 'pilot.text', p.text));
    box.append(left, p.form_url ? signupForm(p) : emailBlock(p)); pw.append(box); ps.append(pw); main.append(ps);
    document.title = 'Oxide — ' + tx(hero.title);
  }

  function page() {
    main.innerHTML = '';
    var slug = new URLSearchParams(location.search).get('p');
    var idx = (data.pages || []).findIndex(function (x) { return x.slug === slug; }), pg = data.pages[idx];
    var sec = el('section', 'page'), w = el('div', 'wrap');
    if (!pg) { w.append(el('h1', '', L('Page not found', 'الصفحة غير موجودة'))); var a = el('a', '', L('Back to home', 'رجوع للرئيسية')); a.href = './'; w.append(a); }
    else {
      sec.dataset.page = idx;
      add(w, bound('h1', '', 'pages.' + idx + '.title', pg.title, L('Page title', 'عنوان الصفحة')));
      var body = el('div', 'prose'), md = tx(pg.body);
      if (window.marked && window.DOMPurify) body.innerHTML = DOMPurify.sanitize(marked.parse(md)); else body.textContent = md;
      body.dataset.md = 'pages.' + idx + '.body';
      w.append(body);
      document.title = (tx(pg.title) || slug) + ' — Oxide';
    }
    sec.append(w); main.append(sec);
  }

  function render() { var y = scrollY; chrome(); if (mode === 'page') page(); else home(); if (EDIT && window.OxideEditor) OxideEditor.decorate(); if (EDIT) scrollTo(0, y); }
  document.getElementById('yr').textContent = new Date().getFullYear();
  document.getElementById('lang').onclick = function () { lang = lang === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('oxide-lang', lang); } catch (e) {} if (data) render(); };

  function start(m) {
    mode = m;
    var editor = EDIT ? new Promise(function (res) { var s = document.createElement('script'); s.src = 'assets/editor.js'; s.onload = res; s.onerror = res; document.head.append(s); }) : Promise.resolve();
    var content = fetch('content.json', { cache: 'no-cache' }).then(function (r) { return r.json(); });
    Promise.all([content, editor]).then(function (x) {
      data = x[0];
      if (EDIT && window.OxideEditor) return OxideEditor.init(api).then(render); render();
    }).catch(function () { main.innerHTML = '<div class="wrap loading">ما قدرنا نحمّل محتوى الصفحة. حدّث الصفحة وجرّب مرة ثانية.</div>'; });
  }
  var api = {
    get data() { return data; }, set data(d) { data = d; },
    get lang() { return lang; }, get mode() { return mode; },
    render: render
  };
  window.Oxide = { home: function () { start('home'); }, page: function () { start('page'); } };
})();
