const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { testAIConnection } = require('../services/aiService');
const { testBotConnection } = require('../services/notificationService');

router.use(authenticateToken);

// ========== AI配置 ==========

// 获取AI配置
router.get('/ai', async (req, res) => {
  try {
    const config = await db.prepare('SELECT * FROM ai_config WHERE id = 1').get();

    if (!config) {
      return res.json(null);
    }

    // 不返回完整的API Key，只返回部分
    config.api_key = config.api_key ? '***' + config.api_key.slice(-4) : '';

    res.json(config);
  } catch (error) {
    console.error('获取AI配置错误:', error);
    res.status(500).json({ error: '获取AI配置失败' });
  }
});

// 保存AI配置（仅管理员）
router.post('/ai', requireAdmin, async (req, res) => {
  try {
    const { api_base_url, api_key, model_name, temperature, max_tokens } = req.body;

    if (!api_base_url || !api_key) {
      return res.status(400).json({ error: 'API Base URL和API Key不能为空' });
    }

    const existing = await db.prepare('SELECT id FROM ai_config WHERE id = 1').get();

    if (existing) {
      await db.prepare(`
        UPDATE ai_config
        SET api_base_url = ?, api_key = ?, model_name = ?, temperature = ?, max_tokens = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(api_base_url, api_key, model_name || 'gpt-3.5-turbo', temperature || 0.7, max_tokens || 2000);
    } else {
      await db.prepare(`
        INSERT INTO ai_config (id, api_base_url, api_key, model_name, temperature, max_tokens)
        VALUES (1, ?, ?, ?, ?, ?)
      `).run(api_base_url, api_key, model_name || 'gpt-3.5-turbo', temperature || 0.7, max_tokens || 2000);
    }

    res.json({ message: 'AI配置保存成功' });
  } catch (error) {
    console.error('保存AI配置错误:', error);
    res.status(500).json({ error: '保存AI配置失败' });
  }
});

// 测试AI连接
router.post('/ai/test', async (req, res) => {
  try {
    const { api_base_url, api_key, model_name } = req.body;

    if (!api_base_url || !api_key) {
      return res.status(400).json({ error: 'API Base URL和API Key不能为空' });
    }

    const result = await testAIConnection({
      api_base_url,
      api_key,
      model_name: model_name || 'gpt-3.5-turbo'
    });

    res.json(result);
  } catch (error) {
    console.error('测试AI连接错误:', error);
    res.status(500).json({ error: '测试失败' });
  }
});

router.get('/assistant-skill', async (req, res) => {
  try {
    const config = await db.prepare('SELECT prompt_text, updated_at FROM assistant_skill_config WHERE id = 1').get();
    res.json(config || null);
  } catch (error) {
    console.error('获取AI问答Skill错误:', error);
    res.status(500).json({ error: '获取AI问答Skill失败' });
  }
});

router.post('/assistant-skill', requireAdmin, async (req, res) => {
  try {
    const promptText = String(req.body?.prompt_text || '').trim();

    if (!promptText) {
      return res.status(400).json({ error: 'Skill提示词不能为空' });
    }

    await db.prepare(`
      INSERT INTO assistant_skill_config (id, prompt_text, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        prompt_text = excluded.prompt_text,
        updated_at = CURRENT_TIMESTAMP
    `).run(promptText);

    const config = await db.prepare('SELECT prompt_text, updated_at FROM assistant_skill_config WHERE id = 1').get();
    res.json(config);
  } catch (error) {
    console.error('保存AI问答Skill错误:', error);
    res.status(500).json({ error: '保存AI问答Skill失败' });
  }
});

// ========== 机器人配置 ==========

// 获取机器人配置列表
router.get('/bots', async (req, res) => {
  try {
    const bots = await db.prepare('SELECT * FROM bot_config ORDER BY created_at DESC').all();
    res.json(bots);
  } catch (error) {
    console.error('获取机器人配置错误:', error);
    res.status(500).json({ error: '获取机器人配置失败' });
  }
});

// 添加机器人配置（仅管理员）
router.post('/bots', requireAdmin, async (req, res) => {
  try {
    const { bot_type, webhook_url, enabled } = req.body;

    if (!bot_type || !webhook_url) {
      return res.status(400).json({ error: '机器人类型和Webhook URL不能为空' });
    }

    const result = await db.prepare(`
      INSERT INTO bot_config (bot_type, webhook_url, enabled)
      VALUES (?, ?, ?)
    `).run(bot_type, webhook_url, enabled !== undefined ? enabled : 1);

    const bot = await db.prepare('SELECT * FROM bot_config WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(bot);
  } catch (error) {
    console.error('添加机器人配置错误:', error);
    res.status(500).json({ error: '添加机器人配置失败' });
  }
});

// 更新机器人配置（仅管理员）
router.patch('/bots/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { bot_type, webhook_url, enabled } = req.body;

    const updates = [];
    const params = [];

    if (bot_type !== undefined) {
      updates.push('bot_type = ?');
      params.push(bot_type);
    }
    if (webhook_url !== undefined) {
      updates.push('webhook_url = ?');
      params.push(webhook_url);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled);
    }

    params.push(id);

    await db.prepare(`UPDATE bot_config SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const bot = await db.prepare('SELECT * FROM bot_config WHERE id = ?').get(id);

    res.json(bot);
  } catch (error) {
    console.error('更新机器人配置错误:', error);
    res.status(500).json({ error: '更新机器人配置失败' });
  }
});

// 删除机器人配置（仅管理员）
router.delete('/bots/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await db.prepare('DELETE FROM bot_config WHERE id = ?').run(id);

    res.json({ message: '机器人配置删除成功' });
  } catch (error) {
    console.error('删除机器人配置错误:', error);
    res.status(500).json({ error: '删除机器人配置失败' });
  }
});

// 测试机器人连接
router.post('/bots/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    const bot = await db.prepare('SELECT * FROM bot_config WHERE id = ?').get(id);

    if (!bot) {
      return res.status(404).json({ error: '机器人配置不存在' });
    }

    const result = await testBotConnection(bot);

    res.json(result);
  } catch (error) {
    console.error('测试机器人连接错误:', error);
    res.status(500).json({ error: '测试失败' });
  }
});

module.exports = router;
