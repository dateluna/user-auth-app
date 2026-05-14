const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { Lunar } = require('lunar-javascript');

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL 配置
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'user_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// ── 数据库初始化 ──
async function initDatabase() {
  const tempConn = await mysql.createConnection({
    host: dbConfig.host, port: dbConfig.port,
    user: dbConfig.user, password: dbConfig.password
  });
  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await tempConn.end();

  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(20) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS birthdays (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(50) NOT NULL,
        relationship VARCHAR(50) NOT NULL,
        birth_month INT NOT NULL,
        birth_day INT NOT NULL,
        calendar_type VARCHAR(10) NOT NULL DEFAULT 'solar',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('数据库表初始化完成');
  } finally {
    conn.release();
  }
}

// ── 倒计时计算 ──
function calcCountdown(birthMonth, birthDay, calendarType) {
  const today = new Date();
  const currentYear = today.getFullYear();
  let targetDate;

  if (calendarType === 'solar') {
    targetDate = new Date(currentYear, birthMonth - 1, birthDay);
  } else {
    try {
      const lunar = Lunar.fromYmd(currentYear, birthMonth, birthDay);
      const solar = lunar.getSolar();
      targetDate = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
    } catch (e) {
      return { days: null, label: '日期无效', urgent: false };
    }
  }

  // 如果已过，用明年
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (targetDate < todayStart) {
    if (calendarType === 'solar') {
      targetDate = new Date(currentYear + 1, birthMonth - 1, birthDay);
    } else {
      try {
        const lunar = Lunar.fromYmd(currentYear + 1, birthMonth, birthDay);
        const solar = lunar.getSolar();
        targetDate = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
      } catch (e) {
        return { days: null, label: '日期无效', urgent: false };
      }
    }
  }

  const diffTime = targetDate.getTime() - todayStart.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let label;
  if (diffDays === 0) label = '今天！';
  else if (diffDays === 1) label = '明天！';
  else label = `还剩 ${diffDays} 天`;

  return { days: diffDays, label, urgent: diffDays >= 0 && diffDays <= 3 };
}

// 农历显示
function lunarLabel(month, day) {
  const m = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
  const d = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
             '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
             '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  return `农历${m[month-1]}月${d[day-1]}`;
}

// ── 中间件 ──
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'login-demo-secret-key-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

// 鉴权中间件
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }
  next();
}

// ══════════════════════════ 用户 API ══════════════════════════

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    if (username.length < 2 || username.length > 20) return res.status(400).json({ success: false, message: '用户名长度应在2-20个字符之间' });
    if (password.length < 6) return res.status(400).json({ success: false, message: '密码长度不能少于6个字符' });

    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(409).json({ success: false, message: '用户名已存在，请更换' });

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const userId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    await pool.execute('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [userId, username, hashedPassword]);
    res.json({ success: true, message: '注册成功，请登录' });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '用户名和密码不能为空' });

    const [rows] = await pool.execute('SELECT id, username, password FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: '用户名或密码错误' });

    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ success: false, message: '用户名或密码错误' });

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ success: true, message: `${username}，恭喜您 登录成功`, username });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
});

app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: '已退出登录' });
});

// ══════════════════════════ 生日 API ══════════════════════════

// 获取生日列表
app.get('/api/birthdays', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, relationship, birth_month, birth_day, calendar_type FROM birthdays WHERE user_id = ? ORDER BY CAST(birth_month AS UNSIGNED), CAST(birth_day AS UNSIGNED)',
      [req.session.userId]
    );

    const result = rows.map(row => {
      const cd = calcCountdown(row.birth_month, row.birth_day, row.calendar_type);
      let displayBirthday;
      if (row.calendar_type === 'solar') {
        displayBirthday = `${row.birth_month}月${row.birth_day}日 (公历)`;
      } else {
        displayBirthday = lunarLabel(row.birth_month, row.birth_day);
      }
      return {
        id: row.id,
        name: row.name,
        relationship: row.relationship,
        birthMonth: row.birth_month,
        birthDay: row.birth_day,
        calendarType: row.calendar_type,
        displayBirthday,
        countdown: cd
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('获取生日列表失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 添加生日
app.post('/api/birthdays', requireAuth, async (req, res) => {
  try {
    const { name, relationship, birthMonth, birthDay, calendarType } = req.body;
    if (!name || !relationship || !birthMonth || !birthDay) {
      return res.status(400).json({ success: false, message: '请填写完整的生日信息' });
    }
    if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
      return res.status(400).json({ success: false, message: '日期无效' });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    await pool.execute(
      'INSERT INTO birthdays (id, user_id, name, relationship, birth_month, birth_day, calendar_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.session.userId, name, relationship, birthMonth, birthDay, calendarType || 'solar']
    );

    res.json({ success: true, message: '添加成功' });
  } catch (err) {
    console.error('添加生日失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 更新生日
app.put('/api/birthdays/:id', requireAuth, async (req, res) => {
  try {
    const { name, relationship, birthMonth, birthDay, calendarType } = req.body;

    const [existing] = await pool.execute(
      'SELECT id FROM birthdays WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]
    );
    if (existing.length === 0) return res.status(404).json({ success: false, message: '记录不存在' });

    await pool.execute(
      'UPDATE birthdays SET name=?, relationship=?, birth_month=?, birth_day=?, calendar_type=? WHERE id=?',
      [name, relationship, birthMonth, birthDay, calendarType, req.params.id]
    );

    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    console.error('更新生日失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 删除生日
app.delete('/api/birthdays/:id', requireAuth, async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM birthdays WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]
    );
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('删除生日失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ══════════════════════════ 启动 ══════════════════════════

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`服务器已启动，访问地址：http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('启动失败，请检查 MySQL 连接配置:', err);
    process.exit(1);
  }
}

start();
