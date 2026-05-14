// ── 农历下拉填充 ──
(function() {
  const sel = document.getElementById('bLunarDay');
  for (let i = 1; i <= 30; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    const d = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
               '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
               '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
    opt.textContent = d[i-1];
    sel.appendChild(opt);
  }
})();

// ── 日历类型切换 ──
document.querySelectorAll('input[name="calendarType"]').forEach(r => {
  r.addEventListener('change', function() {
    document.getElementById('solarInput').style.display = this.value === 'solar' ? 'flex' : 'none';
    document.getElementById('lunarInput').style.display = this.value === 'lunar' ? 'flex' : 'none';
  });
});

// ── 工具函数 ──
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showLogin() {
  document.getElementById('registerBox').style.display = 'none';
  document.getElementById('loginBox').style.display = 'block';
}

function showRegister() {
  document.getElementById('registerBox').style.display = 'block';
  document.getElementById('loginBox').style.display = 'none';
}

// ── 注册 ──
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;
  if (password !== confirm) return showToast('两次输入的密码不一致', 'error');
  try {
    const res = await fetch('/api/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username, password})
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('regUsername').value = '';
      document.getElementById('regPassword').value = '';
      document.getElementById('regConfirm').value = '';
      setTimeout(showLogin, 800);
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('网络错误', 'error'); }
});

// ── 登录 ──
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username, password})
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      enterDashboard(data.username);
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('网络错误', 'error'); }
});

// ── 退出登录 ──
async function handleLogout() {
  try {
    await fetch('/api/logout', {method:'POST'});
    document.getElementById('authSection').style.display = '';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    showToast('已退出登录', 'success');
  } catch { showToast('退出失败', 'error'); }
}

// ── 进入仪表盘 ──
function enterDashboard(username) {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  document.getElementById('dashUsername').textContent = username + '，你好';
  loadBirthdays();
}

// ── 加载生日列表 ──
async function loadBirthdays() {
  try {
    const res = await fetch('/api/birthdays');
    const data = await res.json();
    if (data.success) renderList(data.data);
  } catch { showToast('加载失败', 'error'); }
}

function renderList(items) {
  const el = document.getElementById('birthdayList');
  if (!items || items.length === 0) {
    el.innerHTML = '<div class="empty-state">🎉 暂无生日提醒，请在左侧添加</div>';
    return;
  }
  el.innerHTML = items.map(item => {
    const urgentClass = item.countdown.urgent ? ' urgent' : '';
    const pastClass = item.countdown.days === null ? ' past' : '';
    const cdHtml = item.countdown.days !== null
      ? `<div class="birthday-countdown${urgentClass}${pastClass}">${item.countdown.label}</div>`
      : `<div class="birthday-countdown past">日期无效</div>`;
    return `
      <div class="birthday-item" data-id="${item.id}">
        <div class="birthday-info">
          <div>
            <span class="birthday-name">${escHtml(item.name)}</span>
            <span class="birthday-relation">${escHtml(item.relationship)}</span>
          </div>
          <div class="birthday-date">${escHtml(item.displayBirthday)}</div>
          ${cdHtml}
        </div>
        <div class="birthday-actions">
          <button class="btn-icon edit" onclick="editBirthday('${item.id}')">编辑</button>
          <button class="btn-icon delete" onclick="deleteBirthday('${item.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 添加 / 更新生日 ──
let editingId = null;

document.getElementById('birthdayForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('bName').value.trim();
  const relationship = document.getElementById('bRelation').value;
  const calendarType = document.querySelector('input[name="calendarType"]:checked').value;

  let birthMonth, birthDay;
  if (calendarType === 'solar') {
    const dateVal = document.getElementById('bDate').value;
    if (!dateVal) return showToast('请选择生日日期', 'error');
    const parts = dateVal.split('-');
    birthMonth = parseInt(parts[1]);
    birthDay = parseInt(parts[2]);
  } else {
    birthMonth = parseInt(document.getElementById('bLunarMonth').value);
    birthDay = parseInt(document.getElementById('bLunarDay').value);
  }

  if (!name) return showToast('请输入姓名', 'error');

  const body = { name, relationship, birthMonth, birthDay, calendarType };

  try {
    let res;
    if (editingId) {
      res = await fetch(`/api/birthdays/${editingId}`, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
      });
    } else {
      res = await fetch('/api/birthdays', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
      });
    }
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      resetForm();
      loadBirthdays();
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('操作失败', 'error'); }
});

// ── 编辑 ──
async function editBirthday(id) {
  try {
    const res = await fetch('/api/birthdays');
    const data = await res.json();
    if (!data.success) return;
    const item = data.data.find(d => d.id === id);
    if (!item) return;

    editingId = id;
    document.getElementById('formTitle').textContent = '✏️ 编辑生日提醒';
    document.getElementById('saveBtn').textContent = '更新';
    document.getElementById('cancelBtn').style.display = 'block';

    document.getElementById('bName').value = item.name;
    document.getElementById('bRelation').value = item.relationship;

    if (item.calendarType === 'solar') {
      document.querySelector('input[name="calendarType"][value="solar"]').checked = true;
      document.getElementById('solarInput').style.display = 'flex';
      document.getElementById('lunarInput').style.display = 'none';
      const month = String(item.birthMonth).padStart(2,'0');
      const day = String(item.birthDay).padStart(2,'0');
      document.getElementById('bDate').value = `2000-${month}-${day}`;
    } else {
      document.querySelector('input[name="calendarType"][value="lunar"]').checked = true;
      document.getElementById('solarInput').style.display = 'none';
      document.getElementById('lunarInput').style.display = 'flex';
      document.getElementById('bLunarMonth').value = item.birthMonth;
      document.getElementById('bLunarDay').value = item.birthDay;
    }

    window.scrollTo({top:0, behavior:'smooth'});
  } catch { showToast('加载失败', 'error'); }
}

// ── 删除 ──
async function deleteBirthday(id) {
  if (!confirm('确定要删除这条记录吗？')) return;
  try {
    const res = await fetch(`/api/birthdays/${id}`, {method:'DELETE'});
    const data = await res.json();
    if (data.success) {
      showToast('删除成功', 'success');
      if (editingId === id) resetForm();
      loadBirthdays();
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('删除失败', 'error'); }
}

// ── 取消编辑 ──
function cancelEdit() {
  resetForm();
}

function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = '+ 添加生日提醒';
  document.getElementById('saveBtn').textContent = '保存';
  document.getElementById('cancelBtn').style.display = 'none';
  document.getElementById('birthdayForm').reset();
  document.getElementById('solarInput').style.display = 'flex';
  document.getElementById('lunarInput').style.display = 'none';
  document.querySelector('input[name="calendarType"][value="solar"]').checked = true;
}

// ── 页面加载时检查登录状态 ──
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.loggedIn) enterDashboard(data.username);
  } catch {}
});
