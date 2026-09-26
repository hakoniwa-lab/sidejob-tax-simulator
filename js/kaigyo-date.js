/*
 * 開業の届出期限カレンダー(kaigyo/)で使う日付の部品。DOMには触れない。
 *
 * 日付は「日の通し番号」(ユリウス通日の整数部)で扱う。足し引きがそのまま日数になる。
 * 祝日は2026年以降だけを対象にした計算(このツールは2026年1月1日以後の開業が対象)。
 *   春分の日・秋分の日は 1980〜2099年に使える近似式(国立天文台の暦要項と同じ結果になる範囲)
 *   振替休日・国民の休日は2007年からの現行ルール
 * 検証: houyou-calendar/js/holiday.js(内閣府CSVと全件一致)と2026〜2060年で突き合わせ済み(test/kaigyo-date.test.js)。
 */

const KD_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function ymdOf(idx) {
  const a = idx + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    y: 100 * b + d - 4800 + Math.floor(m / 10),
    m: m + 3 - 12 * Math.floor(m / 10),
    d: e - Math.floor((153 * m + 2) / 5) + 1,
  };
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/* 0=日 … 6=土 */
function weekdayOf(idx) {
  return (idx + 1) % 7;
}

function _nthMonday(y, m, n) {
  const wd1 = weekdayOf(jdn(y, m, 1));
  return 1 + ((8 - wd1) % 7) + (n - 1) * 7;
}

const _kdHolidayCache = new Map();

/* その年の祝日・休日。Map(日番号 → 名前) */
function holidaysOfYear(y) {
  if (_kdHolidayCache.has(y)) return _kdHolidayCache.get(y);
  const map = new Map();
  const add = (m, d, name) => map.set(jdn(y, m, d), name);
  const base = y - 1980;
  const leapShift = Math.floor(base / 4);

  add(1, 1, "元日");
  add(1, _nthMonday(y, 1, 2), "成人の日");
  add(2, 11, "建国記念の日");
  add(2, 23, "天皇誕生日");
  add(3, Math.floor(20.8431 + 0.242194 * base - leapShift), "春分の日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(7, _nthMonday(y, 7, 3), "海の日");
  add(8, 11, "山の日");
  add(9, _nthMonday(y, 9, 3), "敬老の日");
  add(9, Math.floor(23.2488 + 0.242194 * base - leapShift), "秋分の日");
  add(10, _nthMonday(y, 10, 2), "スポーツの日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  const shukujitsu = new Set(map.keys());

  // 振替休日: 祝日が日曜なら、その後でいちばん近い「祝日でない日」
  for (const day of [...shukujitsu].sort((a, b) => a - b)) {
    if (weekdayOf(day) !== 0) continue;
    let t = day + 1;
    while (shukujitsu.has(t)) t++;
    map.set(t, "振替休日");
  }
  // 国民の休日: 祝日と祝日に挟まれた日
  for (const day of shukujitsu) {
    const mid = day + 1;
    if (shukujitsu.has(mid + 1) && !shukujitsu.has(mid) && !map.has(mid)) map.set(mid, "国民の休日");
  }

  const start = jdn(y, 1, 1), end = jdn(y, 12, 31);
  for (const k of [...map.keys()]) if (k < start || k > end) map.delete(k);
  _kdHolidayCache.set(y, map);
  return map;
}

function holidayOfIdx(idx) {
  return holidaysOfYear(ymdOf(idx).y).get(idx) || null;
}

/* 曜日・祝日つきの日付情報 */
function dayInfo(idx) {
  const { y, m, d } = ymdOf(idx);
  const wd = weekdayOf(idx);
  return { idx, y, m, d, wd, wdName: KD_WEEKDAYS[wd], holiday: holidayOfIdx(idx) };
}

/*
 * 税務署の閉庁日。国税通則法10条2項・同施行令2条2項:
 * 日曜・祝日などの休日、土曜、12月29日〜31日。1月2日・3日は「一般の休日」にあたる。
 */
function isClosedDay(idx) {
  const info = dayInfo(idx);
  if (info.wd === 0 || info.wd === 6 || info.holiday) return true;
  if (info.m === 12 && info.d >= 29) return true;
  if (info.m === 1 && info.d <= 3) return true;
  return false;
}

function nextOpenDay(idx) {
  let d = idx;
  for (let i = 0; i < 14 && isClosedDay(d); i++) d++;
  return d;
}

/*
 * 国税通則法10条1項の数え方で「開始日から◯か月以内」の満了日を出す。
 * 初日は算入しない(翌日が起算日)。応当する日の前日に満了し、応当する日がない月はその月の末日。
 * 例: 4月1日開業の「2か月以内」→ 6月1日。
 */
function monthDeadline(startIdx, months) {
  const s = ymdOf(startIdx + 1);
  const t = s.m - 1 + months;
  const ny = s.y + Math.floor(t / 12);
  const nm = (((t % 12) + 12) % 12) + 1;
  const last = daysInMonth(ny, nm);
  if (s.d > last) return jdn(ny, nm, last);
  return jdn(ny, nm, s.d) - 1;
}

const KD_ERA = [
  { name: "令和", start: jdn(2019, 5, 1), y0: 2018 },
];

function warekiOf(y, m, d) {
  const e = KD_ERA[0];
  if (jdn(y, m, d) < e.start) return "";
  const n = y - e.y0;
  return `${e.name}${n === 1 ? "元" : n}年`;
}

function fmtDate(info) {
  return `${info.y}年${info.m}月${info.d}日(${info.wdName})`;
}

function icsDate(idx) {
  const { y, m, d } = ymdOf(idx);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

function icsEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/* 1行75オクテットで折り返す(RFC 5545)。UTF-8の途中で切らない */
function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "", len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

if (typeof module !== "undefined") {
  module.exports = { jdn, ymdOf, daysInMonth, weekdayOf, holidaysOfYear, holidayOfIdx, dayInfo, isClosedDay, nextOpenDay, monthDeadline, warekiOf, fmtDate, icsDate, icsEscape, icsFold };
}
