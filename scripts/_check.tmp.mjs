import fs from 'node:fs';

const PORT = 9666;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let seq = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result && result.result.value;
};
const shot = async (name) => {
  const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(name, Buffer.from(data.data, 'base64'));
  console.log('saved', name);
};
const viewport = (width, height, mobile = false) =>
  send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
const load = async (url, wait = 1700) => {
  await send('Page.navigate', { url });
  await sleep(wait);
};

await send('Page.enable');
await send('Network.enable');
await send('Network.clearBrowserCookies');

await viewport(1440, 1000);
await load('http://127.0.0.1:3000/');
await shot('review-home.png');

await evaluate(`document.querySelector('#cara-kerja').scrollIntoView({ block: 'start' }); true`);
await sleep(700);
await evaluate(`document.querySelector('[data-how-tile="2"]').click(); true`);
await sleep(1300);
console.log('how', JSON.stringify(await evaluate(`({ active: [...document.querySelectorAll('[data-how-tile]')].findIndex((t) => t.classList.contains('is-active')), label: document.querySelector('[data-how-step]:not([hidden]) .how-step-label')?.textContent })`)));
await shot('review-how.png');
await evaluate(`document.querySelector('[data-how-tile="2"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); true`);
await sleep(800);
console.log('closed', await evaluate(`!document.querySelector('[data-how]').classList.contains('is-open')`));

await evaluate(`window.scrollTo(0, document.body.scrollHeight); true`);
await sleep(1600);
await shot('review-footer.png');

await load('http://127.0.0.1:3000/login');
await shot('review-login.png');

await load('http://127.0.0.1:3000/register?role=technician');
await shot('review-register.png');

await viewport(390, 844, true);
await load('http://127.0.0.1:3000/');
console.log('mobile home', JSON.stringify(await evaluate(`({ w: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth })`)));
await load('http://127.0.0.1:3000/register?role=technician');
console.log('mobile register', JSON.stringify(await evaluate(`({ w: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth })`)));
await shot('review-mobile-register.png');

ws.close();
