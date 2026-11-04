import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const portrait = await readFile(resolve('public/assets/images/cumpleanera.webp'));
const portraitData = `data:image/webp;base64,${portrait.toString('base64')}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

await page.setContent(`<!doctype html><html><head><style>
  *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:
  radial-gradient(circle at 16% 12%,rgba(255,255,255,.95),transparent 30%),
  radial-gradient(circle at 92% 85%,rgba(202,56,112,.22),transparent 34%),
  linear-gradient(135deg,#f5cbd6,#fff8f3 52%,#f0c0cf);font-family:Georgia,serif;color:#4a1839}
  body:before{content:'';position:absolute;inset:0;opacity:.35;background-image:radial-gradient(#fff 1.5px,transparent 1.5px);background-size:24px 24px}
  .petal{position:absolute;width:62px;height:28px;border-radius:100% 0 100% 0;background:linear-gradient(135deg,#f8a9c0,#bd2868);opacity:.78;filter:drop-shadow(0 8px 9px rgba(91,22,58,.15))}
  .p1{left:54px;top:70px;transform:rotate(-28deg)}.p2{left:470px;top:60px;transform:rotate(34deg) scale(.65)}.p3{left:530px;bottom:54px;transform:rotate(-18deg) scale(.8)}.p4{right:34px;bottom:55px;transform:rotate(35deg)}
  .copy{position:absolute;left:78px;top:98px;width:620px}.eyebrow{font:700 18px Arial,sans-serif;letter-spacing:6px;color:#c18d31;margin:0 0 30px}
  h1{font-size:72px;line-height:.96;font-weight:500;margin:0}h1 em{display:block;font-family:cursive;font-size:100px;line-height:1;color:#981d59;font-weight:400}
  .line{width:190px;height:22px;border-top:6px solid #c9953e;border-radius:50%;transform:rotate(-4deg);margin:17px 0 20px 222px}
  .copy>p:last-child{font-size:25px;font-style:italic;line-height:1.45;max-width:560px;margin:0}
  .portrait{position:absolute;right:70px;top:46px;width:410px;height:520px;padding:11px;border:4px solid #c9953e;border-radius:49% 51% 48% 52%;background:rgba(255,255,255,.72);box-shadow:0 26px 55px rgba(74,24,57,.2)}
  .portrait img{width:100%;height:100%;object-fit:cover;object-position:50% 38%;border-radius:49% 51% 48% 52%}
  .heart{position:absolute;right:32px;top:36px;font-size:64px;color:#c9953e;transform:rotate(10deg)}
  .seal{position:absolute;right:394px;bottom:36px;width:84px;height:84px;display:grid;place-items:center;border-radius:50%;font:40px serif;color:#ffd28e;background:radial-gradient(circle at 35% 28%,#df467f,#8e0e4d 70%);border:5px double #f5bdcf;box-shadow:0 10px 20px rgba(74,24,57,.22)}
</style></head><body>
  <i class="petal p1"></i><i class="petal p2"></i><i class="petal p3"></i><i class="petal p4"></i>
  <section class="copy"><p class="eyebrow">UNA INVITACIÓN PARA TI</p><h1>Hay momentos que merecen <em>celebrarse…</em></h1><div class="line"></div><p>Abre la invitación y descubre todos los detalles de este día tan especial.</p></section>
  <div class="portrait"><img src="${portraitData}" alt=""></div><span class="heart">♡</span><span class="seal">♥</span>
</body></html>`);

await page.screenshot({ path: resolve('public/assets/images/og-invitacion.png'), type: 'png' });
await browser.close();
console.log('Generated public/assets/images/og-invitacion.png (1200x630).');
