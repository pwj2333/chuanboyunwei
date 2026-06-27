const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

router.use(authenticateToken);

// 下载附件
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const attachment = await db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);

    if (!attachment) {
      return res.status(404).json({ error: '附件不存在' });
    }

    const filePath = attachment.filepath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    res.download(filePath, attachment.filename);
  } catch (error) {
    console.error('下载附件错误:', error);
    res.status(500).json({ error: '下载附件失败' });
  }
});

// 删除附件
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const attachment = await db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);

    if (!attachment) {
      return res.status(404).json({ error: '附件不存在' });
    }

    if (attachment.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权删除此附件' });
    }

    if (fs.existsSync(attachment.filepath)) {
      fs.unlinkSync(attachment.filepath);
    }

    await db.prepare('DELETE FROM attachments WHERE id = ?').run(id);

    res.json({ message: '附件删除成功' });
  } catch (error) {
    console.error('删除附件错误:', error);
    res.status(500).json({ error: '删除附件失败' });
  }
});

module.exports = router;
