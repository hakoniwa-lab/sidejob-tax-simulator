/*
 * 個人で開業したときに税務署へ出す書類の期限を、開業日から計算する。DOMには触れない。
 * 日付の部品は kaigyo-date.js。
 *
 * 条文と国税庁の案内で確認したもの(2026-09-26 時点。e-Gov の令和8年8月12日施行版と、
 * 2028年1月1日施行分までの改正後の条文で文言が変わらないことも確認):
 *   所得税法229条  開業届は「事実があつた日の属する年分の所得税に係る確定申告期限まで」
 *                  (令和7年法律第13号で改正、2026年1月1日施行。それまでは「一月以内」)
 *   所得税法120条  確定申告は翌年2月16日〜3月15日
 *   所得税法144条  青色申告承認申請はその年3月15日まで。1月16日以後に業務を開始したら開始日から2月以内
 *   所得税法147条  12月31日(11月1日以後に開始したら翌年2月15日)までに却下がなければ承認とみなす
 *   所得税法57条2項・同施行規則36条の4  青色事業専従者給与の届出は144条と同じ期限
 *   所得税法230条  給与支払事務所等の開設届は開設の日から1月以内
 *   所得税法216・217条  源泉所得税の納期の特例は随時(原則、提出した日の翌月に支払う給与から)
 *   所得税法施行令100条・123条  棚卸資産の評価方法・減価償却資産の償却方法は開業した年分の確定申告期限まで
 *   消費税法施行令70条の4ほか  免税事業者が開業した課税期間の初日から登録を受けるなら、その課税期間中に申請
 *   消費税法37条ほか  簡易課税の選択は、開業した課税期間から適用するならその課税期間中
 *   国税通則法10条1項  初日不算入・応当日の前日に満了(4月1日開業の「2か月以内」は6月1日)
 *   国税通則法10条2項・同施行令2条2項  期限が土日祝・12月29日〜31日なら翌日(翌開庁日)
 *     「課税期間中」は期限ではなく期間なので延びない(インボイス登録・簡易課税の12月31日)
 */

const KG_START = { y: 2026, m: 1, d: 1 };   // 開業届の期限が「確定申告期限まで」になった日

const KG_GROUPS = {
  must: { title: "全員が出すもの", lead: "開業した人は必ず出します。" },
  aoiro: { title: "青色申告にするなら", lead: "最大65万円の青色申告特別控除を受けるための申請です。期限を過ぎると、その年は白色申告になります。" },
  kazoku: { title: "家族に給与を払うなら", lead: "同じ生計の家族に払う給与を経費にするための届出です。" },
  koyou: { title: "人を雇うなら", lead: "給与を払い始めるときに出します。家族に給与を払う場合も同じです。" },
  invoice: { title: "インボイスに登録するなら", lead: "取引先からインボイス(適格請求書)を求められる人向け。登録すると消費税の申告が必要になります。" },
};

/* 期限が閉庁日なら翌開庁日にずらす */
function kgShift(idx) {
  const n = nextOpenDay(idx);
  return { idx: n, shifted: n !== idx, original: idx };
}

/* その年の3月15日(ずらす前) */
function kgMarch15(y) {
  return jdn(y, 3, 15);
}

/*
 * 青色申告承認申請書の期限(所得税法144条)。
 * 1月1日〜15日の開業はその年の3月15日、1月16日以後は開業日から2か月以内。
 */
function aoiroDeadline(startIdx) {
  const { y } = ymdOf(startIdx);
  if (startIdx < jdn(y, 1, 16)) return { base: kgMarch15(y), rule: "3月15日まで(1月15日までの開業)" };
  return { base: monthDeadline(startIdx, 2), rule: "開業日から2か月以内" };
}

/* 承認があったとみなされる日(所得税法147条) */
function aoiroDeemedDate(startIdx) {
  const { y } = ymdOf(startIdx);
  return startIdx >= jdn(y, 11, 1) ? jdn(y + 1, 2, 15) : jdn(y, 12, 31);
}

/*
 * input: { y, m, d, kazoku, koyou, invoice }
 * 戻り値: { start, items[], aoiro }。items は期限の早い順
 *   item: { key, group, name, where, law, note, idx(期限・日の通し番号), shifted, noShift, optional, info }
 */
