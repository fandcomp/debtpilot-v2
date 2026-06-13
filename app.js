// ========== CONFIGURATION & CONSTANTS ==========
const STORAGE_KEY = 'debtpilot-state-v1';
const SESSION_KEY = 'debtpilot-session-v1';

const PLATFORM_ORDER = ['Bank Jago', 'Blu by BCA', 'SPay', 'GoPay', 'SeaBank', 'Arsanta'];
const QUICK_AMOUNTS = [100000, 250000, 500000, 1000000];

const INTL = {
  currency: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }),
  date: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
  month: new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }),
};

// ========== USERS DATABASE ==========
const USERS_DB = [
  { id: 'user-abi', username: 'abi', password: 'abdulhadi', role: 'user', name: 'Abi' },
  { id: 'user-umi', username: 'umi', password: 'rohmah', role: 'user', name: 'Umi' },
  { id: 'user-aim', username: 'aim', password: 'hafandi', role: 'admin', name: 'Aim' },
];

const DEFAULT_STATE = {
  currentUser: null, // { id, username, role, name }
  auth: {
    username: 'monitor',
    password: 'monitor123',
  },
  settings: {
    monthlyTarget: 0,
    targetDate: '',
    showAnalytics: true,
  },
  uploads: [], // New: Upload data
  transaksi: [], // New: Transaksi data
  laporan: [], // New: Laporan data
  debts: [],
  payments: [],
};

// ========== FORMATTER UTILITIES ==========
const Format = {
  money: (value) => INTL.currency.format(Math.round(Number(value) || 0)),
  date: (value) => {
    if (!value) return '-';
    const parsed = new Date(value + 'T00:00:00');
    return Number.isNaN(parsed.getTime()) ? value : INTL.date.format(parsed);
  },
  month: (value) => {
    const parsed = new Date(value + '-01T00:00:00');
    return Number.isNaN(parsed.getTime()) ? value : INTL.month.format(parsed);
  },
  percent: (value) => `${Math.round(value * 100)}%`,
};

