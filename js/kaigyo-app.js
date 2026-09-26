/*
 * 開業の届出期限カレンダー(kaigyo/)の画面。計算は kaigyo.js、日付の部品は kaigyo-date.js。
 * 入力は端末の localStorage にだけ保存する。
 */

const KG_STORAGE_KEY = "sidejob-tax-simulator:kaigyo";
const KG_SITE_URL = "https://hakoniwalab.com/sidejob-tax-simulator/kaigyo/";

const $k = (id) => document.getElementById(id);

const kgForm = $k("form");
const kgYear = $k("year"), kgMonth = $k("month"), kgDay = $k("day");
const kgPreview = $k("date-preview");
const kgError = $k("form-error");
const kgResult = $k("result");
const kgStatus = $k("action-status");

let kgCurrent = null;

function kgEsc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function kgToday() {
  const t = new Date();
  return jdn(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function kgValidDate(y, m, d) {
  return Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d)
    && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/* ---------- フォーム ---------- */

function kgFillDays(keep) {
  const n = daysInMonth(Number(kgYear.value), Number(kgMonth.value));
  kgDay.innerHTML = "";
  for (let d = 1; d <= n; d++) kgDay.add(new Option(`${d}日`, String(d)));
  kgDay.value = String(Math.min(keep || 1, n));
}

function kgUpdatePreview() {
  const y = Number(kgYear.value), m = Number(kgMonth.value), d = Number(kgDay.value);
  kgPreview.textContent = `${fmtDate(dayInfo(jdn(y, m, d)))}・${warekiOf(y, m, d)}`;
}

function kgInitForm() {
  const t = new Date();
  const maxY = Math.max(t.getFullYear() + 1, KG_START.y);
  for (let y = KG_START.y; y <= maxY; y++) kgYear.add(new Option(`${y}年`, String(y)));
  for (let m = 1; m <= 12; m++) kgMonth.add(new Option(`${m}月`, String(m)));
  const thisY = Math.min(Math.max(t.getFullYear(), KG_START.y), maxY);
  kgYear.value = String(thisY);
  kgMonth.value = String(t.getMonth() + 1);
  kgFillDays(t.getDate());
  kgUpdatePreview();
  kgYear.addEventListener("change", () => { kgFillDays(Number(kgDay.value)); kgUpdatePreview(); });
  kgMonth.addEventListener("change", () => { kgFillDays(Number(kgDay.value)); kgUpdatePreview(); });
  kgDay.addEventListener("change", kgUpdatePreview);
}

function kgReadForm() {
  return {
    y: Number(kgYear.value), m: Number(kgMonth.value), d: Number(kgDay.value),
    kazoku: $k("opt-kazoku").checked,
    koyou: $k("opt-koyou").checked,
    invoice: $k("opt-invoice").checked,
  };
}

function kgLoadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(KG_STORAGE_KEY) || "null");
    return v && kgValidDate(v.y, v.m, v.d) && isKaigyoSupported(v.y, v.m, v.d) ? v : null;
  } catch (e) {
    return null;
  }
}

function kgSave(v) {
  try { localStorage.setItem(KG_STORAGE_KEY, JSON.stringify(v)); } catch (e) { /* 保存できなくても動く */ }
}

/* ---------- 描画 ---------- */

function kgLeftHtml(it, today) {
  if (it.idx === null) return '<span class="kg-badge">期限なし</span>';
  if (it.idx === today) return '<span class="kg-badge kg-badge--now">今日まで</span>';
  if (it.idx < today) return '<span class="kg-badge kg-badge--past">期限を過ぎています</span>';
  return `<span class="kg-left">あと${(it.idx - today).toLocaleString()}日</span>`;
}

function kgRowHtml(it, today) {
  const past = it.idx !== null && it.idx < today;
  const tags = [];
  if (it.optional) tags.push('<span class="kg-badge">出すかは任意</span>');
  if (it.info && it.info.holiday) tags.push(`<span class="kg-badge">${kgEsc(it.info.holiday)}</span>`);
  const notes = [];
  if (it.shifted) {
    const o = dayInfo(it.original);
    notes.push(`本来の期限 ${fmtDate(o)} が税務署の休みにあたるため、次の開庁日にしています(国税通則法10条2項)。`);
  }
  if (it.note) notes.push(it.note);
  return `<div class="kg-row${past ? " is-past" : ""}">
    <div class="kg-row__head">
      <p class="kg-row__name">${kgEsc(it.name)}<span class="kg-row__where">${kgEsc(it.where)}</span></p>
      <p class="kg-row__date">${it.info ? fmtDate(it.info) : "いつでも"}</p>
    </div>
    <div class="kg-row__tags">${tags.join("")}${kgLeftHtml(it, today)}<span class="kg-law">${kgEsc(it.law)}</span></div>
    ${notes.map((n) => `<p class="kg-row__note">${kgEsc(n)}</p>`).join("")}
  </div>`;
}

function kgJudgeHtml(s, today) {
  const j = aoiroJudge(s, today);
  const dl = s.aoiro.deadline;
  const y = s.start.y;
  if (j.status === "late") {
    return `<p class="result-headline__label">開業した${y}年から青色申告にできる？</p>
      <p class="result-headline__value kg-judge kg-judge--late">間に合いませんでした</p>
      <p class="result-headline__sub">青色申告承認申請書の期限は ${fmtDate(dl.info)} でした。${y}年分は白色申告になります。</p>
      <p class="kg-next">${y + 1}年分から青色申告にするなら<br><strong>${fmtDate(s.aoiro.nextYear)}</strong> までに申請</p>`;
  }
  return `<p class="result-headline__label">開業した${y}年から青色申告にできる？</p>
    <p class="result-headline__value kg-judge">${j.status === "today" ? "今日が期限です" : "まだ間に合います"}</p>
    <p class="kg-next">青色申告承認申請書の期限<br><strong>${fmtDate(dl.info)}</strong>${j.status === "ok" ? `<span class="kg-next__left">あと${j.left.toLocaleString()}日</span>` : ""}</p>
    <p class="result-headline__sub">${kgEsc(s.aoiro.rule)}。開業届と一緒に出すのがいちばん確実です。</p>`;
}

