const themeBtn=document.getElementById('themeBtn');
themeBtn.addEventListener('click',()=>{document.body.classList.toggle('dark');themeBtn.textContent=document.body.classList.contains('dark')?'☀':'☾';});
document.getElementById('loginBtn').addEventListener('click',()=>{
 const email=document.getElementById('email').value.trim();
 const password=document.getElementById('password').value;
 const msg=document.getElementById('loginMessage');
 if(!email||!password){msg.textContent='لطفاً ایمیل و رمز عبور را وارد کنید.';return;}
 msg.textContent='صفحه ورود آماده است؛ اتصال امن به Supabase باید در مرحله بعد تنظیم شود.';
});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
