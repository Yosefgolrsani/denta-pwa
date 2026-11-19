
let supabase = null;
let recoveryMode = false;

const themeBtn = document.getElementById('themeBtn');
const loginBtn = document.getElementById('loginBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginMessage = document.getElementById('loginMessage');
const loginCard = document.getElementById('loginCard');
const dashboard = document.getElementById('dashboard');

// دکمه خروج
const logoutBtn = document.createElement('button');
logoutBtn.type = 'button';
logoutBtn.textContent = 'خروج از حساب';
logoutBtn.className = 'icon-btn';
logoutBtn.style.display = 'none';
document.querySelector('.topbar').appendChild(logoutBtn);

// فرم بازیابی رمز
const forgotBtn = document.createElement('button');
forgotBtn.type = 'button';
forgotBtn.textContent = 'فراموشی رمز عبور';
forgotBtn.style.cssText =
  'display:block;margin:15px auto;padding:10px;border:0;background:transparent;color:#087f5b;font-size:15px;cursor:pointer;';

loginBtn.insertAdjacentElement('afterend', forgotBtn);

const resetCard = document.createElement('section');
resetCard.className = 'login card';
resetCard.style.display = 'none';

resetCard.innerHTML = `
  <h2>تعیین رمز عبور جدید</h2>
  <p class="muted">رمز عبور جدید خود را وارد کنید.</p>

  <label for="newPassword">رمز عبور جدید</label>
  <input id="newPassword" type="password"
    placeholder="حداقل ۸ کاراکتر"
    autocomplete="new-password">

  <label for="confirmPassword">تکرار رمز عبور</label>
  <input id="confirmPassword" type="password"
    placeholder="رمز عبور را دوباره وارد کنید"
    autocomplete="new-password">

  <button id="savePasswordBtn" class="primary" type="button">
    ثبت رمز جدید
  </button>

  <p id="resetMessage" class="message" aria-live="polite"></p>
`;

loginCard.insertAdjacentElement('afterend', resetCard);

const newPasswordInput = resetCard.querySelector('#newPassword');
const confirmPasswordInput = resetCard.querySelector('#confirmPassword');
const savePasswordBtn = resetCard.querySelector('#savePasswordBtn');
const resetMessage = resetCard.querySelector('#resetMessage');

// نمایش پیام
function showMessage(message, isError = false) {
  loginMessage.textContent = message;
  loginMessage.style.color = isError ? '#dc2626' : '';
}

// نمایش داشبورد
function showDashboard(isLoggedIn) {
  loginCard.style.display = isLoggedIn ? 'none' : '';
  dashboard.style.display = isLoggedIn ? '' : 'none';
  resetCard.style.display = 'none';
  forgotBtn.style.display = isLoggedIn ? 'none' : '';
}

// نمایش فرم بازیابی
function showRecoveryForm() {
  recoveryMode = true;
  loginCard.style.display = 'none';
  dashboard.style.display = 'none';
  resetCard.style.display = '';
  forgotBtn.style.display = 'none';
  logoutBtn.style.display = 'none';
}

// تغییر حالت نمایش
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeBtn.textContent =
    document.body.classList.contains('dark') ? '☀' : '☾';
});

// خروج از حساب
logoutBtn.addEventListener('click', async () => {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage('خروج انجام نشد: ' + error.message, true);
    return;
  }

  recoveryMode = false;
  passwordInput.value = '';
  showDashboard(false);
  logoutBtn.style.display = 'none';
  showMessage('با موفقیت از حساب خارج شدید.');
});

// درخواست ایمیل بازیابی
forgotBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();

  if (!email) {
    showMessage('ابتدا ایمیل حساب خود را وارد کنید.', true);
    emailInput.focus();
    return;
  }

  if (!supabase) {
    showMessage('اتصال به سرور برقرار نیست.', true);
    return;
  }

  forgotBtn.disabled = true;
  forgotBtn.textContent = 'در حال ارسال ایمیل...';

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: window.location.origin + '/'
      }
    );

    if (error) throw error;

    showMessage('درخواست بازیابی ارسال شد. ایمیل خود را بررسی کنید.');

  } catch (error) {
    showMessage('ارسال ایمیل ناموفق بود: ' + error.message, true);

  } finally {
    forgotBtn.disabled = false;
    forgotBtn.textContent = 'فراموشی رمز عبور';
  }
});

