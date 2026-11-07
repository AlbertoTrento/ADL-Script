// Isolated plugin HTML tests. No Orca runtime, network or printer access.
const assert = require('node:assert/strict');
const vm = require('node:vm');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', value => input += value);
process.stdin.on('end', () => {
  const {old, new: translated} = JSON.parse(input);
  const scripts = page => [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  const dictionary = page => {
    const script = scripts(page)[0];
    const start = script.indexOf('var TESTI = ') + 'var TESTI = '.length;
    const end = script.indexOf('\n  };', start) + '\n  }'.length;
    return JSON.parse(JSON.stringify(vm.runInNewContext('(' + script.slice(start, end) + ')')));
  };
  const placeholders = value => [...String(value).matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const name of ['PAGINA', 'PAGINA_GUIDA', 'PAGINA_STAMPANTE']) {
    const before = dictionary(old[name]), after = dictionary(translated[name]);
    for (const language of Object.keys(before)) assert.deepEqual(after[language], before[language], `${name}: existing ${language}`);
    for (const [key, value] of Object.entries(before.en)) {
      assert.ok(Object.hasOwn(after.ru, key), `${name}: missing ru ${key}`);
      assert.equal(typeof after.ru[key], typeof value, `${name}: value type ${key}`);
      assert.deepEqual(placeholders(after.ru[key]), placeholders(value), `${name}: placeholders ${key}`);
      if (Array.isArray(value)) assert.equal(after.ru[key].length, value.length, `${name}: array size ${key}`);
      else assert.ok(after.ru[key].length, `${name}: empty ru ${key}`);
    }
    for (const script of scripts(translated[name])) new vm.Script(script.replaceAll('{{LINGUA}}', 'ru'));
  }
  assert.ok(translated.PAGINA_GUIDA.includes('<option value="ru">Русский</option>'));

  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  function runPage(page) {
    const elements = {}, posts = [];
    const makeElement = () => ({style: {}, value: '', scrollHeight: 600, disabled: false,
      addEventListener() {}, setAttribute(name, value) { this[name] = value; },
      classList: {add() {}, remove() {}},
      set textContent(value) { this._text = String(value); this._html = escape(value); },
      get textContent() { return this._text || ''; },
      set innerHTML(value) { this._html = value; }, get innerHTML() { return this._html || ''; }});
    const context = {document: {getElementById: id => elements[id] ||= makeElement(), createElement: makeElement},
      window: {innerHeight: 900, addEventListener() {}}, setTimeout() {}, setInterval() {},
      orca: {onMessage(fn) { context.receive = fn; }, postMessage(message) { posts.push(message); }}};
    vm.createContext(context);
    for (const script of scripts(page)) vm.runInContext(script.replaceAll('{{LINGUA}}', 'ru'), context);
    return {elements, posts, receive: message => context.receive(message)};
  }
  const dock = runPage(translated.PAGINA);
  dock.receive({comando: 'stato', lingua: 'ru', connessa: false, errore: 'senza_stampante'});
  assert.match(dock.elements.unita.innerHTML, /Принтер не выбран/);
  assert.equal(dock.elements.ricarica['aria-label'], 'Синхронизировать');
  const colours = ['#F2EFCE', '#54B351', '#EA2A2B', '#FFFFFF'];
  dock.receive({comando: 'stato', lingua: 'ru', connessa: true, errore: '', unita: [{numero: 1,
    slot: ['1A', '1B', '1C', '1D'].map((nome, i) => ({nome, colore: colours[i], filamento: i + 1, materiale: 'PLA', vuoto: false, residuo: 100}))}]});
  for (const colour of colours) assert.ok(dock.elements.unita.innerHTML.includes(colour));
  for (const slot of ['1A', '1B', '1C', '1D']) assert.ok(dock.elements.unita.innerHTML.includes(slot));
  const settings = runPage(translated.PAGINA_GUIDA);
  assert.equal(settings.elements.t_titolo.textContent, 'Настройки');
  assert.equal(settings.elements.salva.textContent, 'Сохранить');
  settings.receive({nome: 'CFS', lingua: 'ru', intervallo: 15, stampa: {adl: true, caricati: [], mancano: [], errore: 'nessuna risposta da ADL Script'}});
  assert.match(settings.elements.stato_stampa.textContent, /Нет ответа от ADL Script/);
  const materials = runPage(translated.PAGINA_STAMPANTE);
  materials.receive({adl: true, filamenti: [{marca: 'Custom', nome: 'My PLA', profilo: 'User Profile', tipo: 'PLA', ugello: 220, minimo: 190,
    massimo: 240, colore: '54B351', stato: 'errore', errore: 'nessuna risposta da ADL Script'}]});
  assert.match(materials.elements.elenco.innerHTML, /Нет ответа от ADL Script/);
  assert.match(materials.elements.elenco.innerHTML, /User Profile/);
  assert.match(materials.elements.elenco.innerHTML, /Custom My PLA/);
  assert.match(materials.elements.metodo.innerHTML, /Добавить сейчас/);
  assert.match(materials.elements.metodo.innerHTML, /CFS|ADL Script/);
  for (const ui of [dock, settings, materials]) assert.ok(ui.posts.every(message => ['pronto', 'stato'].includes(message.comando)));
  console.log('offline UI checks passed: RU coverage, existing languages, placeholders, scripts and isolated status rendering');
});
