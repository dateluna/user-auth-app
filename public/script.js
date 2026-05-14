// 显示注册表单
function showRegister() {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('registerBox').style.display = 'block';
  document.getElementById('successBox').style.display = 'none';
}

// 显示登录表单
function showLogin() {
  document.getElementById('registerBox').style.display = 'none';
  document.getElementById('loginBox').style.display = 'block';
  document.getElementById('successBox').style.display = 'none';
}

// Toast 提示
function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 注册
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (password !== confirm) {
    showToast('两次输入的密码不一致', 'error');
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      // 清空表单
      document.getElementById('regUsername').value = '';
      document.getElementById('regPassword').value = '';
      document.getElementById('regConfirm').value = '';
      // 切换到登录页
      setTimeout(() => showLogin(), 1000);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('网络错误，请稍后重试', 'error');
  }
});

// 登录
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      // 显示成功页面
      document.getElementById('registerBox').style.display = 'none';
      document.getElementById('loginBox').style.display = 'none';
      const successBox = document.getElementById('successBox');
      successBox.style.display = 'block';
      document.getElementById('successMessage').textContent = data.message;
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('网络错误，请稍后重试', 'error');
  }
});

// 退出登录
async function handleLogout() {
  try {
    const res = await fetch('/api/logout', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('已退出登录', 'success');
      // 清空登录表单
      document.getElementById('loginUsername').value = '';
      document.getElementById('loginPassword').value = '';
      setTimeout(() => showLogin(), 800);
    }
  } catch (err) {
    showToast('退出失败，请重试', 'error');
  }
}

// 页面加载时检查登录状态
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.loggedIn) {
      document.getElementById('registerBox').style.display = 'none';
      document.getElementById('loginBox').style.display = 'none';
      document.getElementById('successBox').style.display = 'block';
      document.getElementById('successMessage').textContent = `${data.username}，恭喜您 登录成功`;
    }
  } catch (err) {
    // 忽略，显示默认登录页
  }
});