// ثبت رمز جدید
savePasswordBtn.addEventListener('click', async () => {
  const password = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!password || !confirmPassword) {
    resetMessage.textContent = 'هر دو قسمت را پر کنید.';
    resetMessage.style.color = '#dc2626';
    return;
  }

  if (password.length < 8) {
    resetMessage.textContent = 'رمز باید حداقل ۸ کاراکتر باشد.';
    resetMessage.style.color = '#dc2626';
    return;
  }

  if (password !== confirmPassword) {
    resetMessage.textContent = 'رمزهای واردشده یکسان نیستند.';
    resetMessage.style.color = '#dc2626';
    return;
  }

  savePasswordBtn.disabled = true;
  savePasswordBtn.textContent = 'در حال ذخیره...';

  try {
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) throw error;

    await supabase.auth.signOut();

    recoveryMode = false;
    resetCard.style.display = 'none';
    loginCard.style.display = '';
    dashboard.style.display = 'none';
    forgotBtn.style.display = '';

    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
    passwordInput.value = '';

    showMessage('رمز عبور با موفقیت تغییر کرد. اکنون وارد شوید.');

  } catch (error) {
    resetMessage.textContent =
      'خطا در تغییر رمز: ' + error.message;
    resetMessage.style.color = '#dc2626';

  } finally {
    savePasswordBtn.disabled = false;
    savePasswordBtn.textContent = 'ثبت رمز جدید';
  }
});

// اتصال به Supabase
async function startDenta() {
  try {
    const configResponse = await fetch('/api/config', {
      cache: 'no-store'
    });

    if (!configResponse.ok) {
      throw new Error('تنظیمات اتصال دریافت نشد.');
    }

    const config = await configResponse.json();

    const supabaseUrl = config.supabaseUrl;
    const supabaseKey =
      config.supabaseKey ||
      config.supabaseAnonKey ||
      config.publishableKey;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('اطلاعات اتصال Supabase ناقص است.');
    }

    const { createClient } = await import(
      'https://esm.sh/@supabase/supabase-js@2'
    );

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        showRecoveryForm();
        return;
      }

      if (recoveryMode) return;

      if (event === 'SIGNED_IN' && session) {
        showDashboard(true);
        logoutBtn.style.display = '';
      }

      if (event === 'SIGNED_OUT') {
        showDashboard(false);
        logoutBtn.style.display = 'none';
      }
    });

    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (!recoveryMode) {
      const isLoggedIn = !!data.session;

      showDashboard(isLoggedIn);
      logoutBtn.style.display = isLoggedIn ? '' : 'none';

      showMessage(
        isLoggedIn
          ? 'به دنتا خوش آمدید.'
          : 'اتصال امن برقرار شد.'
      );
    }

  } catch (error) {
    supabase = null;
    showDashboard(false);
    logoutBtn.style.display = 'none';

    showMessage(
      'خطا در اتصال: ' + error.message,
      true
    );
  }
}

// ورود مدیر یا منشی
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage('لطفاً ایمیل و رمز عبور را وارد کنید.', true);
    return;
  }

  if (!supabase) {
    showMessage('اتصال هنوز آماده نیست.', true);
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'در حال ورود...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    if (!data.session) {
      throw new Error('ورود تأیید نشد.');
    }

    showDashboard(true);
    logoutBtn.style.display = '';
    showMessage('ورود با موفقیت انجام شد.');

  } catch (error) {
    showMessage(
      'ورود ناموفق بود. ایمیل و رمز عبور را بررسی کنید.',
      true
    );

  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'ورود';
  }
});

// ثبت Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

startDenta();
۹۹
