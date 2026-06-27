const cron = require('node-cron');
const { db } = require('../db/database');
const { sendReminder } = require('../services/notificationService');

function startReminderJob() {
  // 每天9:00执行
  cron.schedule('0 9 * * *', async () => {
    console.log('开始执行事件提醒任务...');

    try {
      // 获取启用的机器人配置
      const bots = await db.prepare('SELECT * FROM bot_config WHERE enabled = 1').all();

      if (bots.length === 0) {
        console.log('没有启用的机器人配置');
        return;
      }

      // 获取24小时内到期且未归档的事件
      const events = await db.prepare(`
        SELECT
          e.*,
          s.name as ship_name,
          u.display_name as operator
        FROM events e
        JOIN ships s ON e.ship_id = s.id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.status != 'archived'
          AND e.due_date IS NOT NULL
          AND e.due_date <= datetime('now', '+24 hours')
          AND e.due_date >= datetime('now')
      `).all();

      console.log(`找到 ${events.length} 个即将到期的事件`);

      // 发送提醒
      for (const event of events) {
        for (const bot of bots) {
          const result = await sendReminder(event, bot);
          if (result.success) {
            console.log(`事件 ${event.id} 提醒发送成功 (${bot.bot_type})`);
          } else {
            console.error(`事件 ${event.id} 提醒发送失败 (${bot.bot_type}):`, result.error);
          }
        }
      }

      console.log('事件提醒任务执行完成');
    } catch (error) {
      console.error('事件提醒任务执行错误:', error);
    }
  });

  console.log('定时提醒任务已启动（每天9:00执行）');
}

module.exports = { startReminderJob };