// ========== UTILITY FUNCTIONS ==========
const Utils = {
  clamp: (value, min, max) => Math.min(Math.max(value, min), max),
  uniqueId: (prefix = 'p') => {
    if (window.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },
  daysUntil: (dateValue) => {
    const target = new Date(dateValue + 'T00:00:00');
    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = target.getTime() - localToday.getTime();
    return Math.round(diff / 86400000);
  },
};

// ========== BUSINESS LOGIC / CALCULATIONS ==========
const Calc = {
  platformSummaries: () => {
    const paidByPlatform = new Map();
    state.payments.forEach((payment) => {
      paidByPlatform.set(payment.platform, (paidByPlatform.get(payment.platform) || 0) + Number(payment.amount || 0));
    });

    return state.debts.map((debt) => {
      const paid = paidByPlatform.get(debt.platform) || 0;
      const remaining = Math.max(debt.initialDebt - paid, 0);
      const completion = debt.initialDebt > 0 ? Utils.clamp(paid / debt.initialDebt, 0, 1) : 0;
      const dueDays = Utils.daysUntil(debt.dueDate);
      let status = 'Aktif';
      if (remaining <= 0) {
        status = 'Lunas';
      } else if (dueDays < 0) {
        status = 'Terlambat';
      } else if (dueDays <= 30) {
        status = 'Jatuh tempo';
      }
      return { ...debt, paid, remaining, completion, status, dueDays };
    });
  },

  aggregateTotals: () => {
    const debts = Calc.platformSummaries();
    const totalDebt = debts.reduce((sum, debt) => sum + debt.initialDebt, 0);
    const totalPaid = debts.reduce((sum, debt) => sum + debt.paid, 0);
    const totalRemaining = debts.reduce((sum, debt) => sum + debt.remaining, 0);
    const repaymentRatio = totalDebt ? totalPaid / totalDebt : 0;
    const dueSoon = debts.filter((debt) => debt.remaining > 0 && debt.dueDays <= 30 && debt.dueDays >= 0).length;
    const overdue = debts.filter((debt) => debt.status === 'Terlambat').length;
    return { totalDebt, totalPaid, totalRemaining, repaymentRatio, dueSoon, overdue };
  },

  buildMonthlySeries: (payments) => {
    const series = new Map();
    payments.forEach((payment) => {
      const monthKey = payment.date.slice(0, 7);
      series.set(monthKey, (series.get(monthKey) || 0) + Number(payment.amount || 0));
    });
    const months = Array.from(series.keys()).sort();
    return months.map((monthKey) => ({
      monthKey,
      label: Format.month(monthKey),
      value: series.get(monthKey) || 0,
    }));
  },

  generateInsights: () => {
    const summaries = Calc.platformSummaries();
    const totals = Calc.aggregateTotals();
    const monthlySeries = Calc.buildMonthlySeries(state.payments);
    const insights = [];

    if (summaries.length === 0) return insights;

    const largestDebt = summaries.reduce((prev, curr) => curr.remaining > prev.remaining ? curr : prev);
    if (largestDebt && largestDebt.remaining > 0) {
      insights.push({
        type: 'priority',
        title: 'Prioritas utama',
        message: `Platform dengan sisa hutang terbesar adalah <strong>${largestDebt.platform}</strong> (${Format.money(largestDebt.remaining)}).`,
        icon: '📌',
      });
    }

    const soonDue = summaries.filter((d) => d.remaining > 0 && d.dueDays > 0 && d.dueDays <= 30).sort((a, b) => a.dueDays - b.dueDays);
    if (soonDue.length > 0) {
      const first = soonDue[0];
      insights.push({
        type: 'warning',
        title: 'Jatuh tempo dekat',
        message: `<strong>${first.platform}</strong> jatuh tempo dalam <strong>${first.dueDays} hari</strong>.`,
        icon: '⏰',
      });
    }

    if (totals.overdue > 0) {
      insights.push({
        type: 'danger',
        title: 'Ada hutang terlambat',
        message: `<strong>${totals.overdue} platform</strong> sudah melewati tanggal jatuh tempo. Segera lunasi!`,
        icon: '⚠️',
      });
    }

    if (totals.repaymentRatio > 0) {
      insights.push({
        type: 'success',
        title: 'Progress pelunasan',
        message: `Kamu sudah melunasi <strong>${Format.percent(totals.repaymentRatio)}</strong> dari total hutang.`,
        icon: '✓',
      });
    }

    if (monthlySeries.length > 1 && state.payments.length > 0) {
      const totalPaidMonths = monthlySeries.filter((m) => m.value > 0).length;
      if (totalPaidMonths > 0) {
        const avgMonthly = totals.totalPaid / totalPaidMonths;
        const monthsRemaining = totals.totalRemaining > 0 ? Math.ceil(totals.totalRemaining / avgMonthly) : 0;
        const targetDate = new Date(state.settings.targetDate);
        const today = new Date();
        const monthsToTarget = Math.ceil((targetDate - today) / (30 * 24 * 60 * 60 * 1000));

        if (monthsRemaining > 0 && monthsRemaining <= monthsToTarget) {
          insights.push({
            type: 'success',
            title: 'Target achievable',
            message: `Dengan rata-rata pembayaran ${Format.money(avgMonthly)}/bulan, kamu bisa lunas dalam <strong>${monthsRemaining} bulan</strong>.`,
            icon: '🎯',
          });
        } else if (monthsRemaining > monthsToTarget) {
          insights.push({
            type: 'info',
            title: 'Target need acceleration',
            message: `Untuk lunas sesuai target, perlu pembayaran rata-rata ${Format.money(Math.ceil(totals.totalRemaining / monthsToTarget))}/bulan (sekarang ${Format.money(avgMonthly)}/bulan).`,
            icon: '📈',
          });
        }
      }
    }

    return insights;
  },
};

// ========== STATE MANAGEMENT ==========
const state = loadState();
let activePanel = 'dashboard';
let historyFilters = { search: '', platform: 'all', sort: 'newest' };
let editPaymentId = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return mergeState(DEFAULT_STATE, parsed);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function mergeState(base, incoming) {
  return {
    auth: { ...base.auth, ...(incoming.auth || {}) },
    settings: { ...base.settings, ...(incoming.settings || {}) },
    debts: Array.isArray(incoming.debts) && incoming.debts.length ? incoming.debts.map((debt) => ({ ...debt })) : structuredClone(base.debts),
    payments: Array.isArray(incoming.payments) ? incoming.payments.map((payment) => ({ ...payment })) : structuredClone(base.payments),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ========== AUTHENTICATION ==========
function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

function setAuthenticated(value, user = null) {
  if (value && user) {
    sessionStorage.setItem(SESSION_KEY, 'true');
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    state.currentUser = user;
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('currentUser');
    state.currentUser = null;
  }
}

function getCurrentUser() {
  const stored = sessionStorage.getItem('currentUser');
  return stored ? JSON.parse(stored) : null;
}

function getUserRole() {
  const user = getCurrentUser();
  return user ? user.role : null;
}

function isAdmin() {
  return getUserRole() === 'admin';
}

function validateLogin(username, password) {
  const user = USERS_DB.find(u => u.username === username && u.password === password);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  };
}

// ========== DOM ELEMENTS ==========
const els = {
  loginView: document.getElementById('loginView'),
  appView: document.getElementById('appView'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  loginHint: document.getElementById('loginHint'),
  sidebarUsername: document.getElementById('sidebarUsername'),
  sidebarUserMeta: document.getElementById('sidebarUserMeta'),
  topbarMonthlyTarget: document.getElementById('topbarMonthlyTarget'),
  topbarDebtFreeTarget: document.getElementById('topbarDebtFreeTarget'),
  heroTotalDebt: document.getElementById('heroTotalDebt'),
  heroSubtitle: document.getElementById('heroSubtitle'),
  heroProgressLabel: document.getElementById('heroProgressLabel'),
  heroProgressFill: document.getElementById('heroProgressFill'),
  summaryCards: document.getElementById('summaryCards'),
  donutChart: document.getElementById('donutChart'),
  lineChart: document.getElementById('lineChart'),
  barChart: document.getElementById('barChart'),
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebarOpen: document.getElementById('sidebarOpen'),
  sidebarClose: document.getElementById('sidebarClose'),
  logoutButton: document.getElementById('logoutButton'),
  navLinks: Array.from(document.querySelectorAll('.nav-link')),
  panels: Array.from(document.querySelectorAll('.panel')),
  paymentForm: document.getElementById('paymentForm'),
  paymentId: document.getElementById('paymentId'),
  paymentPlatform: document.getElementById('paymentPlatform'),
  paymentAmount: document.getElementById('paymentAmount'),
  paymentDate: document.getElementById('paymentDate'),
  paymentNotes: document.getElementById('paymentNotes'),
  paymentSubmitButton: document.getElementById('paymentSubmitButton'),
  paymentFormTitle: document.getElementById('paymentFormTitle'),
  cancelEditButton: document.getElementById('cancelEditButton'),
  selectedPlatformStatus: document.getElementById('selectedPlatformStatus'),
  quickAmountButtons: document.getElementById('quickAmountButtons'),
  payoffButton: document.getElementById('payoffButton'),
  platformRemainingLabel: document.getElementById('platformRemainingLabel'),
  platformRemainingMeta: document.getElementById('platformRemainingMeta'),
  debtForm: document.getElementById('debtForm'),
  debtEditId: document.getElementById('debtEditId'),
  debtPlatform: document.getElementById('debtPlatform'),
  debtInitialDebt: document.getElementById('debtInitialDebt'),
  debtInstallment: document.getElementById('debtInstallment'),
  debtDueDate: document.getElementById('debtDueDate'),
  debtPriority: document.getElementById('debtPriority'),
  debtFormTitle: document.getElementById('debtFormTitle'),
  debtFormDesc: document.getElementById('debtFormDesc'),
  debtSubmitBtn: document.getElementById('debtSubmitBtn'),
  debtCancelBtn: document.getElementById('debtCancelBtn'),
  debtTableBody: document.getElementById('debtTableBody'),
  historySearch: document.getElementById('historySearch'),
  historyPlatformFilter: document.getElementById('historyPlatformFilter'),
  historySortFilter: document.getElementById('historySortFilter'),
  historyTableBody: document.getElementById('historyTableBody'),
  settingsForm: document.getElementById('settingsForm'),
  settingsUsername: document.getElementById('settingsUsername'),
  settingsPassword: document.getElementById('settingsPassword'),
  settingsMonthlyTarget: document.getElementById('settingsMonthlyTarget'),
  settingsTargetDate: document.getElementById('settingsTargetDate'),
  setDebtForm: document.getElementById('setDebtForm'),
  resetDataButton: document.getElementById('resetDataButton'),
  paymentModal: document.getElementById('paymentModal'),
  editPaymentForm: document.getElementById('editPaymentForm'),
  editPaymentId: document.getElementById('editPaymentId'),
  editPaymentPlatform: document.getElementById('editPaymentPlatform'),
  editPaymentAmount: document.getElementById('editPaymentAmount'),
  editPaymentDate: document.getElementById('editPaymentDate'),
  editPaymentNotes: document.getElementById('editPaymentNotes'),
  toastZone: document.getElementById('toastZone'),
  insightsContainer: document.getElementById('insightsContainer'),
  uploadForm: document.getElementById('uploadForm'),
  uploadImage: document.getElementById('uploadImage'),
  uploadNominal: document.getElementById('uploadNominal'),
  imagePreview: document.getElementById('imagePreview'),
  uploadHistoryBody: document.getElementById('uploadHistoryBody'),
  transaksiContainer: document.getElementById('transaksiContainer'),
};

// ========== RENDER: ROLE-BASED UI ==========
function renderRoleBasedUI() {
  const user = getCurrentUser();
  if (!user) return;

  const isAdminUser = user.role === 'admin';

  // Update navbar
  els.sidebarUsername.textContent = user.name;

  // Update sidebar navigation based on role
  // For non-admin users: hide Transaksi panel
  const transaksiLink = Array.from(els.navLinks).find(link => link.dataset.panel === 'transaksi');
  if (transaksiLink) {
    transaksiLink.classList.toggle('hidden', !isAdminUser);
  }

  // Update visible panels
  if (!isAdminUser && activePanel === 'transaksi') {
    switchPanel('dashboard');
  }
}

// ========== RENDER: LOGIN & SIDEBAR ==========
function renderLoginHint() {
  els.loginHint.textContent = `Silahkan login untuk melanjutkan.`;
  els.loginUsername.value = '';
  els.loginPassword.value = '';
}

function renderSidebarMeta() {
  const user = getCurrentUser();
  if (user) {
    els.sidebarUsername.textContent = user.name;
    const roleText = user.role === 'admin' ? ' (Admin)' : '';
    els.sidebarUserMeta.textContent = `${user.username}${roleText}`;
  }
}

function renderTopbarMeta() {
  els.topbarMonthlyTarget.textContent = Format.money(state.settings.monthlyTarget);
  els.topbarDebtFreeTarget.textContent = Format.date(state.settings.targetDate);
}

// ========== RENDER: DASHBOARD CARDS & CHARTS ==========
function renderSummaryCards(totals) {
  const cards = [
    { title: 'Total debt', value: Format.money(totals.totalDebt), foot: `${PLATFORM_ORDER.length} platform aktif`, icon: 'TD', tone: 'primary' },
    { title: 'Paid amount', value: Format.money(totals.totalPaid), foot: `${Format.percent(totals.repaymentRatio)} terselesaikan`, icon: 'PD', tone: 'secondary' },
    { title: 'Remaining debt', value: Format.money(totals.totalRemaining), foot: `${totals.dueSoon} platform jatuh tempo dekat`, icon: 'RD', tone: 'accent' },
    { title: 'Overdue items', value: String(totals.overdue), foot: `${state.payments.length} transaksi tercatat`, icon: 'OD', tone: 'info' },
  ];

  els.summaryCards.innerHTML = cards.map((card) => `
    <article class="card metric-card">
      <div class="metric-icon ${card.tone}">${card.icon}</div>
      <h3>${card.title}</h3>
      <strong>${card.value}</strong>
      <p class="metric-foot">${card.foot}</p>
    </article>
  `).join('');
}

function renderDashboardCharts(totals, summaries) {
  els.heroTotalDebt.textContent = Format.money(totals.totalDebt);
  els.heroSubtitle.textContent = `Total sudah dibayar ${Format.money(totals.totalPaid)} dan sisa utang ${Format.money(totals.totalRemaining)}. Fokus utama adalah menjaga ritme pembayaran menuju target ${Format.money(state.settings.monthlyTarget)} per bulan.`;
  els.heroProgressLabel.textContent = Format.percent(totals.repaymentRatio);
  els.heroProgressFill.style.width = `${Utils.clamp(totals.repaymentRatio * 100, 0, 100)}%`;

  els.donutChart.innerHTML = buildDonutChart(totals.totalPaid, totals.totalRemaining);
  els.lineChart.innerHTML = buildLineChart(Calc.buildMonthlySeries(state.payments));
  els.barChart.innerHTML = buildBarChart(summaries);
}

function renderInsights() {
  const insights = Calc.generateInsights();
  if (!insights.length) {
    els.insightsContainer.innerHTML = '';
    return;
  }

  els.insightsContainer.innerHTML = `
    <div class="insights-grid">
      ${insights.map((insight) => `
        <div class="card insight-card insight-${insight.type}">
          <div class="insight-icon">${insight.icon}</div>
          <div class="insight-content">
            <strong>${insight.title}</strong>
            <p>${insight.message}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ========== CHART BUILDERS ==========
function buildDonutChart(paid, remaining) {
  const total = paid + remaining || 1;
  const paidRatio = paid / total;
  const size = 240;
  const stroke = 20;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - paidRatio);
  return `
    <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Donut chart pembayaran">
      <defs>
        <linearGradient id="donutPaid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f7b6c" />
          <stop offset="100%" stop-color="#1f4e79" />
        </linearGradient>
        <linearGradient id="donutRemaining" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d9a441" />
          <stop offset="100%" stop-color="#f0c55b" />
        </linearGradient>
      </defs>
      <circle cx="130" cy="130" r="${radius}" fill="none" stroke="#e7edf3" stroke-width="${stroke}" />
      <circle cx="130" cy="130" r="${radius}" fill="none" stroke="url(#donutPaid)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 130 130)" />
      <circle cx="130" cy="130" r="${radius - 28}" fill="#fff" opacity="0.9" />
      <text x="130" y="116" text-anchor="middle" class="chart-big">${Format.percent(paid / total)}</text>
      <text x="130" y="138" text-anchor="middle" class="chart-small">paid</text>
      <text x="130" y="156" text-anchor="middle" class="chart-muted">${Format.money(paid)}</text>
      <g transform="translate(44 204)">
        <rect width="14" height="14" rx="4" fill="url(#donutPaid)"></rect>
        <text x="22" y="12" class="legend-text">Paid ${Format.money(paid)}</text>
      </g>
      <g transform="translate(150 204)">
        <rect width="14" height="14" rx="4" fill="url(#donutRemaining)"></rect>
        <text x="22" y="12" class="legend-text">Remaining ${Format.money(remaining)}</text>
      </g>
    </svg>
  `;
}

function buildLineChart(series) {
  if (!series.length) {
    return emptyChart('Belum ada riwayat pembayaran');
  }

  const width = 720;
  const height = 240;
  const padding = { top: 20, right: 24, bottom: 44, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...series.map((point) => point.value), 1);
  const stepX = series.length > 1 ? plotWidth / (series.length - 1) : 0;
  const points = series.map((point, index) => {
    const x = padding.left + (stepX * index);
    const y = padding.top + plotHeight - ((point.value / maxValue) * plotHeight);
    return { ...point, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const fillPath = `${linePath} L ${padding.left + plotWidth} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;
  const labels = points.map((point) => `
    <text x="${point.x}" y="${height - 14}" text-anchor="middle" class="chart-axis">${point.label}</text>
  `).join('');
  const ticks = Array.from({ length: 4 }, (_, index) => {
    const y = padding.top + (plotHeight / 3) * index;
    const value = maxValue - ((maxValue / 3) * index);
    return `
      <g>
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid"></line>
        <text x="10" y="${y + 4}" class="chart-axis">${Format.money(value)}</text>
      </g>
    `;
  }).join('');
  const dots = points.map((point) => `
    <g>
      <circle cx="${point.x}" cy="${point.y}" r="5.5" fill="#fff" stroke="#0f7b6c" stroke-width="3"></circle>
      <text x="${point.x}" y="${point.y - 12}" text-anchor="middle" class="chart-point">${Format.money(point.value)}</text>
    </g>
  `).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart pembayaran bulanan">
      ${ticks}
      <path d="${fillPath}" fill="rgba(15, 123, 108, 0.10)"></path>
      <path d="${linePath}" fill="none" stroke="url(#lineGradient)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f7b6c"></stop>
          <stop offset="100%" stop-color="#1f4e79"></stop>
        </linearGradient>
      </defs>
      ${dots}
      ${labels}
    </svg>
  `;
}

function buildBarChart(summaries) {
  const width = 720;
  const barHeight = 38;
  const gap = 16;
  const padding = { top: 20, right: 28, bottom: 16, left: 160 };
  const height = padding.top + padding.bottom + summaries.length * (barHeight + gap) - gap;
  const maxValue = Math.max(...summaries.map((item) => item.remaining), 1);
  const bars = summaries.map((item, index) => {
    const y = padding.top + index * (barHeight + gap);
    const barWidth = ((width - padding.left - padding.right) * item.remaining) / maxValue;
    const label = item.platform;
    const remainingLabel = Format.money(item.remaining);
    const percentLabel = `${Math.round((item.remaining / item.initialDebt) * 100)}% sisa`;
    return `
      <g transform="translate(0 ${y})">
        <text x="0" y="24" class="chart-platform">${label}</text>
        <rect x="${padding.left}" y="0" width="${width - padding.left - padding.right}" height="${barHeight}" rx="16" fill="rgba(20, 32, 45, 0.06)"></rect>
        <rect x="${padding.left}" y="0" width="${barWidth}" height="${barHeight}" rx="16" fill="url(#barGradient)"></rect>
        <text x="${padding.left + barWidth + 12}" y="24" class="chart-bar-label">${remainingLabel} · ${percentLabel}</text>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart sisa utang per platform">
      <defs>
        <linearGradient id="barGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f7b6c"></stop>
          <stop offset="100%" stop-color="#d9a441"></stop>
        </linearGradient>
      </defs>
      ${bars}
    </svg>
  `;
}

function emptyChart(message) {
  return `<div class="empty-chart">${message}</div>`;
}

// ========== RENDER: UPLOAD PANEL ==========
function renderUploadHistory() {
  const uploads = state.uploads.filter(u => u.userId === getCurrentUser().id);
  els.uploadHistoryBody.innerHTML = uploads.map(upload => `
    <tr>
      <td>${Format.date(upload.uploadedAt.split('T')[0])}</td>
      <td><img src="${upload.imageThumbnail}" alt="bukti" style="max-width:60px;height:auto;border-radius:4px;"></td>
      <td>${Format.money(upload.nominal)}</td>
      <td><span class="status-badge ${upload.status === 'pending' ? 'status-soon' : 'status-paid'}">${upload.status === 'pending' ? 'Menunggu' : 'Disetujui'}</span></td>
      <td>
        <button type="button" data-action="delete-upload" data-id="${upload.id}" ${upload.status === 'approved' ? 'disabled' : ''}>Hapus</button>
      </td>
    </tr>
  `).join('') || `
    <tr>
      <td colspan="5">Belum ada upload bukti pembayaran.</td>
    </tr>
  `;
}

// ========== RENDER: TRANSAKSI PANEL (ADMIN ONLY) ==========
function renderTransaksiPanel() {
  if (!isAdmin()) {
    els.transaksiContainer.innerHTML = '<div class="card"><p style="color: var(--danger);">Akses ditolak. Panel ini hanya untuk admin.</p></div>';
    return;
  }

  const pendingUploads = state.uploads.filter(u => u.status === 'pending');

  if (pendingUploads.length === 0) {
    els.transaksiContainer.innerHTML = '<div class="card"><p>Tidak ada upload yang menunggu approval.</p></div>';
    return;
  }

  els.transaksiContainer.innerHTML = `
    <div class="transaksi-grid">
      ${pendingUploads.map(upload => `
        <div class="card transaksi-card">
          <div class="transaksi-image">
            <img src="${upload.imageThumbnail}" alt="bukti" style="max-width:100%;height:auto;border-radius:8px;">
          </div>
          <div class="transaksi-info">
            <p class="transaksi-user"><strong>User:</strong> ${upload.username}</p>
            <p class="transaksi-nominal"><strong>Nominal:</strong> ${Format.money(upload.nominal)}</p>
            <p class="transaksi-date"><strong>Tanggal:</strong> ${Format.date(upload.uploadedAt.split('T')[0])}</p>
          </div>
          <form class="transaksi-form" data-upload-id="${upload.id}">
            <label>
              <span>Platform</span>
              <select class="platform-select" required>
                <option value="">Pilih platform</option>
                <option value="Bank Jago">Bank Jago</option>
                <option value="Blu by BCA">Blu by BCA</option>
                <option value="SPay">SPay</option>
                <option value="GoPay">GoPay</option>
                <option value="SeaBank">SeaBank</option>
                <option value="Arsanta">Arsanta</option>
              </select>
            </label>
            <label>
              <span>Keterangan</span>
              <textarea class="keterangan-text" rows="3" placeholder="Catatan transaksi..."></textarea>
            </label>
            <div class="action-row">
              <button class="primary-btn" type="submit">Approve & Simpan</button>
            </div>
          </form>
        </div>
      `).join('')}
    </div>
  `;
}

// ========== RENDER: LAPORAN PANEL ==========
function renderLaporanPanel() {
  const laporanData = state.laporan.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  const isAdminUser = isAdmin();
  const container = document.getElementById('laporanContent');

  if (!container) return;

  if (laporanData.length === 0) {
    container.innerHTML = '<div class="card"><p style="text-align:center;color:#999;padding:20px;">Belum ada laporan pembayaran.</p></div>';
    return;
  }

  container.innerHTML = laporanData.map(item => `
    <div class="laporan-card card">
      <div class="laporan-card-header">
        <div class="laporan-info">
          <div class="laporan-date">${Format.date(item.tanggal)}</div>
          <div class="laporan-platform"><strong>${item.platform}</strong></div>
          <div class="laporan-nominal">${Format.money(item.nominal)}</div>
        </div>
      </div>

      <div class="laporan-card-body">
        <div class="laporan-image-section">
          <img src="${item.nota}" alt="Bukti pembayaran" class="laporan-image" onclick="showImageModal('${item.nota}')">
        </div>

        <div class="laporan-details">
          <div class="detail-item">
            <span class="detail-label">Tanggal</span>
            <span class="detail-value">${Format.date(item.tanggal)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Platform</span>
            <span class="detail-value">${item.platform}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Nominal</span>
            <span class="detail-value"><strong>${Format.money(item.nominal)}</strong></span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Keterangan</span>
            <div class="keterangan-section">
              ${isAdminUser ? `
                <input type="text" value="${item.keterangan}" class="keterangan-edit" data-id="${item.id}" placeholder="Tambahkan keterangan...">
                <button type="button" data-action="save-keterangan" data-id="${item.id}" class="primary-btn" style="font-size:0.85rem;padding:6px 12px;margin-top:6px;">Simpan</button>
              ` : `<span class="detail-value">${item.keterangan || '-'}</span>`}
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ========== RENDER: PAYMENT PANEL ==========
function renderPlatformSelectors() {
  const options = PLATFORM_ORDER.map((platform) => `<option value="${platform}">${platform}</option>`).join('');
  els.paymentPlatform.innerHTML = options;
  els.editPaymentPlatform.innerHTML = options;
  els.historyPlatformFilter.innerHTML = `<option value="all">All platforms</option>${options}`;
}

function renderQuickAmountButtons() {
  els.quickAmountButtons.innerHTML = QUICK_AMOUNTS.map((amount) => `
    <button type="button" data-amount="${amount}">${Format.money(amount)}</button>
  `).join('');
}

function renderSelectedPlatformSummary() {
  const summaries = Calc.platformSummaries();
  const platform = els.paymentPlatform.value || summaries[0]?.platform;
  const selected = summaries.find((item) => item.platform === platform) || summaries[0];
  if (!selected) return;

  els.selectedPlatformStatus.textContent = `${selected.platform} · ${selected.status}`;
  els.platformRemainingLabel.textContent = Format.money(selected.remaining);
  els.platformRemainingMeta.textContent = `${Format.money(selected.paid)} sudah dibayar dari ${Format.money(selected.initialDebt)} total.`;
  els.payoffButton.textContent = selected.remaining > 0 ? `Pay-off ${selected.platform}` : 'Platform sudah lunas';
  els.payoffButton.disabled = selected.remaining <= 0;
}

// ========== RENDER: DEBT DETAILS PANEL ==========
function renderDebtTable() {
  const summaries = Calc.platformSummaries();
  const isAdminUser = isAdmin();

  els.debtTableBody.innerHTML = summaries.map((debt) => {
    const actionsCell = isAdminUser ? `
      <td>
        <div class="table-actions">
          <button type="button" data-action="edit-debt" data-platform="${debt.platform}" title="Edit utang">Edit</button>
          <button type="button" data-action="delete-debt" data-platform="${debt.platform}" title="Hapus utang">Delete</button>
        </div>
      </td>
    ` : '<td>-</td>';

    return `
    <tr>
      <td><strong>${debt.platform}</strong></td>
      <td>${Format.money(debt.initialDebt)}</td>
      <td>${Format.money(debt.paid)}</td>
      <td>${Format.money(debt.remaining)}</td>
      <td><span class="status-badge ${statusClass(debt)}">${debt.status}</span></td>
      <td>${debt.priority}</td>
      <td>${Format.date(debt.dueDate)}</td>
      <td>
        <div class="progress-mini">
          <strong>${Format.percent(debt.completion)}</strong>
          <div class="progress-mini-track"><div class="progress-mini-fill" style="width:${Utils.clamp(debt.completion * 100, 0, 100)}%"></div></div>
        </div>
      </td>
      ${actionsCell}
    </tr>
  `;
  }).join('');
}

function statusClass(debt) {
  if (debt.status === 'Lunas') return 'status-paid';
  if (debt.status === 'Terlambat') return 'status-overdue';
  if (debt.status === 'Jatuh tempo') return 'status-soon';
  return 'status-active';
}

// ========== RENDER: PAYMENT HISTORY PANEL ==========
function renderHistoryTable() {
  const rows = applyHistoryFilters();
  els.historyTableBody.innerHTML = rows.map((payment) => `
    <tr>
      <td>${Format.date(payment.date)}</td>
      <td><strong>${payment.platform}</strong></td>
      <td>${Format.money(payment.amount)}</td>
      <td>${payment.notes ? payment.notes : '<span class="muted-cell">-</span>'}</td>
      <td>
        <div class="table-actions">
          <button type="button" data-action="edit" data-id="${payment.id}" title="Edit pembayaran">Edit</button>
          <button type="button" data-action="delete" data-id="${payment.id}" title="Hapus pembayaran">Delete</button>
        </div>
      </td>
    </tr>
  `).join('') || `
    <tr>
      <td colspan="5">Tidak ada transaksi yang cocok dengan filter saat ini.</td>
    </tr>
  `;
}

function applyHistoryFilters() {
  const search = historyFilters.search.trim().toLowerCase();
  let rows = [...state.payments].filter((payment) => {
    const matchesSearch = !search || [payment.platform, payment.notes || '', payment.date].some((field) => field.toLowerCase().includes(search));
    const matchesPlatform = historyFilters.platform === 'all' || payment.platform === historyFilters.platform;
    return matchesSearch && matchesPlatform;
  });

  rows.sort((left, right) => {
    if (historyFilters.sort === 'oldest') return left.date.localeCompare(right.date);
    if (historyFilters.sort === 'amount-desc') return Number(right.amount) - Number(left.amount);
    if (historyFilters.sort === 'amount-asc') return Number(left.amount) - Number(right.amount);
    return right.date.localeCompare(left.date);
  });

  return rows;
}

// ========== RENDER: SETTINGS PANEL ==========
function renderSettingsForm() {
  els.settingsUsername.value = state.auth.username;
  els.settingsPassword.value = state.auth.password;
  els.settingsMonthlyTarget.value = state.settings.monthlyTarget;
  els.settingsTargetDate.value = state.settings.targetDate;
}

function renderDateDefaults() {
  const today = new Date();
  const local = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateValue = local.toISOString().slice(0, 10);
  els.paymentDate.value = dateValue;
  els.editPaymentDate.value = dateValue;
}

function renderDebtFormVisibility() {
  const debtFormContainer = document.getElementById('debtFormContainer');
  if (!debtFormContainer) return;

  const isAdminUser = isAdmin();
  if (isAdminUser) {
    debtFormContainer.classList.remove('hidden');
  } else {
    debtFormContainer.classList.add('hidden');
  }
}

// ========== RENDER: COMPREHENSIVE ==========
function renderAll() {
  const summaries = Calc.platformSummaries();
  const totals = Calc.aggregateTotals();

  renderLoginHint();
  renderSidebarMeta();
  renderTopbarMeta();
  renderSummaryCards(totals);
  renderDashboardCharts(totals, summaries);
  renderInsights();
  renderPlatformSelectors();
  renderQuickAmountButtons();
  renderSelectedPlatformSummary();
  renderDebtFormVisibility();
  renderDebtTable();
  renderHistoryTable();
  renderSettingsForm();
  renderSetDebtForm();

  // New panels
  renderUploadHistory();
  renderTransaksiPanel();
  renderLaporanPanel();

  bindPlatformSummaryChange();
}

function bindPlatformSummaryChange() {
  const summaries = Calc.platformSummaries();
  const platform = els.paymentPlatform.value || summaries[0]?.platform;
  const selected = summaries.find((item) => item.platform === platform) || summaries[0];
  if (selected) {
    els.paymentPlatform.value = selected.platform;
  }
  renderSelectedPlatformSummary();
}

// ========== NAVIGATION & UI STATE ==========
function switchPanel(panelName) {
  activePanel = panelName;
  els.panels.forEach((panel) => panel.classList.toggle('active', panel.id === `${panelName}Panel`));
  els.navLinks.forEach((link) => link.classList.toggle('active', link.dataset.panel === panelName));
  closeSidebar();
  renderSelectedPlatformSummary();
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

function showApp() {
  els.loginView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  renderAll();
  switchPanel(activePanel);
}

function showLogin() {
  els.appView.classList.add('hidden');
  els.loginView.classList.remove('hidden');
  renderLoginHint();
}

// ========== NOTIFICATIONS ==========
function showToast(title, message, tone = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  els.toastZone.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ========== FORM: PAYMENT UPDATE ==========
function resetUpdateForm() {
  editPaymentId = null;
  els.paymentId.value = '';
  els.paymentFormTitle.textContent = 'Tambah pembayaran';
  els.paymentSubmitButton.textContent = 'Simpan pembayaran';
  els.cancelEditButton.classList.add('hidden');
  renderDateDefaults();
  renderSelectedPlatformSummary();
}

function handlePaymentSubmit(event) {
  event.preventDefault();
  const payload = {
    platform: els.paymentPlatform.value,
    amount: Number(els.paymentAmount.value),
    date: els.paymentDate.value,
    notes: els.paymentNotes.value.trim(),
  };

  if (!payload.platform || !payload.amount || !payload.date) {
    showToast('Input belum lengkap', 'Pastikan semua field wajib terisi.', 'danger');
    return;
  }

  if (payload.amount <= 0) {
    showToast('Nominal tidak valid', 'Nominal pembayaran harus lebih dari 0.', 'danger');
    return;
  }

  if (editPaymentId) {
    state.payments = state.payments.map((payment) => (
      payment.id === editPaymentId
        ? { ...payment, ...payload, amount: Math.round(payload.amount) }
        : payment
    ));
    showToast('Transaksi diperbarui', 'Perubahan pembayaran berhasil disimpan.', 'success');
  } else {
    state.payments.unshift({ id: Utils.uniqueId('payment'), ...payload, amount: Math.round(payload.amount) });
    showToast('Pembayaran tersimpan', `${payload.platform} berhasil ditambahkan.`, 'success');
  }

  state.payments.sort((left, right) => right.date.localeCompare(left.date));
  saveState();
  renderAll();
  resetUpdateForm();
}

// ========== FORM: SETTINGS ==========
function handleSettingsSubmit(event) {
  event.preventDefault();
  state.auth.username = els.settingsUsername.value.trim() || state.auth.username;
  state.auth.password = els.settingsPassword.value || state.auth.password;
  state.settings.monthlyTarget = Math.max(0, Number(els.settingsMonthlyTarget.value) || 0);
  state.settings.targetDate = els.settingsTargetDate.value;
  saveState();
  setAuthenticated(false);
  showLogin();
  showToast('Setting diperbarui', 'Silakan login kembali dengan kredensial baru.', 'success');
}

// ========== PAYMENT: HISTORY ACTIONS ==========
function deletePayment(paymentId) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) return;
  if (!window.confirm(`Hapus transaksi ${payment.platform} sebesar ${Format.money(payment.amount)}?`)) return;

  state.payments = state.payments.filter((item) => item.id !== paymentId);
  saveState();
  renderAll();
  showToast('Transaksi dihapus', 'Riwayat pembayaran berhasil diperbarui.', 'success');
}

function handleHistoryAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const paymentId = button.dataset.id;
  const action = button.dataset.action;
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) return;

  if (action === 'edit') {
    openPaymentModal(payment);
    return;
  }
  if (action === 'delete') {
    deletePayment(paymentId);
  }
}

// ========== MODAL: PAYMENT EDIT ==========
function openPaymentModal(payment) {
  editPaymentId = payment.id;
  els.editPaymentId.value = payment.id;
  els.editPaymentPlatform.value = payment.platform;
  els.editPaymentAmount.value = payment.amount;
  els.editPaymentDate.value = payment.date;
  els.editPaymentNotes.value = payment.notes || '';
  els.paymentModal.classList.remove('hidden');
  els.paymentModal.setAttribute('aria-hidden', 'false');
}

function closePaymentModal() {
  els.paymentModal.classList.add('hidden');
  els.paymentModal.setAttribute('aria-hidden', 'true');
}

function handleEditPaymentSubmit(event) {
  event.preventDefault();
  const paymentId = els.editPaymentId.value;
  const payload = {
    platform: els.editPaymentPlatform.value,
    amount: Number(els.editPaymentAmount.value),
    date: els.editPaymentDate.value,
    notes: els.editPaymentNotes.value.trim(),
  };

  state.payments = state.payments.map((payment) => (
    payment.id === paymentId
      ? { ...payment, ...payload, amount: Math.round(payload.amount) }
      : payment
  ));

  state.payments.sort((left, right) => right.date.localeCompare(left.date));
  saveState();
  renderAll();
  closePaymentModal();
  showToast('Transaksi diperbarui', 'Perubahan pada payment history tersimpan.', 'success');
}

function handleModalClick(event) {
  if (event.target.matches('[data-close-modal]') || event.target === els.paymentModal.querySelector('.modal-backdrop')) {
    closePaymentModal();
  }
}

// ========== FORM: DEBT MANAGEMENT ==========
function handleDebtSubmit(event) {
  event.preventDefault();
  const platform = els.debtPlatform.value.trim();
  const initialDebt = Math.max(0, Number(els.debtInitialDebt.value) || 0);
  const installment = Math.max(0, Number(els.debtInstallment.value) || 0);
  const dueDate = els.debtDueDate.value;
  const priority = Math.max(1, Number(els.debtPriority.value) || 1);
  const editId = els.debtEditId.value;

  if (!platform || !initialDebt || !dueDate) {
    showToast('Data tidak lengkap', 'Platform, tagihan awal, dan tenggat wajib diisi.', 'danger');
    return;
  }

  if (editId) {
    // Edit existing debt
    const debtIndex = state.debts.findIndex(d => d.platform === editId);
    if (debtIndex >= 0) {
      state.debts[debtIndex] = { platform, initialDebt, installment, dueDate, priority };
    }
    showToast('Utang diperbarui', `${platform} berhasil diubah.`, 'success');
  } else {
    // Check if platform already exists
    if (state.debts.some(d => d.platform === platform)) {
      showToast('Platform sudah ada', 'Gunakan form di atas untuk mengubah data yang sudah ada.', 'warning');
      return;
    }
    // Add new debt
    state.debts.push({ platform, initialDebt, installment, dueDate, priority });
    showToast('Utang ditambahkan', `${platform} berhasil ditambahkan.`, 'success');
  }

  saveState();
  renderAll();
  resetDebtForm();
}

function resetDebtForm() {
  els.debtEditId.value = '';
  els.debtPlatform.value = '';
  els.debtInitialDebt.value = '';
  els.debtInstallment.value = '';
  els.debtDueDate.value = '';
  els.debtPriority.value = '1';
  els.debtFormTitle.textContent = 'Tambah utang baru';
  els.debtFormDesc.textContent = 'Masukkan detail utang dengan platform, nominal tagihan, dan tenggat waktu.';
  els.debtSubmitBtn.textContent = 'Tambah utang';
  els.debtCancelBtn.classList.add('hidden');
}

function handleDebtTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const platform = button.dataset.platform;
  const action = button.dataset.action;

  if (action === 'edit-debt') {
    const debt = state.debts.find(d => d.platform === platform);
    if (!debt) return;

    els.debtEditId.value = platform;
    els.debtPlatform.value = debt.platform;
    els.debtInitialDebt.value = debt.initialDebt;
    els.debtInstallment.value = debt.installment || '';
    els.debtDueDate.value = debt.dueDate;
    els.debtPriority.value = debt.priority;
    els.debtFormTitle.textContent = 'Edit utang';
    els.debtFormDesc.textContent = `Mengubah data utang ${platform}.`;
    els.debtSubmitBtn.textContent = 'Simpan perubahan';
    els.debtCancelBtn.classList.remove('hidden');

    // Scroll ke form
    els.debtForm.scrollIntoView({ behavior: 'smooth' });
  } else if (action === 'delete-debt') {
    if (!window.confirm(`Hapus utang untuk ${platform}? Riwayat pembayaran tidak akan dihapus.`)) return;
    state.debts = state.debts.filter(d => d.platform !== platform);
    saveState();
    renderAll();
    showToast('Utang dihapus', `${platform} berhasil dihapus.`, 'success');
  }
}

// ========== QUICK ACTIONS ==========
function handleQuickAmountClick(event) {
  const button = event.target.closest('button[data-amount]');
  if (!button) return;
  els.paymentAmount.value = button.dataset.amount;
}

function handlePayoff() {
  const summaries = Calc.platformSummaries();
  const selected = summaries.find((item) => item.platform === els.paymentPlatform.value) || summaries[0];
  if (!selected || selected.remaining <= 0) {
    showToast('Platform lunas', 'Tidak ada sisa yang perlu dibayar.', 'success');
    return;
  }
  els.paymentAmount.value = selected.remaining;
  els.paymentNotes.value = `Pay-off penuh untuk ${selected.platform}`;
}

function handlePlatformChange() {
  renderSelectedPlatformSummary();
}

function handleHistoryFilterChange() {
  historyFilters = {
    search: els.historySearch.value,
    platform: els.historyPlatformFilter.value,
    sort: els.historySortFilter.value,
  };
  renderHistoryTable();
}

// ========== AUTHENTICATION & LOGOUT ==========
function handleLogin(event) {
  event.preventDefault();
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;

  const user = validateLogin(username, password);
  if (user) {
    setAuthenticated(true, user);
    showApp();
    showToast('Login berhasil', `Selamat datang, ${user.name}!`, 'success');
    renderRoleBasedUI();
    return;
  }
  showToast('Login gagal', 'Username atau password tidak sesuai.', 'danger');
}

function handleLogout() {
  setAuthenticated(false);
  showLogin();
  showToast('Logout berhasil', 'Sesi login telah ditutup.', 'success');
}

// ========== DATA RESET ==========
// ========== FORM: SET DEBT ==========
function renderSetDebtForm() {
  const container = document.getElementById('debtInputs');
  if (!container) return;

  const platforms = ['Bank Jago', 'Blu by BCA', 'SPay', 'GoPay', 'SeaBank', 'Arsanta'];
  const debtMap = new Map(state.debts.map(d => [d.platform, d]));

  container.innerHTML = platforms.map(platform => {
    const debt = debtMap.get(platform);
    const amount = debt?.initialDebt || 0;
    const dueDate = debt?.dueDate || '';
    return `
    <label>
      <span>${platform}</span>
      <div style="display: grid; grid-template-columns: 1fr 100px; gap: 8px;">
        <input type="number" class="debt-input" data-platform="${platform}" min="0" step="100000" value="${amount}" placeholder="Rp0">
        <input type="date" class="debt-date" data-platform="${platform}" value="${dueDate}">
      </div>
    </label>
  `;
  }).join('');
}

function handleSetDebtSubmit(event) {
  event.preventDefault();
  const debts = [];
  const platforms = ['Bank Jago', 'Blu by BCA', 'SPay', 'GoPay', 'SeaBank', 'Arsanta'];

  platforms.forEach((platform, index) => {
    const input = document.querySelector(`.debt-input[data-platform="${platform}"]`);
    const dateInput = document.querySelector(`.debt-date[data-platform="${platform}"]`);
    const amount = Math.max(0, Number(input?.value) || 0);
    const dueDate = dateInput?.value || '';

    if (amount > 0 && dueDate) {
      debts.push({
        platform,
        initialDebt: amount,
        dueDate,
        priority: index + 1,
      });
    }
  });

  if (debts.length === 0) {
    showToast('Data tidak lengkap', 'Minimal ada satu utang dengan tanggal jatuh tempo', 'warning');
    return;
  }

  state.debts = debts;
  state.payments = []; // Reset payments juga saat set utang baru
  saveState();
  renderAll();
  showToast('Utang berhasil disimpan', `${debts.length} platform telah ditambahkan.`, 'success');

  // Scroll ke dashboard
  switchPanel('dashboardPanel');
}

function handleResetData() {
  if (!window.confirm('Reset seluruh data ke kondisi awal?')) return;
  const fresh = structuredClone(DEFAULT_STATE);
  state.auth = fresh.auth;
  state.settings = fresh.settings;
  state.debts = fresh.debts;
  state.payments = fresh.payments;
  saveState();
  setAuthenticated(false);
  renderLoginHint();
  renderAll();
  showLogin();
  showToast('Data di-reset', 'Dashboard kembali ke kondisi awal kosong.', 'success');
}

// ========== UPLOAD & TRANSAKSI HANDLERS ==========
function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file
  if (!file.type.startsWith('image/')) {
    showToast('Format tidak valid', 'Pilih file gambar (jpg, png, dll)', 'danger');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('File terlalu besar', 'Maksimal 5MB', 'danger');
    return;
  }

  // Preview image
  const reader = new FileReader();
  reader.onload = (e) => {
    els.imagePreview.innerHTML = `<img src="${e.target.result}" alt="preview" style="max-width:200px;height:auto;border-radius:8px;">`;
    els.imagePreview.classList.remove('hidden');
    // Store temporarily
    els.uploadForm.dataset.imageData = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleUploadSubmit(event) {
  event.preventDefault();

  const nominal = Number(els.uploadNominal.value);
  const imageData = els.uploadForm.dataset.imageData;
  const user = getCurrentUser();

  if (!nominal || nominal <= 0) {
    showToast('Nominal tidak valid', 'Masukkan nominal yang lebih besar dari 0', 'danger');
    return;
  }

  if (!imageData) {
    showToast('Gambar tidak ada', 'Pilih gambar bukti pembayaran', 'danger');
    return;
  }

  const upload = {
    id: Utils.uniqueId('upload'),
    userId: user.id,
    username: user.name,
    imageThumbnail: imageData, // In production, compress here
    nominal: Math.round(nominal),
    status: 'pending',
    uploadedAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null
  };

  state.uploads.push(upload);
  saveState();

  // Reset form
  els.uploadForm.reset();
  els.imagePreview.classList.add('hidden');
  els.uploadForm.removeAttribute('data-imageData');
  renderUploadHistory();

  showToast('Upload berhasil', 'Bukti pembayaran telah diunggah. Menunggu persetujuan admin.', 'success');
}

function handleTransaksiSubmit(event) {
  event.preventDefault();
  if (!event.target.closest('.transaksi-form')) return;

  const form = event.target.closest('.transaksi-form');
  const uploadId = form.dataset.uploadId;
  const platform = form.querySelector('.platform-select').value;
  const keterangan = form.querySelector('.keterangan-text').value.trim();

  if (!platform) {
    showToast('Platform belum dipilih', 'Pilih platform pembayaran', 'danger');
    return;
  }

  // Find upload
  const uploadIndex = state.uploads.findIndex(u => u.id === uploadId);
  if (uploadIndex === -1) return;

  // Mark upload as approved
  state.uploads[uploadIndex].status = 'approved';
  state.uploads[uploadIndex].approvedBy = getCurrentUser().name;
  state.uploads[uploadIndex].approvedAt = new Date().toISOString();

  // Create transaksi
  const transaksi = {
    id: Utils.uniqueId('txn'),
    uploadId: uploadId,
    platform: platform,
    keterangan: keterangan,
    status: 'approved',
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: getCurrentUser().name
  };

  // Create laporan
  const laporan = {
    id: Utils.uniqueId('lap'),
    tanggal: new Date().toISOString().split('T')[0],
    platform: platform,
    nota: state.uploads[uploadIndex].imageThumbnail,
    nominal: state.uploads[uploadIndex].nominal,
    keterangan: keterangan
  };

  state.transaksi.push(transaksi);
  state.laporan.push(laporan);
  saveState();

  renderTransaksiPanel();
  renderLaporanPanel();
  renderUploadHistory();

  showToast('Data disimpan', `Transaksi dari ${platform} berhasil ditambahkan ke laporan.`, 'success');
}

function handleDeleteUpload(uploadId) {
  const upload = state.uploads.find(u => u.id === uploadId);
  if (!upload) return;

  if (!confirm(`Hapus upload bukti ${Format.money(upload.nominal)}?`)) return;

  state.uploads = state.uploads.filter(u => u.id !== uploadId);
  saveState();
  renderUploadHistory();
  showToast('Upload dihapus', 'Bukti pembayaran telah dihapus.', 'success');
}

// ========== EVENT ATTACHMENT ==========
function attachEvents() {
  els.loginForm.addEventListener('submit', handleLogin);

  // Upload events
  if (els.uploadImage) els.uploadImage.addEventListener('change', handleImageSelect);
  if (els.uploadForm) els.uploadForm.addEventListener('submit', handleUploadSubmit);
  if (els.uploadHistoryBody) els.uploadHistoryBody.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'delete-upload') {
      handleDeleteUpload(e.target.dataset.id);
    }
  });

  // Transaksi events
  if (els.transaksiContainer) {
    els.transaksiContainer.addEventListener('submit', handleTransaksiSubmit);
  }

  // Laporan events
  document.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'save-keterangan') {
      const id = e.target.dataset.id;
      const keterangan = e.target.closest('.laporan-card').querySelector('.keterangan-edit').value;
      const laporan = state.laporan.find(l => l.id === id);
      if (laporan) {
        laporan.keterangan = keterangan;
        saveState();
        renderLaporanPanel();
        showToast('Keterangan diupdate', 'Laporan berhasil diperbarui.', 'success');
      }
    }
  });

  els.paymentForm.addEventListener('submit', handlePaymentSubmit);
  els.debtForm.addEventListener('submit', handleDebtSubmit);
  els.debtCancelBtn.addEventListener('click', resetDebtForm);
  els.settingsForm.addEventListener('submit', handleSettingsSubmit);
  els.setDebtForm.addEventListener('submit', handleSetDebtSubmit);
  els.editPaymentForm.addEventListener('submit', handleEditPaymentSubmit);
  els.debtTableBody.addEventListener('click', handleDebtTableAction);
  els.resetDataButton.addEventListener('click', handleResetData);
  els.logoutButton.addEventListener('click', handleLogout);
  els.sidebarOpen.addEventListener('click', openSidebar);
  els.sidebarClose.addEventListener('click', closeSidebar);
  els.sidebarOverlay.addEventListener('click', closeSidebar);
  els.navLinks.forEach((link) => link.addEventListener('click', () => switchPanel(link.dataset.panel)));
  els.paymentPlatform.addEventListener('change', handlePlatformChange);
  els.quickAmountButtons.addEventListener('click', handleQuickAmountClick);
  els.payoffButton.addEventListener('click', handlePayoff);
  els.cancelEditButton.addEventListener('click', resetUpdateForm);
  els.historyTableBody.addEventListener('click', handleHistoryAction);
  els.historySearch.addEventListener('input', handleHistoryFilterChange);
  els.historyPlatformFilter.addEventListener('change', handleHistoryFilterChange);
  els.historySortFilter.addEventListener('change', handleHistoryFilterChange);
  els.paymentModal.addEventListener('click', handleModalClick);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSidebar();
      closePaymentModal();
    }
  });
}

// ========== INITIALIZATION ==========
function init() {
  // Restore current user from session
  const storedUser = sessionStorage.getItem('currentUser');
  if (storedUser) {
    state.currentUser = JSON.parse(storedUser);
  }

  attachEvents();
  renderLoginHint();
  renderDateDefaults();
  renderQuickAmountButtons();

  if (isAuthenticated()) {
    showApp();
    renderRoleBasedUI();
  } else {
    showLogin();
  }

  if (!state.payments.length) {
    state.payments = structuredClone(DEFAULT_STATE.payments);
    saveState();
  }
}

init();
