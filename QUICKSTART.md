# 船舶运维事件督办系统 - 快速启动指南

## 快速启动步骤

### 1. Docker部署（推荐，一键启动）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问 http://localhost，默认账号 `admin` / `admin123`

### 2. 本地开发模式

**后端启动：**
```bash
cd backend
npm install
npm run init-db  # 初始化数据库和管理员账号
npm run dev
```

**前端启动：**
```bash
cd frontend  
npm install
npm run dev
```

访问 http://localhost:5173

## 首次使用配置

1. 登录系统（admin / admin123）
2. 进入"系统设置"配置AI（必需）：
   - API Base URL: `https://api.openai.com/v1`
   - API Key: 你的OpenAI API Key
   - 测试连接确认配置正确
3. 添加船舶
4. 创建第一个事件

## 主要功能使用

### 创建事件
看板 -> 新建事件 -> 填写信息 -> 创建

### 添加跟进记录
事件详情 -> 添加记录 -> 输入内容（可上传附件）

### 归档并生成AI总结
事件详情 -> 改为"已完成" -> 归档并生成AI总结

### 查看相似历史事件
新建事件时右侧自动显示相关历史案例

## 故障排查

**端口冲突：**
修改 docker-compose.yml 中的端口映射

**数据库初始化失败：**
```bash
cd backend
node src/db/init.js
```

**前端无法连接后端：**
检查 frontend/vite.config.js 中的 proxy 配置

## 数据备份

重要数据位置：
- 数据库：`backend/data/maintenance.db`
- 附件：`backend/uploads/`

定期备份这两个目录即可。
