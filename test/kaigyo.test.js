/* 期限の答え合わせ。答えは国税庁の案内・条文から手で出したもの */
const vm = require("vm"), fs = require("fs"), path = require("path");
const ctx = { console }; vm.createContext(ctx);
for (const f of ["kaigyo-date.js", "kaigyo.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", f), "utf8"), ctx);
const run = (code) => vm.runInContext(code, ctx);
let bad = 0;
function check(label, input, key, want) {
  const s = run(`buildKaigyo(${JSON.stringify(input)})`);
  const it = s.items.find((x) => x.key === key);
  const got = it && it.info ? `${it.info.y}-${it.info.m}-${it.info.d}` : "なし";
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "OK" : "NG"} ${label}: ${got}${ok ? "" : " (期待 " + want + ")"}`);
}
const K = (y, m, d, o = {}) => ({ y, m, d, kazoku: true, koyou: false, invoice: true, ...o });
// 青色申告(144条 + 通則法10条)
check("4/1開業→2か月は6/1(通則法10条の例)", K(2026, 4, 1), "aoiro", "2026-6-1");
check("7/20開業→9/20(日)→敬老・国民の休日・秋分→9/24(既存記事の実例)", K(2026, 7, 20), "aoiro", "2026-9-24");
check("1/10開業→その年3/15(日)→3/16", K(2026, 1, 10), "aoiro", "2026-3-16");
check("1/15開業→3/15の枠", K(2026, 1, 15), "aoiro", "2026-3-16");
check("1/16開業→2か月=3/16(月)", K(2026, 1, 16), "aoiro", "2026-3-16");
check("12/31開業→2/28(翌年、応当日なし→末日→日曜なので3/1)", K(2026, 12, 31), "aoiro", "2027-3-1");
check("11/1開業→1/1→1/4(年始)", K(2026, 11, 1), "aoiro", "2027-1-4");
check("専従者も同じ期限", K(2026, 7, 20), "senju", "2026-9-24");
// 開業届・確定申告(229条・120条): 翌年3/15。2027-03-15は月曜
check("開業届 2026年開業→2027/3/15(月)", K(2026, 5, 10), "kaigyo", "2027-3-15");
check("開業届 2027年開業→2028/3/15(水)", K(2027, 5, 10), "kaigyo", "2028-3-15");
check("確定申告 2025年分相当の例: 2031/3/15(土)→3/17(月)", K(2030, 6, 1), "shinkoku", "2031-3-17");
// 給与支払事務所(230条): 1か月
check("1/31開業→1か月=2/28(日)→3/1", K(2027, 1, 31, { koyou: true }), "kyuyo", "2027-3-1");
check("5/10開業→6/10(水)", K(2026, 5, 10, { koyou: true }), "kyuyo", "2026-6-10");
// インボイス: 課税期間中=12/31、延びない
check("インボイス 12/31(木)のまま", K(2026, 5, 10), "invoice", "2026-12-31");
check("インボイス 2028/12/31(日)でも延びない", K(2028, 5, 10), "invoice", "2028-12-31");
// みなし承認(147条)
const deemed = (y, m, d) => { const s = run(`buildKaigyo(${JSON.stringify(K(y, m, d))})`).aoiro.deemed; return `${s.y}-${s.m}-${s.d}`; };
for (const [lab, a, want] of [["10/31開業→12/31", [2026, 10, 31], "2026-12-31"], ["11/1開業→翌2/15", [2026, 11, 1], "2027-2-15"]]) {
  const got = deemed(...a); const ok = got === want; if (!ok) bad++;
  console.log(`${ok ? "OK" : "NG"} みなし承認 ${lab}: ${got}`);
}
// 項目の出し分け
const keys = (o) => run(`buildKaigyo(${JSON.stringify(K(2026, 5, 10, o))}).items.map(x=>x.key).join(",")`);
console.log("家族×・雇用×・インボイス×:", keys({ kazoku: false, invoice: false }));
console.log("全部あり:", keys({ koyou: true }));
console.log(bad ? `NG ${bad}件` : "ALL OK");
process.exit(bad ? 1 : 0);
