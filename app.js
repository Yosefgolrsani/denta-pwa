let supabase = null;
let currentUser = null;
let activeClinicId = null;
let revenueReportCache = null;
let patientsCache = [];
let dentistsCache = [];
let recoveryMode = false;

const $ = (id) => document.getElementById(id);
const themeBtn = $('themeBtn');
const loginBtn = $('loginBtn');
const emailInput = $('email');
const passwordInput = $('password');
const loginMessage = $('loginMessage');
const loginCard = $('loginCard');
const dashboard = $('dashboard');
const patientForm = $('patientForm');
const appointmentForm = $('appointmentForm');

const logoutBtn = document.createElement('button');
logoutBtn.type = 'button';
logoutBtn.textContent = 'خروج از حساب';
logoutBtn.className = 'icon-btn logout-btn';
logoutBtn.style.display = 'none';
document.querySelector('.topbar').appendChild(logoutBtn);

const forgotBtn = document.createElement('button');
forgotBtn.type = 'button';
forgotBtn.textContent = 'فراموشی رمز عبور';
forgotBtn.style.cssText = 'display:block;margin:15px auto;padding:10px;border:0;background:transparent;color:#087f5b;font-size:15px;cursor:pointer;';
loginBtn.insertAdjacentElement('afterend', forgotBtn);

const resetCard = document.createElement('section');
resetCard.className = 'login card';
resetCard.style.display = 'none';
resetCard.innerHTML = `
  <h2>تعیین رمز عبور جدید</h2>
  <p class="muted">رمز عبور جدید خود را وارد کنید.</p>
  <label for="newPassword">رمز عبور جدید</label>
  <input id="newPassword" type="password" placeholder="حداقل ۸ کاراکتر" autocomplete="new-password">
  <label for="confirmPassword">تکرار رمز عبور</label>
  <input id="confirmPassword" type="password" placeholder="رمز عبور را دوباره وارد کنید" autocomplete="new-password">
  <button id="savePasswordBtn" class="primary" type="button">ثبت رمز جدید</button>
  <p id="resetMessage" class="message" aria-live="polite"></p>`;
loginCard.insertAdjacentElement('afterend', resetCard);

const newPasswordInput = $('newPassword');
const confirmPasswordInput = $('confirmPassword');
const savePasswordBtn = $('savePasswordBtn');
const resetMessage = $('resetMessage');

function showMessage(message, isError = false) {
  loginMessage.textContent = message;
  loginMessage.style.color = isError ? '#dc2626' : '';
}
function setFormMessage(id, message, isError = false) {
  const el = $(id);
  el.textContent = message;
  el.style.color = isError ? '#dc2626' : '';
}
function showDashboard(isLoggedIn) {
  loginCard.style.display = isLoggedIn ? 'none' : '';
  dashboard.style.display = isLoggedIn ? '' : 'none';
  resetCard.style.display = 'none';
  forgotBtn.style.display = isLoggedIn ? 'none' : '';
}
function showRecoveryForm() {
  recoveryMode = true;
  loginCard.style.display = 'none';
  dashboard.style.display = 'none';
  resetCard.style.display = '';
  forgotBtn.style.display = 'none';
  logoutBtn.style.display = 'none';
}
function faNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(value || 0);
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}
function formatDate(value) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium', timeStyle: 'short'
  }).format(new Date(value));
}

async function loadClinicContext() {
  const { data: memberships, error } = await supabase
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_id', currentUser.id);
  if (error) throw error;
  if (!memberships || memberships.length === 0) {
    throw new Error('برای این حساب عضویت کلینیک پیدا نشد. مدیر کلینیک باید دسترسی شما را بررسی کند.');
  }
  if (memberships.length > 1) {
    throw new Error('این حساب به چند کلینیک متصل است؛ انتخاب کلینیک باید جداگانه تنظیم شود.');
  }
  activeClinicId = memberships[0].clinic_id;
  // نام کلینیک صرفاً نمایشی است؛ نبود مجوز خواندن جدول clinics نباید ورود را متوقف کند.
  const { data: clinic } = await supabase
    .from('clinics').select('name').eq('id', activeClinicId).maybeSingle();
  $('clinicLabel').textContent = clinic?.name || 'کلینیک فعال';
}

