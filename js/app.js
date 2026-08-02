/*
 * フォームの入力受付・DOM描画。計算ロジックは calculate.js に委譲する。
 */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function yen(n) {
  return Math.round(n).toLocaleString("ja-JP") + "円";
}

const form = document.getElementById("calc-form");
const resultSection = document.getElementById("screen-result");
const introSection = document.getElementById("screen-intro");
const resultBody = document.getElementById("result-body");
const btnRestart = document.getElementById("btn-restart");

function buildCrossLinkBanners() {
  const banners = [
    { href: "../sidejob-checker/", text: "向いていそうな副業ジャンルを診断する →" },
    { href: "../subsidy-checker/", text: "副業に使える給付金・補助金を確認する →" },
    { href: "../takehome-calculator/", text: "本業の手取り年収も計算してみる →" },
  ];
  return banners.map((b) => `<a class="cross-link-banner" href="${escapeHtml(b.href)}">${escapeHtml(b.text)}</a>`).join("");
}

function buildResultHtml(r) {
  const filingNote = r.needsIncomeTaxFiling
    ? `<p class="result-headline__sub">副業所得が年間20万円を超えているため、原則として所得税の確定申告が必要です。</p>`
    : `<p class="result-headline__sub">副業所得が年間20万円以下のため、所得税の確定申告は原則不要です(住民税の申告は別途必要な場合があります)。</p>`;

  return `
    <div class="result-headline">
      <p class="result-headline__label">副業の手取り額の目安</p>
      <p class="result-headline__value">${escapeHtml(yen(r.sidejobTakeHome))}</p>
      ${filingNote}
    </div>
    <div class="result-breakdown">
      <div class="result-row"><span>副業収入</span><span>${escapeHtml(yen(r.sidejobIncome))}</span></div>
      <div class="result-row"><span>必要経費</span><span>− ${escapeHtml(yen(r.sidejobExpense))}</span></div>
      <div class="result-row"><span>副業所得</span><span>${escapeHtml(yen(r.sidejobProfit))}</span></div>
      <div class="result-row"><span>副業により増える所得税(概算)</span><span>− ${escapeHtml(yen(r.additionalIncomeTax))}</span></div>
      <div class="result-row"><span>副業により増える住民税(概算)</span><span>− ${escapeHtml(yen(r.additionalResidentTax))}</span></div>
    </div>
    <div class="result-cross-links">
      ${buildCrossLinkBanners()}
    </div>
  `;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const salaryIncome = Number(formData.get("salary_income"));
  const sidejobIncome = Number(formData.get("sidejob_income"));
  const sidejobExpense = Number(formData.get("sidejob_expense") || 0);

  if (!salaryIncome || salaryIncome <= 0 || !sidejobIncome || sidejobIncome < 0) {
    return;
  }

  const result = calcSidejobTax({ salaryIncome, sidejobIncome, sidejobExpense });

  resultBody.innerHTML = buildResultHtml(result);
  introSection.hidden = true;
  resultSection.hidden = false;
});

btnRestart.addEventListener("click", () => {
  resultSection.hidden = true;
  introSection.hidden = false;
});
