const axios = require('axios');
const { db } = require('../db/database');

async function sendReminder(event, botConfig) {
  const message = formatMessage(event, botConfig.bot_type);

  try {
    await axios.post(botConfig.webhook_url, message, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return { success: true };
  } catch (error) {
    console.error('机器人通知发送失败:', error.message);
    return { success: false, error: error.message };
  }
}

async function testBotConnection(botConfig) {
  const testMessage = formatMessage({
    title: '测试消息',
    ship_name: '测试船舶',
    priority: 'medium',
    due_date: new Date().toISOString(),
    operator: '系统测试',
    id: 0
  }, botConfig.bot_type);

  try {
    await axios.post(botConfig.webhook_url, testMessage, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return { success: true, message: '连接成功' };
  } catch (error) {
    return { success: false, message: error.response?.data?.errmsg || error.message };
  }
}

function formatMessage(event, botType) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (botType === 'wechat_work') {
    const priorityEmoji = event.priority === 'high' ? '🔴' : event.priority === 'medium' ? '🟡' : '🟢';
    return {
      msgtype: 'markdown',
      markdown: {
        content: `## 船舶运维事件提醒
> **${event.title}**
> 船舶：${event.ship_name}
> 优先级：${priorityEmoji} ${event.priority === 'high' ? '高' : event.priority === 'medium' ? '中' : '低'}
> 到期时间：<font color="warning">${new Date(event.due_date).toLocaleString('zh-CN')}</font>
> 负责人：${event.operator || '未指定'}

[点击查看详情](${frontendUrl}/events/${event.id})`
      }
    };
  } else if (botType === 'feishu') {
    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: { content: '船舶运维事件提醒', tag: 'plain_text' },
          template: event.priority === 'high' ? 'red' : event.priority === 'medium' ? 'orange' : 'blue'
        },
        elements: [
          { tag: 'div', text: { content: `**事件：**${event.title}`, tag: 'lark_md' }},
          { tag: 'div', text: { content: `**船舶：**${event.ship_name}`, tag: 'lark_md' }},
          { tag: 'div', text: { content: `**优先级：**${event.priority === 'high' ? '高' : event.priority === 'medium' ? '中' : '低'}`, tag: 'lark_md' }},
          { tag: 'div', text: { content: `**到期时间：**${new Date(event.due_date).toLocaleString('zh-CN')}`, tag: 'lark_md' }},
          {
            tag: 'action',
            actions: [{
              tag: 'button',
              text: { content: '查看详情', tag: 'plain_text' },
              url: `${frontendUrl}/events/${event.id}`,
              type: 'primary'
            }]
          }
        ]
      }
    };
  }
}

module.exports = { sendReminder, testBotConnection };
