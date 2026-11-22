let supabase = null;
let currentUser = null;
let activeClinicId = null;
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
async function refreshDashboard() {
  try {
    await loadPatients();
    await loadDentists();
    await loadAppointments();
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
