# 🚢 船舶运维事件督办系统

一个基于Vue3 + Node.js + SQLite的船舶运维事件管理系统，支持事件跟踪、知识图谱、AI总结和智能提醒。

## ✨ 核心功能

- **事件管理看板**：可视化看板展示待处理/进行中/已完成事件
- **事件链条**：支持父子事件关联，形成事件依赖树
- **跟进记录**：为每个事件添加跟进记录和附件
- **AI知识图谱**：归档时自动生成AI总结，沉淀运维经验
- **智能检索**：新建事件时自动推荐相似历史事件
- **多用户协作**：支持用户登录和权限管理
- **机器人通知**：支持企业微信/飞书机器人定时提醒
- **文件附件**：支持上传图片和文档附件

## 🛠 技术栈

### 后端
- Node.js + Express
- SQLite3 + better-sqlite3
- JWT认证
- Multer文件上传
- Node-cron定时任务

### 前端
- Vue 3 + Vite
- Element Plus UI
- Pinia状态管理
- Vue Router
- Axios

### 部署
- Docker + Docker Compose

## 📦 快速开始

### 方式一：Docker部署（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd 船舶运维
```

2. **配置环境变量**
```bash
# 可选：修改JWT密钥
export JWT_SECRET=your-secret-key
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **访问系统**
- 前端地址：http://localhost
- 后端API：http://localhost:3000
- 默认管理员账号：`admin` / `admin123`

### 方式二：本地开发

#### 后端启动

```bash
cd backend
npm install
npm run init-db  # 初始化数据库
npm run dev      # 开发模式
# 或
npm start        # 生产模式
```

#### 前端启动

```bash
cd frontend
npm install
npm run dev      # 开发模式
# 或
npm run build    # 构建生产版本
npm run preview  # 预览生产版本
```

## 📖 使用说明

### 1. 初始配置

首次使用需要完成以下配置：

#### AI配置
1. 进入"系统设置" -> "AI配置"
2. 填写OpenAI兼容API信息：
   - API Base URL：如 `https://api.openai.com/v1`
   - API Key：你的API密钥
   - 模型名称：如 `gpt-3.5-turbo`
3. 点击"测试连接"验证配置
4. 保存配置

#### 机器人通知配置（可选）
1. 进入"系统设置" -> "机器人通知"
2. 添加企业微信或飞书机器人
3. 填写Webhook URL
4. 测试发送

### 2. 事件管理流程

#### 创建事件
1. 在看板页面点击"新建事件"
2. 选择船舶、填写标题和描述
3. 设置优先级和督办时间
4. 系统会自动搜索相似历史事件供参考

#### 跟进记录
1. 进入事件详情页
2. 点击"添加记录"
3. 填写跟进内容，可上传附件
4. 记录会按时间线展示

#### 事件归档
1. 将事件状态改为"已完成"
2. 点击"归档并生成AI总结"
3. AI会自动分析事件过程生成总结
4. 归档后的事件进入知识库

### 3. 知识传承

- **自动检索**：新建事件时，系统自动搜索相似历史案例
- **AI总结**：归档时提取关键信息、问题类型、解决方案
- **经验沉淀**：形成知识图谱，新人可快速学习

### 4. 用户管理（管理员）

1. 进入"用户管理"
2. 创建新用户，设置角色
   - 普通用户：查看和创建事件
   - 管理员：完整权限

## 🔧 系统配置

### 环境变量

后端支持以下环境变量（在`.env`文件或Docker环境中配置）：

```bash
# 服务端口
PORT=3000

# JWT密钥（生产环境务必修改）
JWT_SECRET=your-secret-key

# 前端地址（用于机器人通知链接）
FRONTEND_URL=http://localhost

# 运行环境
NODE_ENV=production
```

### 数据持久化

Docker部署时，数据自动持久化到以下目录：
- 数据库：`./backend/data/maintenance.db`
- 附件：`./backend/uploads/`

## 📁 项目结构

```
船舶运维/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── db/             # 数据库
│   │   ├── middleware/     # 中间件
│   │   ├── routes/         # 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── jobs/           # 定时任务
│   │   └── server.js       # 入口文件
│   ├── data/               # 数据库文件
│   ├── uploads/            # 上传文件
│   └── Dockerfile
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── api/           # API封装
│   │   ├── components/    # 组件
│   │   ├── views/         # 页面
│   │   ├── stores/        # 状态管理
│   │   └── router/        # 路由
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml      # Docker编排
└── README.md
```

## 🔐 安全建议

1. **修改默认密码**：首次登录后立即修改admin密码
2. **更换JWT密钥**：生产环境使用强随机密钥
3. **HTTPS部署**：生产环境建议使用HTTPS
4. **定期备份**：定期备份`backend/data/maintenance.db`数据库文件

## 🚀 生产部署建议

### 使用Nginx反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 定期备份脚本

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backup/ship-maintenance

mkdir -p $BACKUP_DIR
cp ./backend/data/maintenance.db $BACKUP_DIR/maintenance_$DATE.db
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz ./backend/uploads/

# 保留最近30天的备份
find $BACKUP_DIR -name "maintenance_*.db" -mtime +30 -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +30 -delete
```

## 🐛 常见问题

### 1. AI总结失败
- 检查AI配置是否正确
- 确认API Key有效且有余额
- 检查网络是否可以访问API地址

### 2. 文件上传失败
- 检查文件大小是否超过10MB
- 确认文件格式是否支持
- 检查uploads目录权限

### 3. 机器人通知不工作
- 检查Webhook URL是否正确
- 确认机器人已启用
- 查看后端日志排查错误

### 4. Docker容器无法启动
```bash
# 查看日志
docker-compose logs backend
docker-compose logs frontend

# 重新构建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📝 API文档

系统提供RESTful API，主要接口包括：

### 认证
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户

### 事件
- `GET /api/events` - 获取事件列表
- `POST /api/events` - 创建事件
- `GET /api/events/:id` - 获取事件详情
- `PATCH /api/events/:id` - 更新事件
- `POST /api/events/:id/archive` - 归档事件

### 记录
- `GET /api/records/:eventId` - 获取事件记录
- `POST /api/records/:eventId` - 添加记录

### 知识库
- `POST /api/knowledge/search` - 搜索相似事件
- `GET /api/knowledge/:eventId` - 获取知识条目

### 配置
- `GET /api/config/ai` - 获取AI配置
- `POST /api/config/ai` - 保存AI配置
- `GET /api/config/bots` - 获取机器人列表

## 🤝 开发指南

### 添加新功能

1. 后端添加路由和服务
2. 前端添加API调用
3. 创建或修改Vue组件
4. 更新数据库schema（如需要）

### 代码规范

- 后端：使用ES6+语法，遵循Express最佳实践
- 前端：使用Vue 3 Composition API
- 提交信息：使用清晰的commit message

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交Issue和Pull Request！

## 📧 联系方式

如有问题或建议，请通过以下方式联系：
- 提交Issue
- 发送邮件

---

**祝使用愉快！** 🎉
