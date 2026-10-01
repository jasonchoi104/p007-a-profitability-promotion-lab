'use strict';
const assert = require('assert');
const M = require('./model.js');

const near = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
const baselineFixture = () => ({ P: 10, C: 4, U: 2, B: 100, r: 0, f: 0, Sr: 0, Sc: 2, Ac: 1 });
const percentScenario = (overrides = {}) => ({ name: 'Percent', type: 'percent', d: .2, Q: 2, a: 1, g: 0, As: 1, Sp: 2, SRp: 0, ...overrides });
const bundleScenario = (overrides = {}) => ({ name: 'Bundle', type: 'bundle', N: 3, M: 2, a: 1, g: 0, As: 1, Sp: 2, SRp: 0, ...overrides });

function run() {
  const report = [];
  const pass = (id, fn) => { fn(); report.push(`${id} PASS`); };

  pass('T1 baseline arithmetic', () => {
    const r = M.calculateBaseline(baselineFixture());
    near(r.TR, 20); near(r.COGS, 8); near(r.GP, 12); near(r.GM, .6); near(r.contribution, 9); near(r.totalContribution, 900);
  });

  pass('T2 20% discount', () => {
    const b = baselineFixture(), base = M.calculateBaseline(b), r = M.calculateScenario(b, base, percentScenario());
    near(r.promoMR, 16); near(r.promoCOGS, 8); near(r.promoContribution, 5); near(r.totalContribution, 500); near(r.deltaContribution, -400); near(r.totalDiscountCost, 400); near(r.breakEvenOrders, 180); near(r.breakEvenOrderChange, .8);
  });

  pass('T3 Buy 3 / Pay 2', () => {
    const b = baselineFixture(), base = M.calculateBaseline(b), r = M.calculateScenario(b, base, bundleScenario());
    near(r.promoMR, 20); near(r.promoCOGS, 12); near(r.promoContribution, 5); near(r.totalContribution, 500); near(r.totalDiscountCost, 1000); near(r.breakEvenOrderChange, .8);
  });

  pass('T4 mixed adoption', () => {
    const b = baselineFixture(), base = M.calculateBaseline(b), r = M.calculateScenario(b, base, percentScenario({a:.5}));
    near(r.regularContribution, 9); near(r.promoContribution, 5); near(r.weightedContribution, 7); near(r.totalContribution, 700); near(r.breakEvenOrderChange, 0.2857142857142858);
  });

  pass('T5 fee calculation', () => {
    const b = {...baselineFixture(), r:.05, f:.5}, r = M.calculateBaseline(b);
    near(r.Fees, 1.5); near(r.contribution, 7.5); near(r.totalContribution, 750);
  });

  pass('T6 zero-adoption identity', () => {
    const b = baselineFixture(), base = M.calculateBaseline(b), r = M.calculateScenario(b, base, percentScenario({a:0,d:.9,Q:7,g:0,As:b.Ac,Sp:99,SRp:77}));
    near(r.totalContribution, base.totalContribution); near(r.totalRevenue, base.totalRevenue); near(r.totalUnits, base.totalUnits);
  });

  pass('T7 zero-discount identity', () => {
    const b = baselineFixture(), base = M.calculateBaseline(b), r = M.calculateScenario(b, base, percentScenario({d:0,Q:b.U,a:1,g:0,As:b.Ac,Sp:b.Sc,SRp:b.Sr}));
    near(r.totalContribution, base.totalContribution); near(r.totalRevenue, base.totalRevenue); near(r.totalUnits, base.totalUnits);
  });

  pass('T8 non-positive baseline', () => {
    const b = {P:5,C:4,U:1,B:100,r:0,f:0,Sr:0,Sc:2,Ac:1}, base = M.calculateBaseline(b), r = M.calculateScenario(b, base, percentScenario({d:0,Q:1,As:1,Sp:2}));
    near(base.contribution, -2); near(base.totalContribution, -200); assert.strictEqual(r.breakEvenOrderChange, null); assert.ok(r.warnings.includes(M.BASELINE_NON_POSITIVE_WARNING));
  });

  pass('T9 non-positive scenario contribution', () => {
    const b = baselineFixture(), base = M.calculateBaseline(b), r = M.calculateScenario(b, base, percentScenario({d:1,Q:2,a:1,Sp:20,As:20}));
    assert.ok(r.weightedContribution <= 0); assert.strictEqual(r.breakEvenOrderChange, null); assert.ok(r.warnings.includes(M.SCENARIO_NON_POSITIVE_WARNING));
    assert.ok(!M.containsNonFiniteDisplay(JSON.stringify(r)));
  });

  pass('T10 validation rejects', () => {
    const b = baselineFixture();
    assert.ok(M.validateScenario(percentScenario({a:1.01})).length);
    assert.ok(M.validateScenario(percentScenario({g:-1})).length);
    assert.ok(M.validateScenario(bundleScenario({N:3,M:4})).length);
    assert.ok(M.validateBaseline({...b,C:-1}).length);
    assert.ok(M.validateBaseline({...b,B:0}).length);
  });

  pass('EXTRA no binary artefact in money display', () => {
    const s = M.formatMoney(0.1 + 0.2, 'USD');
    assert.ok(!s.includes('00000000000000004'));
    assert.ok(!M.containsNonFiniteDisplay(s));
  });

  pass('EXTRA synthetic demo fixture', () => {
    const b={P:20,C:7,r:.03,f:.3,Sr:0,Sc:5,Ac:4,B:500,U:2};
    const scenarios=[
      {name:'15% off',type:'percent',d:.15,Q:2.2,a:.6,g:.1,As:4,Sp:5.5,SRp:0},
      {name:'Buy 3 / Pay 2',type:'bundle',N:3,M:2,a:.3,g:.08,As:4,Sp:6,SRp:0},
      {name:'Buy 5 / Pay 4',type:'bundle',N:5,M:4,a:.12,g:.05,As:4,Sp:7.5,SRp:0}
    ];
    const r=M.calculateLab(b,scenarios);
    assert.deepStrictEqual(r.errors,[]);
    near(r.baseline.contribution,15.5); near(r.baseline.totalContribution,7750);
    near(r.scenarios[0].promoContribution,11.078); near(r.scenarios[0].weightedContribution,12.8468); near(r.scenarios[0].totalContribution,7065.74); near(r.scenarios[0].deltaContribution,-684.26); near(r.scenarios[0].totalDiscountCost,2178); near(r.scenarios[0].breakEvenOrderChange,0.20652613880499437,1e-12);
    near(r.scenarios[1].promoContribution,7.5); near(r.scenarios[1].weightedContribution,13.1); near(r.scenarios[1].totalContribution,7074); near(r.scenarios[1].deltaContribution,-676); near(r.scenarios[1].totalDiscountCost,3240); near(r.scenarios[1].breakEvenOrderChange,0.18320610687022904,1e-12);
    near(r.scenarios[2].promoContribution,30.8); near(r.scenarios[2].weightedContribution,17.336); near(r.scenarios[2].totalContribution,9101.4); near(r.scenarios[2].deltaContribution,1351.4); near(r.scenarios[2].totalDiscountCost,1260); near(r.scenarios[2].breakEvenOrderChange,-0.1059067835717582,1e-12);
    assert.strictEqual(r.highest.name,'Buy 5 / Pay 4');
  });

  console.log(report.join('\n'));
  console.log(`\n${report.length} development checks passed.`);
}
run();
