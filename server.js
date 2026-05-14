const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL 配置（通过环境变量注入）
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

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 数据库初始化：建库建表
async function initDatabase() {
  // 先连接不带数据库名，确保库存在
  const tempConn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  });
  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await tempConn.end();

  // 创建 users 表
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
    console.log('数据库表初始化完成');
  } finally {
    conn.release();
  }
}

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'login-demo-secret-key-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24小时
}));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 注册接口
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ success: false, message: '用户名长度应在2-20个字符之间' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度不能少于6个字符' });
    }

    // 检查用户名是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: '用户名已存在，请更换' });
    }

    // 密码加密
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const userId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    await pool.execute(
      'INSERT INTO users (id, username, password) VALUES (?, ?, ?)',
      [userId, username, hashedPassword]
    );

    res.json({ success: true, message: '注册成功，请登录' });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
});

// 登录接口
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username, password FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const user = rows[0];

    // 验证密码
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 保存会话
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
      success: true,
      message: `${username}，恭喜您 登录成功`,
      username
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
});

// 检查登录状态
app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

// 退出登录
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: '已退出登录' });
});

// 启动服务器
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
