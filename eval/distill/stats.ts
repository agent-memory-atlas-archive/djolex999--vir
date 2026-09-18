// Small-sample paired tests with no dependency. n = 15 pairs on a 0-2 scale
// is the whole design, so the tests are exact where they can be (sign test)
// and the t-test carries its assumptions openly.

function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) {
    y += 1;
    ser += cj / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a, b).
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// Student t CDF, P(T <= t) with df degrees of freedom.
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * betai(df / 2, 0.5, x);
  return t >= 0 ? 1 - tail : tail;
}

export interface PairedTResult {
  n: number;
  mean: number;
  sd: number;
  t: number;
  df: number;
  p: number;
}

export function pairedT(diffs: readonly number[]): PairedTResult {
  const n = diffs.length;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const ss = diffs.reduce((a, d) => a + (d - mean) * (d - mean), 0);
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
  const df = n - 1;
  if (sd === 0) return { n, mean, sd, t: 0, df, p: 1 };
  const t = mean / (sd / Math.sqrt(n));
  const p = 2 * (1 - tCdf(Math.abs(t), df));
  return { n, mean, sd, t, df, p: Math.min(1, p) };
}

export interface SignTestResult {
  pos: number;
  neg: number;
  ties: number;
  p: number;
}

function binomPmf(n: number, k: number): number {
  let c = 1;
  for (let i = 1; i <= k; i += 1) c = (c * (n - k + i)) / i;
  return c / 2 ** n;
}

// Exact two-sided sign test on the non-zero differences.
export function signTest(diffs: readonly number[]): SignTestResult {
  const pos = diffs.filter((d) => d > 0).length;
  const neg = diffs.filter((d) => d < 0).length;
  const ties = diffs.length - pos - neg;
  const n = pos + neg;
  if (n === 0) return { pos, neg, ties, p: 1 };
  const k = Math.min(pos, neg);
  let tail = 0;
  for (let i = 0; i <= k; i += 1) tail += binomPmf(n, i);
  return { pos, neg, ties, p: Math.min(1, 2 * tail) };
}
