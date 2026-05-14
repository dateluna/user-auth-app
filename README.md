# 用户注册登录系统（MySQL版）

## 技术栈
- Node.js + Express
- MySQL 8.0
- Docker + Docker Compose

## 快速启动（本地测试用 Docker）

```bash
# 一键启动 MySQL + 应用
docker-compose up -d

# 查看日志
docker-compose logs -f

# 访问 http://localhost:3000
```

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 应用端口 | 3000 |
| MYSQL_HOST | MySQL 地址 | localhost |
| MYSQL_PORT | MySQL 端口 | 3306 |
| MYSQL_USER | MySQL 用户名 | root |
| MYSQL_PASSWORD | MySQL 密码 | (空) |
| MYSQL_DATABASE | 数据库名 | user_auth |
| SESSION_SECRET | Session 密钥 | (随机串) |
