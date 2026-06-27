const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireAdmin);

// 获取用户列表
router.get('/', async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT id, username, display_name, role, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json(users);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 创建新用户
router.post('/', async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body;

    if (!username || !password || !display_name) {
      return res.status(400).json({ error: '用户名、密码和显示名称不能为空' });
    }

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);

    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role)
      VALUES (?, ?, ?, ?)
    `).run(username, passwordHash, display_name, role || 'user');

    const user = await db.prepare(`
      SELECT id, username, display_name, role, created_at
      FROM users
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(user);
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// 更新用户信息
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, role, password } = req.body;

    const updates = [];
    const params = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(display_name);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    params.push(id);

    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = await db.prepare(`
      SELECT id, username, display_name, role, created_at
      FROM users
      WHERE id = ?
    `).get(id);

    res.json(user);
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// 删除用户
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能删除当前登录用户' });
    }

    await db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

module.exports = router;
