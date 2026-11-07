// Run with: node --test tests/cfs-language.test.cjs
// The panel runs in a minimal DOM with mocked Moonraker; no printer is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.attributes = {};
    this.events = {};
    this.style = { setProperty() {} };
    this.offsetWidth = 420;
    this.offsetHeight = 280;
    this._text = '';
    this.value = '';
    this.classList = {
      add: name => { if (!this.className.split(/\s+/).includes(name)) this.className += ' ' + name; },
      remove: name => { this.className = this.className.split(/\s+/).filter(n => n !== name).join(' '); },
      toggle: (name, on) => { this.classList[on ? 'add' : 'remove'](name); }
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  insertBefore(child, sibling) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = this.children.indexOf(sibling);
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.events[name] = callback; }
  click() { assert.ok(!this.disabled, 'button is disabled'); this.events.click?.({ target: this }); }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
  querySelector(selector) {
    if (selector === '.v-icon') return this.all().find(n => n.className.split(/\s+/).includes('v-icon')) || null;
    return null;
  }
}

const panelSource = fs.readFileSync(path.join(__dirname, '../files/fluidd-cfs-panel/power-cfs-panel.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

async function panel({ lang = 'en', browserLang = 'en-US', saved, rawSaved, storageBlocked = false } = {}) {
  const head = new Element('head'), body = new Element('body'), column = new Element('div'), list = new Element('div');
  body.appendChild(column); column.appendChild(list);
  const requests = [];
  let stored = rawSaved === undefined ? (saved ? JSON.stringify(saved) : null) : rawSaved;
  const document = {
    head, body, documentElement: { lang }, readyState: 'complete', hidden: false,
    createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    getElementById: id => [...head.all(), ...body.all()].find(n => n.id === id) || null,
    querySelectorAll: selector => selector === 'main .app-draggable.list-group' ? [list] : []
  };
  const box = { state: 'connect', t_command: 'T1A', T1: {
    state: 'connect', version: '1.1.3', temperature: '30', dry_and_humidity: '41',
    vender: ['RFID', 'RFID', 'RFID', 'none'], material_type: ['00001', '00001', '00001', '-1'],
    color_value: ['0F2EFCE', '054B351', '0EA2A2B', '-1'], remain_len: ['7', '71', '70', '-1']
  } };
  const fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    let result;
    if (url.startsWith('/server/files/config/')) result = { materials: [] };
    else if (url === '/printer/objects/list') result = { result: { objects: ['gcode_macro CFS_ADD_MATERIAL', 'gcode_macro BOX_INFO_REFRESH', 'gcode_macro CFS_DIAG_LOG_ON'] } };
    else if (url === '/printer/objects/query?box&print_stats') result = { result: { status: { box, print_stats: { state: 'standby' } } } };
    else if (url.startsWith('/server/files/logs/cfs_diag.status')) result = { running: true, logging: true, autorecover: false, events: 2, box: 'connect' };
    else if (url === '/server/files/list?root=logs') result = { result: [{ path: 'cfs_diag.log', size: 4096 }, { path: 'cfs_diag.log.1', size: 2048 }] };
    else if (url === '/printer/gcode/script') result = { result: 'ok' };
    else throw new Error('Unexpected request: ' + url);
    return { ok: true, status: 200, json: async () => result };
  };
  const window = {
    navigator: { language: browserLang }, location: { pathname: '/', hash: '' }, innerWidth: 1200, innerHeight: 900,
    localStorage: {
      getItem: () => { if (storageBlocked) throw new Error('blocked'); return stored; },
      setItem: (_, value) => { if (storageBlocked) throw new Error('blocked'); stored = value; }
    },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {}, addEventListener() {}
  };
  vm.runInNewContext(panelSource, { window, document, fetch, console });
  await settle();
  return {
    body, requests, stored: () => stored && JSON.parse(stored),
    card: () => document.getElementById('power-cfs-card'),
    find: predicate => body.all().find(predicate),
    button: text => body.all().find(n => n.tagName === 'button' && n.textContent === text)
  };
}

test('language follows the page, with English and unknown-locale fallbacks', async () => {
  const en = await panel();
  assert.match(en.card().textContent, /Channel 1A/);
  assert.match(en.card().textContent, /Empty/);
  const ru = await panel({ lang: 'ru-RU' });
  assert.match(ru.card().textContent, /Канал 1A/);
  assert.match(ru.card().textContent, /Пусто/);
  assert.match(ru.card().textContent, /7 м/);
  const browser = await panel({ lang: '', browserLang: 'ru' });
  assert.match(browser.card().textContent, /Канал 1A/);
  const unknown = await panel({ lang: 'fr' });
  assert.match(unknown.card().textContent, /Channel 1A/);
});

test('language toggle persists independently of layout and sends no G-code', async () => {
  const ui = await panel({ saved: { mode: 'floating', x: 80, y: 90, collapsed: true } });
  ui.button('RU').click();
  assert.match(ui.card().textContent, /Канал 1A/);
  assert.deepEqual(ui.stored(), { mode: 'floating', x: 80, y: 90, collapsed: true, language: 'ru' });
  assert.equal(ui.requests.filter(r => r.method === 'POST').length, 0);
  ui.button('EN').click();
  assert.match(ui.card().textContent, /Channel 1A/);
  const overridden = await panel({ lang: 'ru', saved: { language: 'en' } });
  assert.match(overridden.card().textContent, /Channel 1A/);
});

test('blocked or malformed local storage keeps the panel usable', async () => {
  const ui = await panel({ lang: 'ru', storageBlocked: true });
  assert.match(ui.card().textContent, /Канал 1A/);
  ui.button('EN').click();
  assert.match(ui.card().textContent, /Channel 1A/);
  const unknown = await panel({ saved: { language: '../../ru' } });
  assert.match(unknown.card().textContent, /Channel 1A/);
  const malformed = await panel({ rawSaved: '{broken' });
  assert.match(malformed.card().textContent, /Channel 1A/);
});

test('Russian creator and diagnostics translate UI while preserving database constraints', async () => {
  const ui = await panel({ lang: 'ru' });
  ui.find(n => n.className.split(/\s+/).includes('pcfs-tile')).click();
  ui.button('Новый филамент').click();
  assert.match(ui.body.textContent, /Производитель/);
  assert.match(ui.body.textContent, /На основе/);
  const inputs = ui.body.all().filter(n => n.tagName === 'input' && n.type === 'text');
  inputs[0].value = 'Производитель';
  inputs[1].value = 'PLA';
  ui.button('Добавить').click();
  assert.match(ui.body.textContent, /латинские буквы/);
  assert.equal(ui.requests.filter(r => r.method === 'POST').length, 0);
  ui.button('Назад').click();
  ui.button('Отмена').click();
  ui.button('ДИАГНОСТИКА CFS').click();
  await settle();
  assert.match(ui.body.textContent, /Автовосстановление USB/);
  assert.match(ui.body.textContent, /Записано отключений: 2/);
  assert.ok(ui.button('Удалить журнал'));
  assert.ok(ui.find(n => n.tagName === 'a' && n.textContent === 'Предыдущий журнал'));
  assert.equal(ui.requests.filter(r => r.method === 'POST').length, 0);
});

test('saving a spool emits identical firmware commands in English and Russian', async () => {
  const sent = [];
  for (const lang of ['en', 'ru']) {
    const ui = await panel({ lang });
    ui.find(n => n.className.split(/\s+/).includes('pcfs-tile')).click();
    assert.ok(ui.button(lang === 'ru' ? 'Новый филамент' : 'New filament'));
    ui.button(lang === 'ru' ? 'Сохранить' : 'Save').click();
    await settle();
    sent.push(ui.requests.filter(r => r.method === 'POST').map(r => JSON.parse(r.body).script));
  }
  assert.deepEqual(sent[0], ['BOX_MODIFY_TN_DATA ADDR=1 NUM=A PART=material_type DATA=00001',
    'BOX_MODIFY_TN_DATA ADDR=1 NUM=A PART=color_value DATA=0F2EFCE']);
  assert.deepEqual(sent[1], sent[0]);
});
