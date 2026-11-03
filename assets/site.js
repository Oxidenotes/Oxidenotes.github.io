/* Oxide site: everything is drawn from content.json, which the admin (admin/) edits.
   index.html calls Oxide.home(), page.html calls Oxide.page(). */
(function () {
  var data = null, lang = 'en', mode = 'home';
  try { lang = localStorage.getItem('oxide-lang') || (/^ar/.test(navigator.language) ? 'ar' : 'en'); } catch (e) {}
  function tx(o) { return o ? (o[lang] || o.en || '') : ''; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var main = document.getElementById('top');

  function chrome() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    var links = document.getElementById('links'); links.innerHTML = '';
    var here = new URLSearchParams(location.search).get('p');
    if (mode === 'page') { var h = el('a', '', lang === 'ar' ? 'الرئيسية' : 'Home'); h.href = './'; links.append(h); }
    (data.pages || []).filter(function (p) { return p.nav !== false && p.slug; }).forEach(function (p) {
      var a = el('a', p.slug === here ? 'on' : '', tx(p.title)); a.href = 'page.html?p=' + encodeURIComponent(p.slug); links.append(a);
    });
    document.getElementById('lang').textContent = lang === 'ar' ? 'English' : 'عربي';
    var cta = document.getElementById('navcta'); cta.textContent = tx(data.hero && data.hero.button); cta.href = mode === 'home' ? '#pilot' : './#pilot';
    document.getElementById('foot').textContent = tx(data.footer);
    var d = document.querySelector('meta[name=description]'); if (d && data.site) d.content = tx(data.site.description);
  }

  function home() {
    main.innerHTML = '';
    var hero = data.hero || {}, h = el('section', 'hero'), w = el('div', 'wrap');
    if (tx(hero.pill)) { var pill = el('span', 'pill'); pill.append(el('i'), el('span', '', tx(hero.pill))); w.append(pill); }
    var h1 = el('h1'), words = tx(hero.title).split(' ');
    h1.append(document.createTextNode(words.slice(0, -2).join(' ') + (words.length > 2 ? ' ' : '')), el('span', 'accent', words.slice(-2).join(' ')));
    w.append(h1, el('p', 'lead', tx(hero.text)));
    if (tx(hero.button)) { var b = el('a', 'btn', tx(hero.button)); b.href = '#pilot'; w.append(b); }
    h.append(w); main.append(h);

    if (data.ribbon && data.ribbon.length) { var r = el('div', 'ribbon'), rw = el('div', 'wrap'); data.ribbon.forEach(function (x) { if (tx(x)) rw.append(el('span', '', tx(x))); }); r.append(rw); main.append(r); }

    (data.sections || []).forEach(function (s) {
      var sec = el('section', s.bg === 'grey' ? 'grey' : ''), sw = el('div', 'wrap');
      if (s.id) sec.id = s.id;
      var h2 = el('h2', '', tx(s.title)); if (tx(s.badge)) h2.append(el('span', 'badge', tx(s.badge)));
      sw.append(h2);
      if (tx(s.lead)) sw.append(el('p', 'lead', tx(s.lead)));
      var items = s.items || [];
      if (s.layout === 'steps' && items.length) {
        var ol = el('ol', 'steps');
        items.forEach(function (it) { var li = el('li'); li.append(el('h3', '', tx(it.title)), el('p', '', tx(it.text))); ol.append(li); });
        sw.append(ol);
      } else if (s.layout !== 'text' && items.length) {
        var g = el('div', 'cards');
        items.forEach(function (it) {
          var c = el('div', 'card');
          if (it.icon) c.append(el('span', 'ic', it.icon));
          c.append(el('h3', '', tx(it.title)));
          if (tx(it.tag)) c.append(el('span', 'tag', tx(it.tag)));
          c.append(el('p', '', tx(it.text)));
          if (it.note) c.append(el('span', 'note', it.note));
          g.append(c);
        });
        sw.append(g);
      }
      sec.append(sw); main.append(sec);
    });

    var p = data.pilot || {}, ps = el('section'); ps.id = 'pilot';
    var pw = el('div', 'wrap'), box = el('div', 'pilot'), left = el('div');
    left.append(el('h2', '', tx(p.title)), el('p', '', tx(p.text)));
    var ct = el('div', 'contact');
    ct.append(el('div', '', lang === 'ar' ? 'راسلنا على' : 'Email'));
    var addr = el('div', 'addr', p.email || ''); ct.append(addr);
    var ul = el('ul'); (p.bullets || []).forEach(function (x) { if (tx(x)) ul.append(el('li', '', tx(x))); }); ct.append(ul);
    var cp = el('button', 'btn', lang === 'ar' ? 'انسخ العنوان' : 'Copy address'); cp.type = 'button';
    cp.onclick = function () {
      var done = function () { cp.textContent = lang === 'ar' ? 'انتسخ ✓' : 'Copied ✓'; setTimeout(function () { cp.textContent = lang === 'ar' ? 'انسخ العنوان' : 'Copy address'; }, 1600); };
      var sel = function () { var rg = document.createRange(); rg.selectNodeContents(addr); var s = getSelection(); s.removeAllRanges(); s.addRange(rg); };
      if (navigator.clipboard) navigator.clipboard.writeText(addr.textContent).then(done, sel); else sel();
    };
    ct.append(cp); box.append(left, ct); pw.append(box); ps.append(pw); main.append(ps);
    document.title = (data.site && data.site.name ? data.site.name.charAt(0) + data.site.name.slice(1).toLowerCase() : 'Oxide') + ' — ' + tx(hero.title);
  }

  function page() {
    main.innerHTML = '';
    var slug = new URLSearchParams(location.search).get('p');
    var pg = (data.pages || []).find(function (x) { return x.slug === slug; });
    var sec = el('section', 'page'), w = el('div', 'wrap');
    if (!pg) { w.append(el('h1', '', lang === 'ar' ? 'الصفحة غير موجودة' : 'Page not found')); var a = el('a', '', lang === 'ar' ? 'رجوع للرئيسية' : 'Back to home'); a.href = './'; w.append(a); }
    else {
      w.append(el('h1', '', tx(pg.title)));
      var body = el('div', 'prose'), md = tx(pg.body);
      body.innerHTML = window.DOMPurify ? DOMPurify.sanitize(marked.parse(md)) : '';
      if (!window.marked) body.textContent = md;
      w.append(body);
      document.title = tx(pg.title) + ' — Oxide';
    }
    sec.append(w); main.append(sec);
  }

  function render() { chrome(); if (mode === 'page') page(); else home(); }
  document.getElementById('yr').textContent = new Date().getFullYear();
  document.getElementById('lang').onclick = function () { lang = lang === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('oxide-lang', lang); } catch (e) {} if (data) render(); };
  function load(m) {
    mode = m;
    fetch('content.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { data = d; render(); })
      .catch(function () { main.innerHTML = '<div class="wrap loading">Could not load the page content. Please refresh.</div>'; });
  }
  window.Oxide = { home: function () { load('home'); }, page: function () { load('page'); } };
})();
