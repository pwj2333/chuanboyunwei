const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// 获取船舶列表
router.get('/', async (req, res) => {
  try {
    const ships = await db.prepare(`
      SELECT s.*, COUNT(e.id) as event_count
      FROM ships s
      LEFT JOIN events e ON s.id = e.ship_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all();

    res.json(ships);
  } catch (error) {
    console.error('获取船舶列表错误:', error);
    res.status(500).json({ error: '获取船舶列表失败' });
  }
});

// 添加新船舶
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: '船舶名称不能为空' });
    }

    const existing = await db.prepare('SELECT id FROM ships WHERE name = ?').get(name);

    if (existing) {
      return res.status(400).json({ error: '船舶名称已存在' });
    }

    const result = await db.prepare('INSERT INTO ships (name) VALUES (?)').run(name);
    const ship = await db.prepare('SELECT * FROM ships WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(ship);
  } catch (error) {
    console.error('添加船舶错误:', error);
    res.status(500).json({ error: '添加船舶失败' });
  }
});

module.exports = router;
