/*
 * 副業の確定申告・追加税額の概算計算ロジック。DOM・windowの状態には触れない純粋関数のみで構成する。
 * 「副業を始めたことで、本業だけの場合と比べていくら税金が増えるか」を算出する設計。
 * takehome-calculator/furusato-simulatorと所得税・給与所得控除のロジックを共有。
 */

// どの年の税金か: 令和8年(2026年)分の所得税と、その所得にかかる令和9年度の住民税。
// 令和8年度税制改正(基礎控除・給与所得控除の引上げ)を反映している。
// 出典: 国税庁 No.1410 給与所得控除・No.1199 基礎控除、財務省「令和8年度税制改正の大綱」

// 給与所得控除(令和8年分・令和9年分)。最低保障額は本則69万円＋令和8・9年の特例5万円＝74万円。
// 住民税も令和9年度分・令和10年度分は同じ74万円(大綱の地方税(1))。
// ※ 収入660万円未満は本来「所得税法別表第五」の4,000円刻みの表を使うが、概算なので式で計算する
function salaryIncomeDeduction(income) {
  if (income <= 2200000) return Math.min(income, 740000);
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}

// 所得税の基礎控除(令和8年分・令和9年分)。本人の合計所得金額で変わる。
// 本則62万円に、合計所得489万円以下は42万円・489万円超655万円以下は5万円を加算する特例。
function incomeTaxBasicDeduction(totalIncome) {
  if (totalIncome <= 4890000) return 1040000;
  if (totalIncome <= 6550000) return 670000;
  if (totalIncome <= 23500000) return 620000;
  if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24500000) return 320000;
  if (totalIncome <= 25000000) return 160000;
  return 0;
}

// 住民税の基礎控除。所得税と違って引き上げられておらず、43万円のまま。
function residentTaxBasicDeduction(totalIncome) {
  if (totalIncome <= 24000000) return 430000;
  if (totalIncome <= 24500000) return 290000;
  if (totalIncome <= 25000000) return 150000;
  return 0;
}

// 所得税の超過累進税率表(平成27年分以後。令和8年分も同じ)
const INCOME_TAX_BRACKETS = [
  { limit: 1950000, rate: 0.05, deduction: 0 },
  { limit: 3300000, rate: 0.1, deduction: 97500 },
  { limit: 6950000, rate: 0.2, deduction: 427500 },
  { limit: 9000000, rate: 0.23, deduction: 636000 },
  { limit: 18000000, rate: 0.33, deduction: 1536000 },
  { limit: 40000000, rate: 0.4, deduction: 2796000 },
  { limit: Infinity, rate: 0.45, deduction: 4796000 },
];

function incomeTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.limit);
  const base = taxableIncome * bracket.rate - bracket.deduction;
  return Math.max(0, Math.round(base * 1.021));
}

function residentTax(taxableIncomeBase) {
  if (taxableIncomeBase <= 0) return 0;
  return Math.round(taxableIncomeBase * 0.1) + 5000;
}

function calcSidejobTax(input) {
  const { salaryIncome, sidejobIncome, sidejobExpense } = input;

  const salaryDeduction = salaryIncomeDeduction(salaryIncome);
  const employmentIncome = Math.max(0, salaryIncome - salaryDeduction);
  const sidejobProfit = Math.max(0, sidejobIncome - sidejobExpense);

  // ★基礎控除は合計所得金額で変わる★ 副業を足して合計所得が489万円・655万円を超えると、
  // 所得税の基礎控除が104万円→67万円→62万円と減るので、その分も「副業で増える税金」に入る
  const combinedIncome = employmentIncome + sidejobProfit;

  // 給与のみの場合の税額(比較用ベースライン)
  const taxableSalaryOnlyForIncomeTax = Math.max(0, employmentIncome - incomeTaxBasicDeduction(employmentIncome));
  const incomeTaxSalaryOnly = incomeTax(taxableSalaryOnlyForIncomeTax);
  const taxableSalaryOnlyForResidentTax = Math.max(0, employmentIncome - residentTaxBasicDeduction(employmentIncome));
  const residentTaxSalaryOnly = residentTax(taxableSalaryOnlyForResidentTax);

  // 給与+副業を合算した場合の税額
  const taxableCombinedForIncomeTax = Math.max(0, combinedIncome - incomeTaxBasicDeduction(combinedIncome));
  const incomeTaxCombined = incomeTax(taxableCombinedForIncomeTax);
  const taxableCombinedForResidentTax = Math.max(0, combinedIncome - residentTaxBasicDeduction(combinedIncome));
  const residentTaxCombined = residentTax(taxableCombinedForResidentTax);

  // 副業によって増える税額(差分)
  const additionalIncomeTax = incomeTaxCombined - incomeTaxSalaryOnly;
  const additionalResidentTax = residentTaxCombined - residentTaxSalaryOnly;
  const additionalTaxTotal = additionalIncomeTax + additionalResidentTax;

  const sidejobTakeHome = sidejobProfit - additionalTaxTotal;

  // 所得税の確定申告要否の目安(給与所得者は雑所得等が年20万円超で確定申告が必要。20万円以下でも住民税の申告は別途必要)
  const needsIncomeTaxFiling = sidejobProfit > 200000;

  return {
    sidejobIncome,
    sidejobExpense,
    sidejobProfit,
    additionalIncomeTax,
    additionalResidentTax,
    additionalTaxTotal,
    sidejobTakeHome,
    needsIncomeTaxFiling,
  };
}
