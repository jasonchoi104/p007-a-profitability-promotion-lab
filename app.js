'use strict';
(function () {
  const M = window.P007Model;
  const $ = id => document.getElementById(id);
  const n = value => value === '' ? NaN : Number(value);

  const baselineDefs = [
    ['P','Unit selling price','20.00','0','0.01'],
    ['C','Unit COGS','7.00','0','0.01'],
    ['r','Variable fee rate (%)','3.0','0','0.1'],
    ['f','Fixed fee / order','0.30','0','0.01'],
    ['Sr','Customer-paid shipping revenue / order','0.00','0','0.01'],
    ['Sc','Fulfilment / shipping cost / order','5.00','0','0.01'],
    ['Ac','Acquisition cost / order','4.00','0','0.01'],
    ['B','Baseline orders in analysis period','500','0','1'],
    ['U','Baseline average units / order','2.00','0','0.01']
  ];

  let scenarios = [
    { id: 1, type: 'percent', d: 15, Q: 2.2, a: 60, g: 10, As: 4, Sp: 5.5, SRp: 0 },
    { id: 2, type: 'bundle', N: 3, M: 2, a: 30, g: 8, As: 4, Sp: 6, SRp: 0 },
    { id: 3, type: 'bundle', N: 5, M: 4, a: 12, g: 5, As: 4, Sp: 7.5, SRp: 0 }
  ];
  let nextId = 4;
  let selectedSensitivityId = 1;
  let latest = null;

  function initBaseline() {
    $('baseline-inputs').innerHTML = baselineDefs.map(([key,label,value,min,step]) => `
      <label>${label}
        <input data-base="${key}" type="number" value="${value}" min="${min}" step="${step}" inputmode="decimal">
      </label>`).join('');
    $('baseline-inputs').addEventListener('input', recalc);
    $('currency').addEventListener('change', recalc);
    $('period').addEventListener('input', recalc);
  }

  function getBaseline() {
    const out = {};
    document.querySelectorAll('[data-base]').forEach(el => out[el.dataset.base] = n(el.value));
    out.r = out.r / 100;
    return out;
  }

  function modelScenario(s, index) {
    const common = {
      name: `Scenario ${index + 1} — ${s.type === 'percent' ? `${num(s.d,1)}% off` : `Buy ${s.N} / Pay ${s.M}`}`,
      type: s.type,
      a: n(s.a) / 100,
      g: n(s.g) / 100,
      As: n(s.As), Sp: n(s.Sp), SRp: n(s.SRp)
    };
    return s.type === 'percent'
      ? { ...common, d: n(s.d) / 100, Q: n(s.Q) }
      : { ...common, N: n(s.N), M: n(s.M) };
  }

  function num(v, digits) {
    return Number.isFinite(Number(v)) ? Number(v).toFixed(digits).replace(/\.0+$/,'') : '';
  }

  function renderScenarios() {
    $('scenario-editor').innerHTML = scenarios.map((s, i) => `
      <article class="scenario-card" data-id="${s.id}">
        <div class="scenario-card-head">
          <h3>Scenario ${i + 1}</h3>
          <button type="button" class="button danger remove-scenario" data-remove="${s.id}" ${scenarios.length <= 2 ? 'disabled' : ''}>Remove</button>
        </div>
        <div class="scenario-fields">
          <label>Promotion type
            <select data-field="type">
              <option value="percent" ${s.type === 'percent' ? 'selected' : ''}>Percentage Discount</option>
              <option value="bundle" ${s.type === 'bundle' ? 'selected' : ''}>Buy N / Pay M</option>
            </select>
          </label>
          <label>Promotion adoption (%)
            <input data-field="a" type="number" min="0" max="100" step="0.1" value="${s.a}">
          </label>
          <label>Expected order change (%)
            <input data-field="g" type="number" min="-99.99" step="0.1" value="${s.g}">
          </label>
          <label>Scenario acquisition cost / order
            <input data-field="As" type="number" min="0" step="0.01" value="${s.As}">
          </label>
          <label>Promoted fulfilment / shipping cost
            <input data-field="Sp" type="number" min="0" step="0.01" value="${s.Sp}">
          </label>
          <label>Promoted shipping revenue
            <input data-field="SRp" type="number" min="0" step="0.01" value="${s.SRp}">
          </label>
          ${s.type === 'percent' ? `
            <label>Discount (%)
              <input data-field="d" type="number" min="0" max="100" step="0.1" value="${s.d}">
            </label>
            <label>Promoted average units / order
              <input data-field="Q" type="number" min="0.01" step="0.01" value="${s.Q}">
            </label>` : `
            <label>Units received (N)
              <input data-field="N" type="number" min="2" step="1" value="${s.N}">
            </label>
            <label>Units paid (M)
              <input data-field="M" type="number" min="0" step="1" value="${s.M}">
            </label>`}
        </div>
      </article>`).join('');
    $('add-scenario').disabled = scenarios.length >= 4;
  }

  function readScenarioEditor(event) {
    const card = event.target.closest('.scenario-card');
    if (!card || !event.target.dataset.field) return;
    const s = scenarios.find(x => x.id === Number(card.dataset.id));
    const field = event.target.dataset.field;
    s[field] = event.target.value;
    if (field === 'type') {
      if (s.type === 'percent') { s.d = 10; s.Q = 2; }
      else { s.N = 3; s.M = 2; }
      renderScenarios();
    }
    recalc();
  }

  function addScenario() {
    if (scenarios.length >= 4) return;
    scenarios.push({ id: nextId++, type: 'percent', d: 10, Q: 2, a: 25, g: 0, As: 4, Sp: 5, SRp: 0 });
    selectedSensitivityId = scenarios[0].id;
    renderScenarios();
    recalc();
  }

  function removeScenario(id) {
    if (scenarios.length <= 2) return;
    scenarios = scenarios.filter(s => s.id !== id);
    if (!scenarios.some(s => s.id === selectedSensitivityId)) selectedSensitivityId = scenarios[0].id;
    renderScenarios();
    recalc();
  }

  function showErrors(errors) {
    const box = $('errors');
    if (!errors.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<strong>Calculation blocked.</strong><ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
  }

  function showBaseline(b, base) {
    const currency = $('currency').value;
    const period = $('period').value.trim() || 'analysis period';
    $('baseline-cards').innerHTML = [
      ['Contribution / order', M.formatMoney(base.contribution, currency), 'After fees, fulfilment and acquisition'],
      ['Total contribution', M.formatMoney(base.totalContribution, currency), `Across ${M.formatNumber(b.B,0)} baseline orders`],
      ['Gross margin', M.formatPercent(base.GM,1), 'Merchandise economics only'],
      ['Baseline volume', `${M.formatNumber(b.B,0)} orders`, `${M.formatNumber(base.totalUnits,1)} units · ${escapeHtml(period)}`]
    ].map(([label,value,note]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');

    const warnings = base.warnings || [];
    $('baseline-warnings').hidden = !warnings.length;
    $('baseline-warnings').innerHTML = warnings.length ? `<strong>Baseline warning</strong><ul>${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '';
  }

  function renderComparison(results) {
    const currency = $('currency').value;
    $('comparison-body').innerHTML = results.map(r => `
      <tr>
        <td><strong>${escapeHtml(r.name)}</strong>${r.warnings.length ? `<br><small class="negative">${escapeHtml(r.warnings[0])}</small>` : ''}</td>
        <td>${M.formatNumber(r.orders,1)}</td>
        <td>${M.formatMoney(r.weightedRevenue,currency)}</td>
        <td>${M.formatMoney(r.weightedContribution,currency)}</td>
        <td>${M.formatMoney(r.totalContribution,currency)}</td>
        <td class="${r.deltaContribution >= 0 ? 'positive' : 'negative'}">${M.formatMoney(r.deltaContribution,currency)}${r.deltaContributionPct === null ? '' : ` · ${M.formatPercent(r.deltaContributionPct,1)}`}</td>
        <td>${M.formatMoney(r.totalDiscountCost,currency)}</td>
        <td>${r.breakEvenOrderChange === null ? `N/A${r.breakEvenWarning ? `<br><small>${escapeHtml(r.breakEvenWarning)}</small>` : ''}` : `${M.formatPercent(r.breakEvenOrderChange,2)}<br><small>${M.formatNumber(r.breakEvenOrdersRounded,0)} whole orders</small>`}</td>
      </tr>`).join('');
  }

  function renderSummary(lab, modelScenarios) {
    const h = lab.highest;
    const currency = $('currency').value;
    const source = modelScenarios[lab.scenarios.indexOf(h)];
    let guardrail = '';
    if (lab.baseline.totalContribution <= 0) guardrail = M.BASELINE_NON_POSITIVE_WARNING;
    else if (h.weightedContribution < lab.baseline.contribution) guardrail = 'Guardrail: modelled contribution/order is lower than baseline, so the scenario relies on order volume and/or mix assumptions to recover the gap.';
    else if (h.breakEvenWarning) guardrail = h.breakEvenWarning;

    $('summary').innerHTML = `
      <p class="summary-line">Under the assumptions currently entered, <strong>${escapeHtml(h.name)}</strong> has the highest modelled contribution for the analysis period.</p>
      <div class="summary-grid">
        <div class="summary-chip"><span>Expected contribution delta</span><strong>${M.formatMoney(h.deltaContribution,currency)}</strong></div>
        <div class="summary-chip"><span>Break-even order change</span><strong>${M.formatPercent(h.breakEvenOrderChange,2)}</strong></div>
        <div class="summary-chip"><span>Promotion adoption assumption</span><strong>${M.formatPercent(source.a,1)}</strong></div>
        <div class="summary-chip"><span>Expected order-change assumption</span><strong>${M.formatPercent(source.g,1)}</strong></div>
      </div>
      ${guardrail ? `<p class="guardrail">${escapeHtml(guardrail)}</p>` : ''}`;
  }

  function renderSensitivity(lab) {
    const currency = $('currency').value;
    $('sensitivity-select').innerHTML = lab.scenarios.map((r, i) => `<option value="${scenarios[i].id}" ${scenarios[i].id === selectedSensitivityId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
    let index = scenarios.findIndex(s => s.id === selectedSensitivityId);
    if (index < 0) index = 0;
    const r = lab.scenarios[index];
    $('sensitivity-body').innerHTML = r.sensitivity.map(row => `
      <tr>
        <td>${M.formatPercent(row.g,2)}</td>
        <td>${M.formatNumber(row.orders,1)}</td>
        <td>${M.formatNumber(row.totalUnits,1)}</td>
        <td>${M.formatMoney(row.totalRevenue,currency)}</td>
        <td>${M.formatMoney(row.totalContribution,currency)}</td>
        <td class="${row.deltaContribution >= 0 ? 'positive' : 'negative'}">${M.formatMoney(row.deltaContribution,currency)}</td>
      </tr>`).join('');
  }

  function recalc() {
    const b = getBaseline();
    const modelScenarios = scenarios.map(modelScenario);
    const lab = M.calculateLab(b, modelScenarios);
    latest = lab;
    showErrors(lab.errors || []);
    const blocked = (lab.errors || []).length > 0;
    $('results').hidden = blocked;
    $('summary-panel').hidden = blocked;
    $('sensitivity-panel').hidden = blocked;
    if (blocked) {
      if (lab.baseline && !lab.baseline.errors.length) showBaseline(b, lab.baseline);
      else $('baseline-cards').innerHTML = '';
      return;
    }
    showBaseline(b, lab.baseline);
    renderComparison(lab.scenarios);
    renderSummary(lab, modelScenarios);
    renderSensitivity(lab);
    const visible = document.body.innerText;
    if (M.containsNonFiniteDisplay(visible)) {
      showErrors(['Unexpected non-finite value reached the display. Calculation blocked.']);
      $('results').hidden = $('summary-panel').hidden = $('sensitivity-panel').hidden = true;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  initBaseline();
  renderScenarios();
  $('scenario-editor').addEventListener('input', readScenarioEditor);
  $('scenario-editor').addEventListener('change', readScenarioEditor);
  $('scenario-editor').addEventListener('click', e => {
    const button = e.target.closest('[data-remove]');
    if (button) removeScenario(Number(button.dataset.remove));
  });
  $('add-scenario').addEventListener('click', addScenario);
  $('sensitivity-select').addEventListener('change', e => { selectedSensitivityId = Number(e.target.value); if (latest && !latest.errors.length) renderSensitivity(latest); });
  recalc();
})();
