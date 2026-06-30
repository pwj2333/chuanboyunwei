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
      ORDER BY
        CASE WHEN s.display_order IS NULL THEN 1 ELSE 0 END,
        s.display_order ASC,
        s.created_at DESC
    `).all();

    res.json(ships);
  } catch (error) {
    console.error('获取船舶列表错误:', error);
    res.status(500).json({ error: '获取船舶列表失败' });
  }
});

// 添加新船舶
// Update global ship display order.
router.patch('/order', async (req, res) => {
  try {
    const { shipIds } = req.body || {};

    if (!Array.isArray(shipIds)) {
      return res.status(400).json({ error: 'shipIds must be an array' });
    }

    const normalizedIds = shipIds.map((id) => Number(id));
    const hasInvalidId = normalizedIds.some((id) => !Number.isInteger(id) || id <= 0);
    const uniqueIds = new Set(normalizedIds);

    if (hasInvalidId || uniqueIds.size !== normalizedIds.length) {
      return res.status(400).json({ error: 'shipIds must contain unique numeric ship ids' });
    }

    if (normalizedIds.length > 0) {
      const placeholders = normalizedIds.map(() => '?').join(', ');
      const rows = await db.prepare(`SELECT id FROM ships WHERE id IN (${placeholders})`).all(...normalizedIds);

      if (rows.length !== normalizedIds.length) {
        return res.status(400).json({ error: 'shipIds contains unknown ship id' });
      }
    }

    await db.prepare('UPDATE ships SET display_order = NULL').run();

    for (const [index, shipId] of normalizedIds.entries()) {
      await db.prepare('UPDATE ships SET display_order = ? WHERE id = ?').run(index + 1, shipId);
    }

    const orderedShips = await db.prepare(`
      SELECT s.*, COUNT(e.id) as event_count
      FROM ships s
      LEFT JOIN events e ON s.id = e.ship_id
      GROUP BY s.id
      ORDER BY
        CASE WHEN s.display_order IS NULL THEN 1 ELSE 0 END,
        s.display_order ASC,
        s.created_at DESC
    `).all();

    res.json(orderedShips);
  } catch (error) {
    console.error('更新船舶排序错误:', error);
    res.status(500).json({ error: '更新船舶排序失败' });
  }
});

// Create a new ship.
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
