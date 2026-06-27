const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const scope = req.query.scope;
    const rows = await db.prepare(`
      SELECT
        et.*,
        COUNT(e.id) as event_count
      FROM event_types et
      LEFT JOIN events e ON e.event_type_id = et.id
      WHERE (? IS NULL OR et.scope = ?)
      GROUP BY et.id
      ORDER BY et.created_at DESC
    `).all(scope || null, scope || null);

    res.json(rows);
  } catch (error) {
    console.error('获取事件类型列表错误:', error);
    res.status(500).json({ error: '获取事件类型列表失败' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const scope = req.body.scope === 'branch' ? 'branch' : 'main';

    if (!name) {
      return res.status(400).json({ error: '事件类型名称不能为空' });
    }

    const existing = await db.prepare('SELECT id FROM event_types WHERE name = ? AND scope = ?').get(name, scope);
    if (existing) {
      return res.status(400).json({ error: '该作用域下的事件类型已存在' });
    }

    const result = await db.prepare('INSERT INTO event_types (name, scope) VALUES (?, ?)').run(name, scope);
    const row = await db.prepare('SELECT * FROM event_types WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(row);
  } catch (error) {
    console.error('创建事件类型错误:', error);
    res.status(500).json({ error: '创建事件类型失败' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('UPDATE events SET event_type_id = NULL WHERE event_type_id = ?').run(id);
    await db.prepare('DELETE FROM event_types WHERE id = ?').run(id);
    res.json({ message: '事件类型删除成功' });
  } catch (error) {
    console.error('删除事件类型错误:', error);
    res.status(500).json({ error: '删除事件类型失败' });
  }
});

module.exports = router;
