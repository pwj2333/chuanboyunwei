require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');
const { startReminderJob } = require('./jobs/reminderJob');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（上传的附件）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ships', require('./routes/ships'));
app.use('/api/event-types', require('./routes/eventTypes'));
app.use('/api/events', require('./routes/events'));
app.use('/api/records', require('./routes/records'));
app.use('/api/attachments', require('./routes/attachments'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/config', require('./routes/config'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

// 启动服务器
async function start() {
  try {
    // 初始化数据库
    console.log('初始化数据库...');
    await initDatabase();

    // 启动定时任务
    startReminderJob();

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`🚢 船舶运维事件督办系统后端已启动`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