async function loadPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, created_at')
    .eq('clinic_id', activeClinicId)
    .order('full_name', { ascending: true });
  if (error) throw error;
  patientsCache = data || [];
  $('patientCount').textContent = faNumber(patientsCache.length);
  renderPatients();
  fillPatientOptions();
}
function renderPatients() {
  const term = $('patientSearch').value.trim().toLocaleLowerCase();
  const rows = patientsCache.filter(p =>
    (p.full_name || '').toLocaleLowerCase().includes(term) ||
    (p.phone || '').includes(term)
  );
  $('patientList').innerHTML = rows.length ? rows.map(p => `
    <article class="record">
      <div><strong>${escapeHtml(p.full_name)}</strong><small>${escapeHtml(p.phone || 'شماره تماس ثبت نشده')}</small></div>
      <button type="button" class="small-action" data-book-patient="${p.id}">ثبت نوبت</button>
    </article>`).join('') : '<p class="muted">بیماری پیدا نشد.</p>';
}
function fillPatientOptions() {
  $('appointmentPatient').innerHTML = '<option value="">انتخاب بیمار</option>' +
    patientsCache.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}${p.phone ? ' - ' + escapeHtml(p.phone) : ''}</option>`).join('');
}
async function loadDentists() {
  const { data, error } = await supabase
    .from('dentist_profiles')
    .select('id, full_name')
    .eq('clinic_id', activeClinicId)
    .order('full_name');
  if (error) throw error;
  dentistsCache = data || [];
  $('dentistCount').textContent = faNumber(dentistsCache.length);
  $('appointmentDentist').innerHTML = '<option value="">بدون تعیین دندان‌پزشک</option>' +
    dentistsCache.map(d => `<option value="${d.id}">${escapeHtml(d.full_name)}</option>`).join('');
}
async function loadAppointments() {
  const now = new Date();
  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_at, status, notes, dentist_id')
    .eq('clinic_id', activeClinicId)
    .gte('appointment_at', now.toISOString())
    .order('appointment_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  const list = data || [];
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const { count: todayCount, error: countError } = await supabase
    .from('appointments').select('id', {count:'exact', head:true})
    .eq('clinic_id', activeClinicId)
    .gte('appointment_at', dayStart.toISOString())
    .lt('appointment_at', dayEnd.toISOString());
  if (countError) throw countError;
  $('todayCount').textContent = faNumber(todayCount);
  const patientMap = new Map(patientsCache.map(p => [p.id, p]));
  const dentistMap = new Map(dentistsCache.map(d => [d.id, d]));
  $('appointmentList').innerHTML = list.length ? list.map(a => {
    const patient = patientMap.get(a.patient_id);
    const dentist = dentistMap.get(a.dentist_id);
    const statusText = ({scheduled:'ثبت‌شده', confirmed:'تأییدشده', completed:'انجام‌شده', cancelled:'لغوشده'})[a.status] || a.status;
    return `<article class="record appointment-record">
      <div><strong>${escapeHtml(patient?.full_name || 'بیمار')}</strong>
      <small>${escapeHtml(formatDate(a.appointment_at))} · ${escapeHtml(statusText)}</small>
      <small>${escapeHtml(dentist?.full_name || 'دندان‌پزشک تعیین نشده')}${a.notes ? ' · ' + escapeHtml(a.notes) : ''}</small></div>
      <select class="status-select" data-appointment-status="${a.id}" aria-label="وضعیت نوبت">
        <option value="scheduled" ${a.status==='scheduled'?'selected':''}>ثبت‌شده</option>
        <option value="confirmed" ${a.status==='confirmed'?'selected':''}>تأییدشده</option>
        <option value="completed" ${a.status==='completed'?'selected':''}>انجام‌شده</option>
        <option value="cancelled" ${a.status==='cancelled'?'selected':''}>لغوشده</option>
      </select>
    </article>`;
  }).join('') : '<p class="muted">نوبت آینده‌ای ثبت نشده است.</p>';
}
async function loadFinancePermissionManagement() {
  const panel = $('financePermissionPanel');
  const list = $('financeSecretaryList');
  if (!panel || !list || !activeClinicId) return;
  panel.style.display = 'none';
  const { data, error } = await supabase.rpc('denta_owner_list_secretary_finance_access', {
    target_clinic: activeClinicId
  });
  // The RPC returns data only to the primary owner; other clinic members see no panel.
  if (error) {
    list.innerHTML = '<p class="muted">مدیریت مجوز مالی فقط برای مالک اصلی کلینیک فعال است.</p>';
    return;
  }
  panel.style.display = '';
  if (!data || data.length === 0) {
    list.innerHTML = '<p class="muted">برای این کلینیک منشی‌ای ثبت نشده است.</p>';
    return;
  }
  list.innerHTML = data.map(member => `
    <article class="record">
      <div>
        <strong>${escapeHtml(member.full_name || member.user_email || 'منشی')}</strong>
        <small>${escapeHtml(member.user_email || '')}</small>
        <small>${member.finance_enabled ? 'دسترسی مالی فعال است' : 'دسترسی مالی غیرفعال است'}</small>
      </div>
      <button type="button" class="small-action" data-finance-member="${member.member_id}" data-finance-enabled="${member.finance_enabled ? 'true' : 'false'}">
        ${member.finance_enabled ? 'لغو دسترسی' : 'فعال‌سازی دسترسی'}
      </button>
    </article>`).join('');
}

$('financeSecretaryList')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-finance-member]');
  if (!button) return;
  const memberId = button.dataset.financeMember;
  const enabled = button.dataset.financeEnabled === 'true';
  button.disabled = true;
  setFormMessage('financePermissionMessage', 'در حال ثبت تغییر...');
  try {
    const functionName = enabled
      ? 'denta_revoke_secretary_finance_access'
      : 'denta_grant_secretary_finance_access';
    const { error } = await supabase.rpc(functionName, {
      target_clinic: activeClinicId,
      target_secretary_member: memberId
    });
    if (error) throw error;
    setFormMessage('financePermissionMessage', enabled
      ? 'دسترسی مالی منشی لغو شد.'
      : 'دسترسی مالی منشی فعال شد.');
    await loadFinancePermissionManagement();
  } catch (error) {
    setFormMessage('financePermissionMessage', 'تغییر دسترسی انجام نشد: ' + error.message, true);
  } finally {
    button.disabled = false;
  }
});


async function loadPayments() {
  const panel = $('paymentsPanel');
  if (!panel || !activeClinicId) return;
  panel.style.display = 'none';
  const { data: allowed, error: accessError } = await supabase.rpc('denta_secretary_has_finance_access', {
    target_clinic: activeClinicId
  });
  if (accessError || allowed !== true) return;
  panel.style.display = '';
  $('paymentPatient').innerHTML = '<option value="">انتخاب بیمار</option>' +
    patientsCache.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join('');
  const { data, error } = await supabase.from('payments')
    .select('id, patient_id, amount, payment_date, description')
    .eq('clinic_id', activeClinicId)
    .order('payment_date', {ascending:false})
    .limit(200);
  if (error) {
    $('paymentList').innerHTML = '<p class="muted">دریافت سوابق پرداخت ناموفق بود: ' + escapeHtml(error.message) + '</p>';
    return;
  }
  const patientMap = new Map(patientsCache.map(p => [p.id,p]));
  $('paymentList').innerHTML = data && data.length ? data.map(p => `
    <article class="record">
      <div>
        <strong>${escapeHtml(patientMap.get(p.patient_id)?.full_name || 'بیمار')}</strong>
        <small>${faNumber(p.amount)} تومان · ${p.payment_date ? escapeHtml(formatDate(p.payment_date)) : 'بدون تاریخ'}</small>
        <small>${escapeHtml(p.description || 'بدون توضیحات')}</small>
      </div>
      <button type="button" class="small-action" data-edit-payment="${p.id}">ویرایش</button>
    </article>`).join('') : '<p class="muted">هنوز پرداختی ثبت نشده است.</p>';
  window.dentaPaymentsCache = data || [];
}

function localDateInputValue(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
async function loadRevenueReport() {
  const panel = $('revenueReportPanel');
  if (!panel || !activeClinicId) return;
  panel.style.display = 'none';
  const { data: allowed, error: accessError } = await supabase.rpc('denta_secretary_has_finance_access', {
    target_clinic: activeClinicId
  });
  if (accessError || allowed !== true) return;
  panel.style.display = '';
  if (!$('revenueFrom').value || !$('revenueTo').value) {
    const today = localDateInputValue(new Date());
    $('revenueFrom').value = today.slice(0, 7) + '-01';
    $('revenueTo').value = today;
  }
  const fromDate = $('revenueFrom').value;
  const toDate = $('revenueTo').value;
  if (fromDate > toDate) {
    setFormMessage('revenueMessage', 'تاریخ شروع نباید بعد از تاریخ پایان باشد.', true);
    return;
  }
  $('loadRevenueReport').disabled = true;
  setFormMessage('revenueMessage', 'در حال دریافت گزارش...');
  try {
    const { data, error } = await supabase.rpc('denta_clinic_revenue_report', {
      target_clinic: activeClinicId,
      p_from_date: fromDate,
      p_to_date: toDate
    });
    if (error) throw error;
    const report = data || {};
    const daily = Array.isArray(report.daily) ? report.daily : [];
    const calculatedTotal = daily.reduce((sum, day) => sum + Number(day.total_amount || 0), 0);
    const calculatedCount = daily.reduce((sum, day) => sum + Number(day.payment_count || 0), 0);
    const totalAmount = report.total_amount ?? calculatedTotal;
    const paymentCount = report.payment_count ?? calculatedCount;
    revenueReportCache = { fromDate, toDate, totalAmount, paymentCount, daily };
    $('revenueTotal').textContent = faNumber(totalAmount) + ' تومان';
    $('revenueCount').textContent = faNumber(paymentCount);
    const monthlyMap = new Map();
    const persianMonthKeyFormatter = new Intl.DateTimeFormat('en-u-ca-persian', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric'
    });
    const persianMonthLabelFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: 'long'
    });
    daily.forEach(day => {
      const dayDate = new Date(String(day.day) + 'T12:00:00+03:30');
      const parts = Object.fromEntries(persianMonthKeyFormatter.formatToParts(dayDate)
        .map(part => [part.type, part.value]));
      const monthKey = String(parts.year) + '-' + String(parts.month).padStart(2, '0');
      const current = monthlyMap.get(monthKey) || {
        label: persianMonthLabelFormatter.format(dayDate),
        total_amount: 0, payment_count: 0
      };
      current.total_amount += Number(day.total_amount || 0);
      current.payment_count += Number(day.payment_count || 0);
      monthlyMap.set(monthKey, current);
    });
    const monthly = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    $('revenueMonthlyList').innerHTML = monthly.length ? monthly.map(([month, values]) => {
      return `<article class="record"><div><strong>${escapeHtml(values.label)}</strong><small>${faNumber(values.payment_count)} پرداخت</small></div><strong>${faNumber(values.total_amount)} تومان</strong></article>`;
    }).join('') : '<p class="muted">در این بازه پرداختی ثبت نشده است.</p>';
    $('revenueDailyList').innerHTML = daily.length ? daily.map(day => {
      const dateLabel = new Intl.DateTimeFormat('fa-IR', {dateStyle:'medium'})
        .format(new Date(day.day + 'T12:00:00+03:30'));
      return `<article class="record"><div><strong>${escapeHtml(dateLabel)}</strong><small>${faNumber(day.payment_count)} پرداخت</small></div><strong>${faNumber(day.total_amount)} تومان</strong></article>`;
    }).join('') : '<p class="muted">در این بازه پرداختی ثبت نشده است.</p>';
    setFormMessage('revenueMessage', 'گزارش با موفقیت به‌روزرسانی شد.');
  } catch (error) {
    $('revenueDailyList').innerHTML = '<p class="muted">دریافت گزارش ناموفق بود.</p>';
    setFormMessage('revenueMessage', 'خطا در دریافت گزارش: ' + error.message, true);
  } finally {
    $('loadRevenueReport').disabled = false;
  }
}

$('loadRevenueReport')?.addEventListener('click', loadRevenueReport);
$('exportRevenueExcel')?.addEventListener('click', () => {
  if (!revenueReportCache) {
    setFormMessage('revenueMessage', 'ابتدا گزارش را نمایش دهید.', true);
    return;
  }
  if (!window.XLSX) {
    setFormMessage('revenueMessage', 'کتابخانه ساخت فایل اکسل بارگذاری نشد؛ اینترنت گوشی را بررسی و صفحه را تازه‌سازی کنید.', true);
    return;
  }
  const rows = [
    ['نوع گزارش', 'تاریخ یا ماه', 'تعداد پرداخت', 'مبلغ (تومان)'],
    ['خلاصه', revenueReportCache.fromDate + ' تا ' + revenueReportCache.toDate, revenueReportCache.paymentCount, revenueReportCache.totalAmount],
    ['گزارش روزانه', '', '', '']
  ];
  revenueReportCache.daily.forEach(day => {
    const date = new Date(String(day.day) + 'T12:00:00+03:30');
    const label = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
    rows.push(['روزانه', label, Number(day.payment_count || 0), Number(day.total_amount || 0)]);
  });
  const months = new Map();
  const keyFormatter = new Intl.DateTimeFormat('en-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric'
  });
  const labelFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: 'long'
  });
  revenueReportCache.daily.forEach(day => {
    const date = new Date(String(day.day) + 'T12:00:00+03:30');
    const parts = Object.fromEntries(keyFormatter.formatToParts(date).map(part => [part.type, part.value]));
    const key = String(parts.year) + '-' + String(parts.month).padStart(2, '0');
    const value = months.get(key) || { label: labelFormatter.format(date), count: 0, amount: 0 };
    value.count += Number(day.payment_count || 0);
    value.amount += Number(day.total_amount || 0);
    months.set(key, value);
  });
  rows.push(['گزارش ماهانه', '', '', '']);
  [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([month, value]) => rows.push(['ماهانه', value.label, value.count, value.amount]));
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{wch:18},{wch:30},{wch:18},{wch:22}];
  sheet['!views'] = [{rightToLeft:true}];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'گزارش درآمد');
  XLSX.writeFile(workbook, `denta-revenue-${revenueReportCache.fromDate}-${revenueReportCache.toDate}.xlsx`);
  setFormMessage('revenueMessage', 'فایل اکسل واقعی با موفقیت آماده شد.');
});

function resetPaymentForm() {
  $('paymentForm').reset();
  $('paymentId').value = '';
  $('savePaymentBtn').textContent = 'ثبت پرداخت';
  $('cancelPaymentEdit').style.display = 'none';
}
$('paymentForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('paymentId').value;
  const patient_id = $('paymentPatient').value;
  const amount = Number($('paymentAmount').value);
  const dateValue = $('paymentDate').value;
  const description = $('paymentDescription').value.trim();
  if (!patient_id || !Number.isFinite(amount) || amount <= 0) {
    return setFormMessage('paymentMessage','بیمار و مبلغ معتبر را وارد کنید.',true);
  }
  if (!patientsCache.some(p => p.id === patient_id)) {
    return setFormMessage('paymentMessage','بیمار انتخاب‌شده متعلق به این کلینیک نیست.',true);
  }
  const payload = {
    clinic_id: activeClinicId,
    patient_id,
    amount,
    payment_date: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString(),
    description: description || null
  };
  $('savePaymentBtn').disabled = true;
  try {
    const query = id
      ? supabase.from('payments').update(payload).eq('id',id).eq('clinic_id',activeClinicId)
      : supabase.from('payments').insert(payload);
    const { error } = await query;
    if (error) throw error;
    setFormMessage('paymentMessage', id ? 'پرداخت ویرایش شد.' : 'پرداخت با موفقیت ثبت شد.');
    resetPaymentForm();
    await loadPayments();
    await loadRevenueReport();
  } catch (error) {
    setFormMessage('paymentMessage','ثبت یا ویرایش پرداخت ناموفق بود: '+error.message,true);
  } finally {
    $('savePaymentBtn').disabled = false;
  }
});
$('paymentList')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-payment]');
  if (!button) return;
  const item = (window.dentaPaymentsCache || []).find(p => p.id === button.dataset.editPayment);
  if (!item) return;
  $('paymentId').value = item.id;
  $('paymentPatient').value = item.patient_id;
  $('paymentAmount').value = item.amount;
  if (item.payment_date) {
    const d = new Date(item.payment_date);
    const local = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    $('paymentDate').value = local;
  } else $('paymentDate').value = '';
  $('paymentDescription').value = item.description || '';
  $('savePaymentBtn').textContent = 'ذخیره ویرایش';
  $('cancelPaymentEdit').style.display = '';
  $('paymentForm').scrollIntoView({behavior:'smooth'});
});
$('cancelPaymentEdit')?.addEventListener('click', resetPaymentForm);


async function refreshDashboard() {
  try {
    await loadPatients();
    await loadDentists();
    await loadAppointments();
    await loadPayments();
    await loadRevenueReport();
  } catch (error) {
    showMessage('خطا در دریافت اطلاعات: ' + error.message, true);
  }
}

themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeBtn.textContent = document.body.classList.contains('dark') ? '☀' : '☾';
});
$('openPatients').addEventListener('click', () => $('patientsPanel').scrollIntoView({behavior:'smooth'}));
$('openAppointment').addEventListener('click', () => $('appointmentsPanel').scrollIntoView({behavior:'smooth'}));
$('refreshData').addEventListener('click', refreshDashboard);
$('patientSearch').addEventListener('input', renderPatients);

patientForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeClinicId) return;
  const full_name = $('patientName').value.trim();
  const phone = $('patientPhone').value.trim();
  if (!full_name) return setFormMessage('patientMessage', 'نام بیمار را وارد کنید.', true);
  $('savePatientBtn').disabled = true;
  $('savePatientBtn').textContent = 'در حال ثبت...';
  try {
    const { error } = await supabase.from('patients').insert({
      clinic_id: activeClinicId, full_name, phone: phone || null
    });
    if (error) throw error;
    patientForm.reset();
    setFormMessage('patientMessage', 'بیمار با موفقیت ثبت شد.');
    await loadPatients();
  } catch (error) {
    setFormMessage('patientMessage', 'ثبت بیمار انجام نشد: ' + error.message, true);
  } finally {
    $('savePatientBtn').disabled = false;
    $('savePatientBtn').textContent = 'ثبت بیمار';
  }
});

$('patientList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-book-patient]');
  if (!button) return;
  $('appointmentPatient').value = button.dataset.bookPatient;
  $('appointmentsPanel').scrollIntoView({behavior:'smooth'});
  $('appointmentAt').focus();
});

appointmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeClinicId) return;
  const patient_id = $('appointmentPatient').value;
  const localDate = $('appointmentAt').value;
  const dentist_id = $('appointmentDentist').value || null;
  const notes = $('appointmentNotes').value.trim();
  if (!patient_id || !localDate) return setFormMessage('appointmentMessage', 'بیمار و زمان نوبت را انتخاب کنید.', true);
  const selectedPatient = patientsCache.find(p => p.id === patient_id);
  if (!selectedPatient) return setFormMessage('appointmentMessage', 'بیمار انتخاب‌شده معتبر نیست.', true);
  $('saveAppointmentBtn').disabled = true;
  $('saveAppointmentBtn').textContent = 'در حال ثبت...';
  try {
    const payload = {
      clinic_id: activeClinicId,
      patient_id,
      appointment_at: new Date(localDate).toISOString(),
      status: 'scheduled',
      notes: notes || null,
      dentist_id
    };
    const { error } = await supabase.from('appointments').insert(payload);
    if (error) throw error;
    appointmentForm.reset();
    setFormMessage('appointmentMessage', 'نوبت با موفقیت ثبت شد.');
    await loadAppointments();
  } catch (error) {
    setFormMessage('appointmentMessage', 'ثبت نوبت انجام نشد: ' + error.message, true);
  } finally {
    $('saveAppointmentBtn').disabled = false;
    $('saveAppointmentBtn').textContent = 'ثبت نوبت';
  }
});

$('appointmentList').addEventListener('change', async (event) => {
  const select = event.target.closest('[data-appointment-status]');
  if (!select) return;
  const id = select.dataset.appointmentStatus;
  const status = select.value;
  select.disabled = true;
  try {
    const { error } = await supabase.from('appointments')
      .update({status}).eq('id', id).eq('clinic_id', activeClinicId);
    if (error) throw error;
    setFormMessage('appointmentMessage', 'وضعیت نوبت به‌روزرسانی شد.');
  } catch (error) {
    setFormMessage('appointmentMessage', 'تغییر وضعیت انجام نشد: ' + error.message, true);
    await loadAppointments();
  } finally {
    select.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) return showMessage('خروج انجام نشد: ' + error.message, true);
  currentUser = null; activeClinicId = null; patientsCache = []; dentistsCache = [];
  passwordInput.value = '';
  showDashboard(false);
  logoutBtn.style.display = 'none';
  showMessage('با موفقیت از حساب خارج شدید.');
});

forgotBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) { showMessage('ابتدا ایمیل حساب خود را وارد کنید.', true); emailInput.focus(); return; }
  if (!supabase) return showMessage('اتصال به سرور برقرار نیست.', true);
  forgotBtn.disabled = true; forgotBtn.textContent = 'در حال ارسال ایمیل...';
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/panel'
    });
    if (error) throw error;
    showMessage('ایمیل بازیابی ارسال شد. صندوق ورودی و هرزنامه را بررسی کنید.');
  } catch (error) { showMessage('ارسال ایمیل ناموفق بود: ' + error.message, true); }
  finally { forgotBtn.disabled = false; forgotBtn.textContent = 'فراموشی رمز عبور'; }
});

savePasswordBtn.addEventListener('click', async () => {
  const password = newPasswordInput.value;
  if (password.length < 8) { resetMessage.textContent = 'رمز باید حداقل ۸ کاراکتر باشد.'; return; }
  if (password !== confirmPasswordInput.value) { resetMessage.textContent = 'رمزهای واردشده یکسان نیستند.'; return; }
  if (!supabase) { resetMessage.textContent = 'اتصال به سرور برقرار نیست.'; return; }
  savePasswordBtn.disabled = true;
  try {
    const { error } = await supabase.auth.updateUser({password});
    if (error) throw error;
    await supabase.auth.signOut();
    recoveryMode = false; resetCard.style.display = 'none'; loginCard.style.display = '';
    dashboard.style.display = 'none'; forgotBtn.style.display = '';
    newPasswordInput.value = ''; confirmPasswordInput.value = ''; passwordInput.value = '';
    showMessage('رمز عبور با موفقیت تغییر کرد. اکنون وارد شوید.');
  } catch (error) { resetMessage.textContent = 'خطا در تغییر رمز: ' + error.message; }
  finally { savePasswordBtn.disabled = false; }
});

async function afterLogin(session) {
  currentUser = session.user;
  await loadClinicContext();
  await loadFinancePermissionManagement();
  showDashboard(true);
  logoutBtn.style.display = '';
  await refreshDashboard();
}

async function startDenta() {
  try {
    const response = await fetch('/api/config', {cache:'no-store'});
    if (!response.ok) throw new Error('تنظیمات اتصال دریافت نشد.');
    const config = await response.json();
    const key = config.supabaseKey || config.supabaseAnonKey || config.publishableKey;
    if (!config.supabaseUrl || !key) throw new Error('اطلاعات اتصال Supabase ناقص است.');
    const {createClient} = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(config.supabaseUrl, key, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
    });
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token=')) recoveryMode = true;
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { showRecoveryForm(); return; }
      if (recoveryMode) return;
      if (event === 'SIGNED_OUT') { showDashboard(false); logoutBtn.style.display='none'; }
    });
    const {data, error} = await supabase.auth.getSession();
    if (error) throw error;
    if (recoveryMode && data.session) { showRecoveryForm(); return; }
    if (data.session) {
      try { await afterLogin(data.session); showMessage('به دنتا خوش آمدید.'); }
      catch (err) { showDashboard(false); showMessage(err.message, true); }
    } else {
      showDashboard(false); showMessage('اتصال امن برقرار شد.');
    }
  } catch (error) {
    supabase = null; showDashboard(false); logoutBtn.style.display='none';
    showMessage('خطا در اتصال: ' + error.message, true);
  }
}

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showMessage('لطفاً ایمیل و رمز عبور را وارد کنید.', true);
  if (!supabase) return showMessage('اتصال هنوز آماده نیست.', true);
  loginBtn.disabled = true; loginBtn.textContent = 'در حال ورود...';
  try {
    const {data, error} = await supabase.auth.signInWithPassword({email,password});
    if (error) throw error;
    if (!data.session) throw new Error('ورود تأیید نشد.');
    recoveryMode = false;
    await afterLogin(data.session);
    showMessage('ورود با موفقیت انجام شد.');
  } catch (error) {
    showDashboard(false);
    showMessage(error.message.includes('عضویت کلینیک') || error.message.includes('چند کلینیک')
      ? error.message : 'ورود انجام شد اما بارگذاری پنل ناموفق بود: ' + error.message, true);
  } finally { loginBtn.disabled = false; loginBtn.textContent = 'ورود'; }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
startDenta();
