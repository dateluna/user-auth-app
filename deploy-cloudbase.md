# 部署到 CloudBase 云托管（完整步骤）

---

## ⚠️ 准备前提

| 项目 | 说明 |
|------|------|
| GitHub 账号 | 用于托管代码，触发自动构建 |
| 腾讯云账号 | 已实名认证，未实名无法使用云托管 |
| 费用 | CloudBase 有免费额度，TDSQL-C MySQL 按量计费 |

> 如果还没有以上账号，先去注册，然后回来继续。

---

## 🚀 第一步：把代码推送到 GitHub

在你电脑上操作：

```bash
# 1. 在 GitHub 上新建一个仓库（例如叫 user-auth-app）
#    不要勾选 README、.gitignore

# 2. 在本机项目目录初始化 git 并推送
cd C:\Users\datel\WorkBuddy\2026-05-14-task-1

git init
git add .
git commit -m "first commit"

git remote add origin https://github.com/你的用户名/user-auth-app.git
git branch -M main
git push -u origin main
```

> 💡 如果电脑没有装 git，先去 https://git-scm.com 下载安装。

---

## 🚀 第二步：开通 CloudBase

1. 打开浏览器进入 **腾讯云 CloudBase 控制台**
   👉 https://console.cloud.tencent.com/tcb

2. 点击 **新建环境**
   - 环境名称：`user-auth`（或你喜欢的名字）
   - 选择 **按量计费**（有免费额度）
   - 点击确定，等待环境创建完成（约1分钟）

---

## 🚀 第三步：创建 MySQL 数据库（TDSQL-C）

1. 在 CloudBase 控制台左侧菜单，点击 **数据库**
2. 切换到 **TDSQL-C** 标签页
3. 点击 **新建**

   | 配置项 | 填写 |
   |--------|------|
   | 数据库类型 | MySQL 8.0 |
   | 规格 | 最小配置（共享CPU 0.25核 + 1GB内存）即可，以后可以扩容 |
   | 存储 | 按量计费，默认20GB |
   | 用户名 | 默认 root |
   | 密码 | **自己设置一个，记下来！** 例如 `MyPwd2026!` |

4. 创建成功后，找到 **内网地址**（类似 `10.x.x.x:3306`），复制下来

5. 点击 **数据库管理** → 新建数据库
   - 数据库名：`user_auth`
   - 字符集：`utf8mb4`

---

## 🚀 第四步：部署云托管服务

### 4.1 开通云托管

在 CloudBase 控制台左侧菜单，点击 **云托管**

- 如果是首次使用，会提示开通，按引导操作即可
- 建议选择 **默认配置**，按量计费

### 4.2 新建服务

点击 **新建服务**，填写：

| 配置项 | 填写 |
|--------|------|
| 服务名称 | `user-auth-app` |
| 部署方式 | **GitHub 仓库** ⭐（推荐） |
| 代码仓库 | 选择你刚推的那个仓库 |
| 分支 | `main` |
| Dockerfile 路径 | `./Dockerfile` |
| 监听端口 | `3000` |
| 版本号 | 自动生成 |
| 流量策略 | 按比例（先默认100%） |

### 4.3 配置环境变量

在"高级设置"中，添加以下环境变量：

| 变量名 | 值 |
|--------|-----|
| `MYSQL_HOST` | **TDSQL-C 内网地址**（不要含端口） |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | `root` |
| `MYSQL_PASSWORD` | **你刚才设置的数据库密码** |
| `MYSQL_DATABASE` | `user_auth` |
| `SESSION_SECRET` | 随便填一个复杂字符串 |

### 4.4 部署

点击 **确定**，CloudBase 会自动：
1. 从 GitHub 拉取代码
2. 构建 Docker 镜像
3. 推送到服务
4. 启动容器

等待部署完成（约 3-5 分钟），状态变为 **运行中**。

---

## 🚀 第五步：访问你的应用

部署完成后，在服务详情页可以看到 **访问域名**（类似 `https://xxx-xxx-xxx.ap-shanghai.app.tcloudbase.com`）

点击这个链接，你的注册登录系统就跑起来了！

> ⚠️ 有时候默认域名有访问限制，如果是测试用途可以用这个默认域名先试试。
> 如果遇到 "该域名未备案" 的问题，可以后置绑定自己的已备案域名。

---

## 🧹 常见问题

| 问题 | 解决 |
|------|------|
| 部署失败，提示连接数据库超时 | 检查环境变量中 `MYSQL_HOST` 是否为 **内网地址** |
| 默认域名打不开 | CloudBase 默认域名可能有访问策略，可以先试试绑定自定义域名 |
| 容器启动报错 `ECONNREFUSED` | MySQL 和云托管是否在 **同一个 CloudBase 环境** 下 |
| 想重置数据 | 进入 TDSQL-C 控制台执行 `DROP DATABASE user_auth; CREATE DATABASE user_auth;` |
