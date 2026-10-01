(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.P007Model = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BASELINE_NON_POSITIVE_WARNING = 'Baseline contribution is non-positive. Fix baseline economics or compare absolute contribution directly.';
  const SCENARIO_NON_POSITIVE_WARNING = 'No finite positive order uplift can recover baseline contribution while contribution per scenario order is non-positive.';

  function finiteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function pct(v) {
    return finiteNumber(v) ? v : null;
  }

  function validateBaseline(b) {
    const errors = [];
    const nonNegative = [
      ['Unit selling price', b.P], ['Unit COGS', b.C], ['Fixed fee', b.f],
      ['Customer-paid shipping revenue', b.Sr], ['Fulfilment/shipping cost', b.Sc], ['Acquisition cost', b.Ac]
    ];
    for (const [label, value] of nonNegative) {
      if (!finiteNumber(value) || value < 0) errors.push(`${label} must be 0 or more.`);
    }
    if (!finiteNumber(b.r) || b.r < 0 || b.r >= 1) errors.push('Variable fee rate must be at least 0% and below 100%.');
    if (!finiteNumber(b.B) || b.B <= 0) errors.push('Baseline orders must be greater than 0.');
    if (!finiteNumber(b.U) || b.U <= 0) errors.push('Baseline average units/order must be greater than 0.');
    return errors;
  }

  function calculateBaseline(b) {
    const errors = validateBaseline(b);
    if (errors.length) return { errors };
    const MR = b.P * b.U;
    const TR = MR + b.Sr;
    const COGS = b.C * b.U;
    const Fees = TR * b.r + b.f;
    const GP = MR - COGS;
    const GM = MR === 0 ? null : GP / MR;
    const contribution = TR - COGS - Fees - b.Sc - b.Ac;
    const CM = TR === 0 ? null : contribution / TR;
    return {
      errors: [], MR, TR, COGS, Fees, GP, GM, contribution, CM,
      totalRevenue: b.B * TR,
      totalCOGS: b.B * COGS,
      totalContribution: b.B * contribution,
      totalUnits: b.B * b.U,
      warnings: [
        ...(b.C > b.P ? ['Unit COGS is above unit selling price.'] : []),
        ...(GM !== null && GM <= 0 ? ['Gross margin is non-positive.'] : []),
        ...(contribution <= 0 ? ['Baseline contribution/order is non-positive.'] : [])
      ]
    };
  }

  function validateScenario(s) {
    const errors = [];
    if (!finiteNumber(s.a) || s.a < 0 || s.a > 1) errors.push('Promotion adoption must be between 0% and 100%.');
    if (!finiteNumber(s.g) || s.g <= -1) errors.push('Expected order change must be greater than -100%.');
    for (const [label, value] of [['Scenario acquisition cost', s.As], ['Promoted fulfilment/shipping cost', s.Sp], ['Promoted shipping revenue', s.SRp]]) {
      if (!finiteNumber(value) || value < 0) errors.push(`${label} must be 0 or more.`);
    }
    if (s.type === 'percent') {
      if (!finiteNumber(s.d) || s.d < 0 || s.d > 1) errors.push('Discount must be between 0% and 100%.');
      if (!finiteNumber(s.Q) || s.Q <= 0) errors.push('Promoted average units/order must be greater than 0.');
    } else if (s.type === 'bundle') {
      if (!Number.isInteger(s.N) || s.N < 2) errors.push('Buy-N units received must be an integer of at least 2.');
      if (!Number.isInteger(s.M) || s.M < 0) errors.push('Pay-M units paid must be a non-negative integer.');
      if (Number.isInteger(s.N) && Number.isInteger(s.M) && s.M > s.N) errors.push('Pay-M cannot exceed Buy-N units received.');
    } else {
      errors.push('Promotion type must be Percentage Discount or Buy N / Pay M.');
    }
    return errors;
  }

  function calculateScenario(b, base, s) {
    const errors = [...validateBaseline(b), ...validateScenario(s)];
    if (errors.length) return { errors };
    const regularMR = b.P * b.U;
    const regularTR = regularMR + b.Sr;
    const regularCOGS = b.C * b.U;
    const regularFees = regularTR * b.r + b.f;
    const regularContribution = regularTR - regularCOGS - regularFees - b.Sc - s.As;

    let Q, promoMR, promoUndiscMR, promoCOGS, discountPerPromoOrder;
    if (s.type === 'percent') {
      Q = s.Q;
      promoMR = Q * b.P * (1 - s.d);
      promoUndiscMR = Q * b.P;
      promoCOGS = Q * b.C;
      discountPerPromoOrder = promoUndiscMR - promoMR;
    } else {
      Q = s.N;
      promoMR = s.M * b.P;
      promoUndiscMR = s.N * b.P;
      promoCOGS = s.N * b.C;
      discountPerPromoOrder = (s.N - s.M) * b.P;
    }
    const promoTR = promoMR + s.SRp;
    const promoFees = promoTR * b.r + b.f;
    const promoGP = promoMR - promoCOGS;
    const promoContribution = promoTR - promoCOGS - promoFees - s.Sp - s.As;

    const weightedUnits = (1 - s.a) * b.U + s.a * Q;
    const weightedRevenue = (1 - s.a) * regularTR + s.a * promoTR;
    const weightedContribution = (1 - s.a) * regularContribution + s.a * promoContribution;
    const orders = b.B * (1 + s.g);
    const regularOrders = orders * (1 - s.a);
    const promoOrders = orders * s.a;
    const totalContribution = orders * weightedContribution;
    const totalRevenue = orders * weightedRevenue;
    const totalUnits = orders * weightedUnits;
    const deltaContribution = totalContribution - base.totalContribution;
    const deltaContributionPct = base.totalContribution === 0 ? null : deltaContribution / Math.abs(base.totalContribution);
    const totalDiscountCost = promoOrders * discountPerPromoOrder;

    let breakEvenOrders = null;
    let breakEvenOrderChange = null;
    let breakEvenOrdersRounded = null;
    let breakEvenWarning = null;
    if (base.totalContribution <= 0) {
      breakEvenWarning = BASELINE_NON_POSITIVE_WARNING;
    } else if (weightedContribution <= 0) {
      breakEvenWarning = SCENARIO_NON_POSITIVE_WARNING;
    } else {
      breakEvenOrders = base.totalContribution / weightedContribution;
      breakEvenOrderChange = breakEvenOrders / b.B - 1;
      breakEvenOrdersRounded = Math.ceil(breakEvenOrders);
    }

    const warnings = [];
    if (promoContribution <= 0) warnings.push('Promoted-order contribution is non-positive.');
    if (weightedContribution <= 0) warnings.push('Weighted scenario contribution/order is non-positive.');
    if (s.type === 'percent' && s.d === 1) warnings.push('100% discount leaves zero merchandise revenue on promoted orders.');
    if (breakEvenWarning) warnings.push(breakEvenWarning);
    if (breakEvenOrderChange !== null && breakEvenOrderChange < 0) warnings.push('Break-even order change is negative: the scenario could tolerate an order decline and still match baseline contribution under these assumptions.');

    const result = {
      errors: [], name: s.name, type: s.type, orders, regularOrders, promoOrders,
      regularMR, regularTR, regularCOGS, regularFees, regularContribution,
      Q, promoMR, promoUndiscMR, promoCOGS, promoTR, promoFees, promoGP, promoContribution,
      discountPerPromoOrder, weightedUnits, weightedRevenue, weightedContribution,
      totalContribution, totalRevenue, totalUnits, deltaContribution, deltaContributionPct,
      totalDiscountCost, breakEvenOrders, breakEvenOrderChange, breakEvenOrdersRounded,
      breakEvenWarning, warnings
    };
    result.sensitivity = buildSensitivity(b, base, s, result);
    return result;
  }

  function buildSensitivity(b, base, s, scenarioResult) {
    const raw = [-0.10, 0, 0.10, 0.20, 0.30, 0.50, s.g];
    if (scenarioResult.breakEvenOrderChange !== null && Number.isFinite(scenarioResult.breakEvenOrderChange)) raw.push(scenarioResult.breakEvenOrderChange);
    const unique = [];
    for (const v of raw) {
      if (!Number.isFinite(v) || v <= -1) continue;
      if (!unique.some(x => Math.abs(x - v) < 1e-10)) unique.push(v);
    }
    unique.sort((a, b2) => a - b2);
    return unique.map(g => {
      const orders = b.B * (1 + g);
      const totalUnits = orders * scenarioResult.weightedUnits;
      const totalRevenue = orders * scenarioResult.weightedRevenue;
      const totalContribution = orders * scenarioResult.weightedContribution;
      return {
        g, orders, totalUnits, totalRevenue, totalContribution,
        deltaContribution: totalContribution - base.totalContribution
      };
    });
  }

  function calculateLab(b, scenarios) {
    const errors = validateBaseline(b);
    if (!Array.isArray(scenarios) || scenarios.length < 2 || scenarios.length > 4) errors.push('Create between 2 and 4 scenarios.');
    if (errors.length) return { errors, baseline: null, scenarios: [] };
    const baseline = calculateBaseline(b);
    const scenarioResults = scenarios.map((s, i) => {
      const r = calculateScenario(b, baseline, s);
      if (r.errors && r.errors.length) r.errors = r.errors.map(msg => `${s.name || `Scenario ${i + 1}`}: ${msg}`);
      return r;
    });
    const scenarioErrors = scenarioResults.flatMap(r => r.errors || []);
    if (scenarioErrors.length) return { errors: scenarioErrors, baseline, scenarios: scenarioResults };
    const highest = scenarioResults.reduce((best, cur) => cur.totalContribution > best.totalContribution ? cur : best, scenarioResults[0]);
    return { errors: [], baseline, scenarios: scenarioResults, highest };
  }

  function formatMoney(value, currency) {
    if (!Number.isFinite(value)) return 'N/A';
    const c = currency || 'USD';
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: c, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    } catch (_) {
      return `${c} ${value.toFixed(2)}`;
    }
  }

  function formatPercent(value, digits) {
    if (!Number.isFinite(value)) return 'N/A';
    return `${(value * 100).toFixed(digits == null ? 1 : digits)}%`;
  }

  function formatNumber(value, digits) {
    if (!Number.isFinite(value)) return 'N/A';
    return Number(value).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function containsNonFiniteDisplay(text) {
    return /\b(?:Infinity|NaN)\b/.test(String(text));
  }

  return {
    BASELINE_NON_POSITIVE_WARNING,
    SCENARIO_NON_POSITIVE_WARNING,
    validateBaseline,
    validateScenario,
    calculateBaseline,
    calculateScenario,
    calculateLab,
    formatMoney,
    formatPercent,
    formatNumber,
    containsNonFiniteDisplay,
    pct
  };
});
