
let supabase = null;

const themeBtn = document.getElementById('themeBtn');
const loginBtn = document.getElementById('loginBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginMessage = document.getElementById('loginMessage');
const loginCard = document.getElementById('loginCard');
const dashboard = document.getElementById('dashboard');

function showMessage(message, error = false) {
  loginMessage.textContent = message;
  loginMessage.style.color = error ? '#dc2626' : '';
}

function showDashboard(isLoggedIn) {
  loginCard.style.display = isLoggedIn ? 'none' : '';
  dashboard.style.display = isLoggedIn ? '' : 'none';
}

themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeBtn.textContent =
    document.body.classList.contains('dark') ? '☀' : '☾';
});

// دکمه خروج
const logoutBtn = document.createElement('button');
logoutBtn.textContent = 'خروج از حساب';
logoutBtn.className = 'icon-btn';
logoutBtn.style.display = 'none';
document.querySelector('.topbar').appendChild(logoutBtn);

logoutBtn.addEventListener('click', async () => {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage('خروج انجام نشد. دوباره تلاش کنید.', true);
    return;
  }

  passwordInput.value = '';
  showDashboard(false);
  logoutBtn.style.display = 'none';
  showMessage('با موفقیت از حساب خارج شدید.');
});

// راه‌اندازی اتصال Supabase
async function startDenta() {
  try {
    const configResponse = await fetch('/api/config', {
      cache: 'no-store'
    });

    if (!configResponse.ok) {
      throw new Error('تنظیمات اتصال دریافت نشد.');
    }

    const config = await configResponse.json();

    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('اطلاعات اتصال Supabase ناقص است.');
    }

    const { createClient } = await import(
      'https://esm.sh/@supabase/supabase-js@2'
    );

    supabase = createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    const loggedIn = !!data.session;

    showDashboard(loggedIn);
    logoutBtn.style.display = loggedIn ? '' : 'none';

    showMessage(
      loggedIn
        ? 'به دنتا خوش آمدید.'
        : 'اتصال امن برقرار شد. برای ورود اطلاعات حساب را وارد کنید.'
    );

  } catch (error) {
    showDashboard(false);
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
    showMessage('اتصال هنوز آماده نیست. صفحه را دوباره بارگذاری کنید.', true);
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'در حال ورود...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
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
     
