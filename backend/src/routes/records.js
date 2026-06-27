const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

// 获取事件的所有记录
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const records = await db.prepare(`
      SELECT
        er.*,
        u.display_name as operator
      FROM event_records er
      LEFT JOIN users u ON er.operator_id = u.id
      WHERE er.event_id = ?
      ORDER BY er.created_at DESC
    `).all(eventId);

    // 获取每条记录的附件
    for (const record of records) {
      record.attachments = await db.prepare(`
        SELECT id, filename, filesize, mimetype, created_at
        FROM attachments
        WHERE record_id = ?
      `).all(record.id);
    }

    res.json(records);
  } catch (error) {
    console.error('获取记录列表错误:', error);
    res.status(500).json({ error: '获取记录列表失败' });
  }
});

// 添加新记录（支持附件上传）
router.post('/:eventId', upload.array('attachments', 5), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: '记录内容不能为空' });
    }

    const result = await db.prepare(`
      INSERT INTO event_records (event_id, content, operator_id)
      VALUES (?, ?, ?)
    `).run(eventId, content, req.user.id);

    const recordId = result.lastInsertRowid;

    // 处理附件
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.prepare(`
          INSERT INTO attachments (record_id, filename, filepath, filesize, mimetype, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          recordId,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          req.user.id
        );

        attachments.push({
          filename: file.originalname,
          filesize: file.size,
          mimetype: file.mimetype
        });
      }
    }

    // 更新事件的updated_at
    await db.prepare('UPDATE events SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(eventId);

    const record = await db.prepare(`
      SELECT
        er.*,
        u.display_name as operator
      FROM event_records er
      LEFT JOIN users u ON er.operator_id = u.id
      WHERE er.id = ?
    `).get(recordId);

    res.status(201).json({
      ...(record || {
        id: recordId,
        event_id: Number(eventId),
        content,
        operator_id: req.user.id,
        operator: req.user.display_name || req.user.username || '系统用户',
        created_at: new Date().toISOString()
      }),
      attachments
    });

  } catch (error) {
    console.error('添加记录错误:', error);
    res.status(500).json({ error: '添加记录失败' });
  }
});

// 修改记录
router.patch('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: '记录内容不能为空' });
    }

    const record = await db.prepare(`
      SELECT id, operator_id
      FROM event_records
      WHERE id = ?
    `).get(recordId);

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    if (req.user.role !== 'admin' && record.operator_id !== req.user.id) {
      return res.status(403).json({ error: '无权修改该记录' });
    }

    await db.prepare(`
      UPDATE event_records
      SET content = ?, created_at = created_at
      WHERE id = ?
    `).run(String(content).trim(), recordId);

    const updatedRecord = await db.prepare(`
      SELECT
        er.*,
        u.display_name as operator
      FROM event_records er
      LEFT JOIN users u ON er.operator_id = u.id
      WHERE er.id = ?
    `).get(recordId);

    updatedRecord.attachments = await db.prepare(`
      SELECT id, filename, filesize, mimetype, created_at
      FROM attachments
      WHERE record_id = ?
    `).all(recordId);

    res.json(updatedRecord);
  } catch (error) {
    console.error('修改记录错误:', error);
    res.status(500).json({ error: '修改记录失败' });
  }
});

// 删除记录
router.delete('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await db.prepare(`
      SELECT id, event_id, operator_id
      FROM event_records
      WHERE id = ?
    `).get(recordId);

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    if (req.user.role !== 'admin' && record.operator_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除该记录' });
    }

    await db.prepare('DELETE FROM event_records WHERE id = ?').run(recordId);
    await db.prepare('UPDATE events SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(record.event_id);

    res.json({ success: true });
  } catch (error) {
    console.error('删除记录错误:', error);
    res.status(500).json({ error: '删除记录失败' });
  }
});

module.exports = router;
