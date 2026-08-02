/*
 * 副業の確定申告・追加税額の概算計算ロジック。DOM・windowの状態には触れない純粋関数のみで構成する。
 * 「副業を始めたことで、本業だけの場合と比べていくら税金が増えるか」を算出する設計。
 * takehome-calculator/furusato-simulatorと所得税・給与所得控除のロジックを共有。
 */

function salaryIncomeDeduction(income) {
  if (income <= 1625000) return 550000;
  if (income <= 1800000) return income * 0.4 - 100000;
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}

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

  const basicDeductionIncomeTax = 480000;
  const basicDeductionResidentTax = 430000;

  // 給与のみの場合の税額(比較用ベースライン)
  const taxableSalaryOnlyForIncomeTax = Math.max(0, employmentIncome - basicDeductionIncomeTax);
  const incomeTaxSalaryOnly = incomeTax(taxableSalaryOnlyForIncomeTax);
  const taxableSalaryOnlyForResidentTax = Math.max(0, employmentIncome - basicDeductionResidentTax);
  const residentTaxSalaryOnly = residentTax(taxableSalaryOnlyForResidentTax);

  // 給与+副業を合算した場合の税額
  const taxableCombinedForIncomeTax = Math.max(0, employmentIncome + sidejobProfit - basicDeductionIncomeTax);
  const incomeTaxCombined = incomeTax(taxableCombinedForIncomeTax);
  const taxableCombinedForResidentTax = Math.max(0, employmentIncome + sidejobProfit - basicDeductionResidentTax);
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