function kgRender(v) {
  const s = buildKaigyo(v);
  const today = kgToday();
  kgCurrent = { v, s };

  $k("judge-card").innerHTML = kgJudgeHtml(s, today)
    + `<p class="kg-meta">開業日 ${fmtDate(s.start)}・${warekiOf(s.start.y, s.start.m, s.start.d)}</p>`;

  const html = [];
  for (const [key, g] of Object.entries(KG_GROUPS)) {
    const items = s.items.filter((it) => it.group === key);
    if (!items.length) continue;
    html.push(`<div class="card kg-card">
      <h2 class="card__title">${kgEsc(g.title)}</h2>
      <p class="kg-card__lead">${kgEsc(g.lead)}</p>
      <div class="kg-list">${items.map((it) => kgRowHtml(it, today)).join("")}</div>
    </div>`);
  }
  html.push(`<div class="card kg-card">
    <h2 class="card__title">税務署のほかに</h2>
    <div class="kg-list"><div class="kg-row">
      <p class="kg-row__name">都道府県税事務所への事業開始の申告<span class="kg-row__where">都道府県税事務所・市区町村</span></p>
      <p class="kg-row__note">個人事業税のための届出です。期限は都道府県の条例で決まっていて、地域によって違います(開業から15日以内・1か月以内など)。お住まいの都道府県のホームページで確認してください。</p>
    </div></div>
  </div>`);
  $k("groups").innerHTML = html.join("");

  kgResult.hidden = false;
  kgStatus.textContent = "";
}

/* ---------- カレンダー登録・共有 ---------- */

function kgUpcoming(s, today) {
  return s.items.filter((it) => it.idx !== null && it.idx >= today);
}

function kgBuildIcs(s) {
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}T${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}${p2(now.getUTCSeconds())}Z`;
  const startKey = icsDate(s.start.idx);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HAKONIWA LAB//kaigyo-kigen//JA",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape("開業の届出の期限")}`,
  ];
  for (const it of kgUpcoming(s, kgToday())) {
    const title = `${it.name}の期限`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:kaigyo-${startKey}-${it.key}@hakoniwalab.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(it.idx)}`,
      `DTEND;VALUE=DATE:${icsDate(it.idx + 1)}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape([it.where, it.law, KG_SITE_URL].join("\n"))}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(title)}`, "TRIGGER:-P7D", "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

function kgShareText(s) {
  const lines = [`【開業の届出の期限】開業日 ${fmtDate(s.start)}`];
  const up = kgUpcoming(s, kgToday());
  if (!up.length) lines.push("一覧にある期限はすべて過ぎています");
  for (const it of up) lines.push(`・${it.name} ${fmtDate(it.info)}`);
  lines.push("", `開業の届出期限カレンダー ${KG_SITE_URL}`);
  return lines.join("\n");
}

/* ---------- イベント ---------- */

kgForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = kgReadForm();
  if (!kgValidDate(v.y, v.m, v.d)) {
    kgError.textContent = "日付を選び直してください。";
    kgError.hidden = false;
    return;
  }
  if (!isKaigyoSupported(v.y, v.m, v.d)) {
    kgError.textContent = "2025年12月31日までの開業は、開業届の期限が「開業から1か月以内」の旧ルールです。このツールは2026年1月1日以後の開業が対象です。";
    kgError.hidden = false;
    return;
  }
  kgError.hidden = true;
  kgSave(v);
  kgRender(v);
  kgResult.scrollIntoView({ behavior: "smooth", block: "start" });
});

$k("btn-ics").addEventListener("click", () => {
  if (!kgCurrent) return;
  const n = kgUpcoming(kgCurrent.s, kgToday()).length;
  if (!n) { kgStatus.textContent = "これから先の期限がないため、登録するものがありません"; return; }
  const blob = new Blob([kgBuildIcs(kgCurrent.s)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kaigyo-kigen.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  kgStatus.textContent = `${n}件の期限をカレンダー用ファイル(.ics)にしました`;
});

$k("btn-copy").addEventListener("click", async () => {
  if (!kgCurrent) return;
  try {
    await navigator.clipboard.writeText(kgShareText(kgCurrent.s));
    kgStatus.textContent = "期限の一覧をコピーしました。メモアプリなどに貼り付けられます";
  } catch (err) {
    kgStatus.textContent = "コピーできませんでした";
  }
});

$k("btn-print").addEventListener("click", () => window.print());

$k("btn-edit").addEventListener("click", () => {
  $k("form-card").scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ---------- 起動 ---------- */

kgInitForm();
const kgSaved = kgLoadSaved();
if (kgSaved) {
  kgYear.value = String(kgSaved.y);
  kgMonth.value = String(kgSaved.m);
  kgFillDays(kgSaved.d);
  $k("opt-kazoku").checked = !!kgSaved.kazoku;
  $k("opt-koyou").checked = !!kgSaved.koyou;
  $k("opt-invoice").checked = !!kgSaved.invoice;
  kgUpdatePreview();
  kgRender(kgSaved);
}
