/* kaigyo-date.js の祝日を houyou-calendar/js/holiday.js(内閣府CSVと全件一致)と突き合わせる */
const fs = require("fs"), vm = require("vm"), path = require("path");
const kd = require("../js/kaigyo-date.js");
const H = path.join(__dirname, "../../houyou-calendar/js");
const ctx = {}; vm.createContext(ctx);
for (const f of ["astro.js", "koyomi.js", "holiday.js"]) vm.runInContext(fs.readFileSync(path.join(H, f), "utf8"), ctx);
let bad = 0, n = 0;
for (let y = 2026; y <= 2060; y++) {
  const a = kd.holidaysOfYear(y);
  const b = vm.runInContext(`[...holidaysOfYear(${y}).entries()]`, ctx);
  const bm = new Map(b);
  for (const [k, v] of bm) { n++; if (a.get(k) !== v) { bad++; console.log("差", y, kd.ymdOf(k), v, a.get(k)); } }
  for (const [k, v] of a) if (!bm.has(k)) { bad++; console.log("余分", y, kd.ymdOf(k), v); }
}
console.log(bad ? `NG ${bad}件` : `ALL MATCH ${n}件(2026〜2060)`);
process.exit(bad ? 1 : 0);