function buildKaigyo(input) {
  const startIdx = jdn(input.y, input.m, input.d);
  const { y } = ymdOf(startIdx);
  const items = [];
  const push = (def, idx, shiftable) => {
    const r = shiftable ? kgShift(idx) : { idx, shifted: false, original: idx };
    items.push({ ...def, idx: r.idx, shifted: r.shifted, original: r.original, noShift: !shiftable, info: dayInfo(r.idx) });
  };

  const shinkoku = kgMarch15(y + 1);
  push({ key: "kaigyo", group: "must", name: "個人事業の開業・廃業等届出書(開業届)", where: "納税地の税務署(e-Taxでも可)", law: "所得税法229条",
    note: "2026年1月から、期限が「開業から1か月以内」から「開業した年の確定申告期限まで」に変わりました。青色申告の申請と一緒に出すのが一般的です。" }, shinkoku, true);
  push({ key: "shinkoku", group: "must", name: "所得税の確定申告(開業した年の分)", where: "納税地の税務署(e-Taxでも可)", law: "所得税法120条",
    note: "開業した年の翌年2月16日から3月15日まで。青色申告で65万円の控除を受けるには、この期限までにe-Taxで送る(または優良な電子帳簿で保存する)必要があります。" }, shinkoku, true);

  const ao = aoiroDeadline(startIdx);
  push({ key: "aoiro", group: "aoiro", name: "所得税の青色申告承認申請書", where: "納税地の税務署(e-Taxでも可)", law: "所得税法144条",
    note: `期限は${ao.rule}。過ぎると開業した年は白色申告になり、青色申告は翌年分から(翌年3月15日までに申請)になります。` }, ao.base, true);
  push({ key: "genka", group: "aoiro", name: "棚卸資産の評価方法・減価償却資産の償却方法の届出書", where: "納税地の税務署", law: "所得税法施行令100条・123条", optional: true,
    note: "出さなくてもかまいません。出さない場合は法律で決まった方法(棚卸資産は最終仕入原価法、減価償却は定額法)になります。定率法などを選びたい人だけ出します。" }, shinkoku, true);

  if (input.kazoku) {
    push({ key: "senju", group: "kazoku", name: "青色事業専従者給与に関する届出書", where: "納税地の税務署", law: "所得税法57条2項",
      note: "期限は青色申告承認申請書と同じです。開業後に家族を雇い始めたときは、その日から2か月以内。届け出た金額の範囲で、実際に払った給与が経費になります。" }, ao.base, true);
  }
  if (input.kazoku || input.koyou) {
    push({ key: "kyuyo", group: input.koyou ? "koyou" : "kazoku", name: "給与支払事務所等の開設届出書", where: "納税地の税務署", law: "所得税法230条",
      note: "給与を払う事務所を開設した日から1か月以内。ここでは開業日から数えています。開業より後に人を雇ったときは、その日から数え直してください。" }, monthDeadline(startIdx, 1), true);
    items.push({ key: "nouki", group: input.koyou ? "koyou" : "kazoku", name: "源泉所得税の納期の特例の承認に関する申請書", where: "納税地の税務署", law: "所得税法216・217条",
      optional: true, anytime: true, idx: null, info: null,
      note: "給与を払う人が常に10人未満なら、給与から天引きした所得税を毎月ではなく年2回(7月10日・翌年1月20日)にまとめて納められます。期限はなく、原則として出した日の翌月に払う給与から適用されます。" });
  }

  if (input.invoice) {
    const end = jdn(y, 12, 31);
    push({ key: "invoice", group: "invoice", name: "適格請求書発行事業者の登録申請書", where: "e-Tax または インボイス登録センター", law: "消費税法施行令70条の4ほか",
      note: "開業した年の12月31日までに申請すれば、開業日にさかのぼって登録を受けられます。これは「期間中」の定めなので、12月31日が休みでも延びません。年末は税務署が閉まるので早めに。" }, end, false);
    push({ key: "kani", group: "invoice", name: "消費税簡易課税制度選択届出書", where: "納税地の税務署", law: "消費税法37条ほか", optional: true,
      note: "売上から消費税額をざっくり計算する方法(簡易課税)を開業した年から使うなら、その年の12月31日まで。こちらも延びません。簡易課税が有利かどうかは、仕入れや経費の多さで変わります。" }, end, false);
  }

  const dated = items.filter((it) => it.idx !== null).sort((a, b) => a.idx - b.idx);
  const anytime = items.filter((it) => it.idx === null);

  return {
    input,
    start: dayInfo(startIdx),
    items: [...dated, ...anytime],
    aoiro: {
      deadline: dated.find((it) => it.key === "aoiro"),
      rule: ao.rule,
      deemed: dayInfo(aoiroDeemedDate(startIdx)),
      nextYear: dayInfo(nextOpenDay(kgMarch15(y + 1))),
    },
  };
}

/*
 * 今日の時点で、開業した年から青色申告にできるかの判定。
 *   ok    期限まで余裕あり / today 今日が期限 / late 過ぎた(翌年分から)
 */
function aoiroJudge(schedule, todayIdx) {
  const dl = schedule.aoiro.deadline;
  if (todayIdx < dl.idx) return { status: "ok", left: dl.idx - todayIdx };
  if (todayIdx === dl.idx) return { status: "today", left: 0 };
  return { status: "late", left: -1 };
}

function isKaigyoSupported(y, m, d) {
  return jdn(y, m, d) >= jdn(KG_START.y, KG_START.m, KG_START.d);
}

if (typeof module !== "undefined") {
  module.exports = { buildKaigyo, aoiroJudge, aoiroDeadline, aoiroDeemedDate, isKaigyoSupported, KG_GROUPS };
}
