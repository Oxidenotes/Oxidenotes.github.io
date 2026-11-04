/**
 * Oxide pilot sign-ups → Google Sheet.
 * 1. Make a Google Sheet, then Extensions → Apps Script, paste this file, Save.
 * 2. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 * 3. Copy the Web app URL (…/exec) into content.json → pilot.form_url.
 */
var FIELDS = ['name', 'email', 'role', 'university', 'field', 'obsidian', 'note', 'lang', 'page'];

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.website) return ContentService.createTextOutput('ok');            // bot trap
  if (!p.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || '')) return ContentService.createTextOutput('invalid');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sh.getLastRow() === 0) sh.appendRow(['time'].concat(FIELDS));
    sh.appendRow([new Date()].concat(FIELDS.map(function (k) { return String(p[k] || '').slice(0, 2000); })));
  } finally { lock.releaseLock(); }
  return ContentService.createTextOutput('ok');
}
