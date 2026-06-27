const { db, initDatabase } = require('./database');
const bcrypt = require('bcryptjs');

// 初始化数据库并创建默认管理员账号
async function init() {
  console.log('开始初始化数据库...');

  try {
    await initDatabase();

    // 检查是否已存在管理员账号
    const existingAdmin = await db.prepare('SELECT * FROM users WHERE role = ?').get('admin');

    if (!existingAdmin) {
      console.log('创建默认管理员账号...');
      const passwordHash = await bcrypt.hash('admin123', 10);

      await db.prepare(`
        INSERT INTO users (username, password_hash, display_name, role)
        VALUES (?, ?, ?, ?)
      `).run('admin', passwordHash, '系统管理员', 'admin');

      console.log('默认管理员账号创建成功: admin / admin123');
    } else {
      console.log('管理员账号已存在');
    }

    console.log('数据库初始化完成！');
    db.close();
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  init().catch(console.error);
}

module.exports = { init };
