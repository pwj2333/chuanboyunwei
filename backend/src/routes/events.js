const express = require('express');

const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { summarizeEvent } = require('../services/aiService');
const { createKnowledgeEntry } = require('../services/knowledgeService');

const archiveJobs = new Set();

router.use(authenticateToken);

async function loadEventById(id) {
  return db.prepare(`
    SELECT
      e.*,
      s.name as ship_name,
      et.name as event_type_name,
      u.display_name as creator_name,
      (
        SELECT COUNT(*)
        FROM event_records er
        WHERE er.event_id = e.id
      ) as record_count
    FROM events e
    LEFT JOIN ships s ON e.ship_id = s.id
    LEFT JOIN event_types et ON e.event_type_id = et.id
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.id = ?
  `).get(id);
}

async function loadEventTypeById(id) {
  if (!id) {
    return null;
  }

  return db.prepare(`
    SELECT id, name, scope
    FROM event_types
    WHERE id = ?
  `).get(id);
}

async function buildArchivePayload(id) {
  const branchEvents = await db.prepare(`
    WITH RECURSIVE event_tree AS (
      SELECT e.*, 0 as depth
      FROM events e
      WHERE e.id = ?
      UNION ALL
      SELECT e.*, et.depth + 1
      FROM events e
      JOIN event_tree et ON e.parent_event_id = et.id
    )
    SELECT
      et.*,
      s.name as ship_name,
      ty.name as event_type_name,
      u.display_name as creator_name
    FROM event_tree et
    JOIN ships s ON et.ship_id = s.id
    LEFT JOIN event_types ty ON et.event_type_id = ty.id
    LEFT JOIN users u ON et.created_by = u.id
    ORDER BY et.depth, et.created_at
  `).all(id);

  const event = branchEvents[0];
  if (!event) {
    return null;
  }

  const records = await db.prepare(`
    WITH RECURSIVE event_tree AS (
      SELECT id, title, 0 as depth
      FROM events
      WHERE id = ?
      UNION ALL
      SELECT e.id, e.title, et.depth + 1
      FROM events e
      JOIN event_tree et ON e.parent_event_id = et.id
    )
    SELECT
      er.*,
      et.title as event_title,
      et.depth as event_depth,
      u.display_name as operator
    FROM event_records er
    JOIN event_tree et ON er.event_id = et.id
    LEFT JOIN users u ON er.operator_id = u.id
    ORDER BY et.depth, er.created_at
  `).all(id);

  const attachments = await db.prepare(`
    WITH RECURSIVE event_tree AS (
      SELECT id
      FROM events
      WHERE id = ?
      UNION ALL
      SELECT e.id
      FROM events e
      JOIN event_tree et ON e.parent_event_id = et.id
    )
    SELECT a.*
    FROM attachments a
    JOIN event_records er ON a.record_id = er.id
    JOIN event_tree et ON er.event_id = et.id
  `).all(id);

  return {
    ...event,
    branch_events: branchEvents,
    records,
    attachments
  };
}

async function runArchiveSummaryJob(id) {
  if (archiveJobs.has(id)) {
    return;
  }

  archiveJobs.add(id);

  try {
    const existingKnowledge = await db.prepare(`
      SELECT event_id
      FROM knowledge_base
      WHERE event_id = ?
    `).get(id);

    if (existingKnowledge) {
      return;
    }

    const eventData = await buildArchivePayload(id);
    if (!eventData) {
      return;
    }

    const aiSummary = await summarizeEvent(eventData);
    await createKnowledgeEntry(id, aiSummary);
  } catch (error) {
    // ponytail: keep archive non-blocking for operators; add a durable job table only if retries must survive process restarts.
    console.error('Archive summary background job failed:', error);
  } finally {
    archiveJobs.delete(id);
  }
}

router.get('/', async (req, res) => {
  try {
    const { shipId, priority, status, eventTypeId } = req.query;
    let sql = `
      SELECT
        e.*,
        s.name as ship_name,
        et.name as event_type_name,
        u.display_name as creator_name,
        (
          SELECT COUNT(*)
          FROM event_records er
          WHERE er.event_id = e.id
        ) as record_count
      FROM events e
      LEFT JOIN ships s ON e.ship_id = s.id
      LEFT JOIN event_types et ON e.event_type_id = et.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1 = 1
    `;
    const params = [];

    if (shipId) {
      sql += ' AND e.ship_id = ?';
      params.push(shipId);
    }
    if (priority) {
      sql += ' AND e.priority = ?';
      params.push(priority);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (eventTypeId) {
      sql += ' AND e.event_type_id = ?';
      params.push(eventTypeId);
    }

    sql += ' ORDER BY e.created_at DESC';

    const events = await db.prepare(sql).all(...params);
    res.json(events);
  } catch (error) {
    console.error('Get events failed:', error);
    res.status(500).json({ error: '获取事件列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const eventTree = await db.prepare(`
      WITH RECURSIVE ancestor_chain AS (
        SELECT *
        FROM events
        WHERE id = ?
        UNION ALL
        SELECT e.*
        FROM events e
        JOIN ancestor_chain ac ON ac.parent_event_id = e.id
      ),
      root_event AS (
        SELECT id
        FROM ancestor_chain
        ORDER BY CASE WHEN parent_event_id IS NULL THEN 0 ELSE 1 END, created_at ASC
        LIMIT 1
      ),
      event_tree AS (
        SELECT e.*, 0 as depth
        FROM events e
        JOIN root_event r ON e.id = r.id
        UNION ALL
        SELECT e.*, et.depth + 1
        FROM events e
        JOIN event_tree et ON e.parent_event_id = et.id
      )
      SELECT
        et.*,
        s.name as ship_name,
        ty.name as event_type_name,
        u.display_name as creator_name,
        (
          SELECT COUNT(*)
          FROM event_records er
          WHERE er.event_id = et.id
        ) as record_count
      FROM event_tree et
      LEFT JOIN ships s ON et.ship_id = s.id
      LEFT JOIN event_types ty ON et.event_type_id = ty.id
      LEFT JOIN users u ON et.created_by = u.id
      ORDER BY et.depth, et.created_at
    `).all(id);

    if (!eventTree.length) {
      return res.status(404).json({ error: '事件不存在' });
    }

    res.json(eventTree);
  } catch (error) {
    console.error('Get event detail failed:', error);
    res.status(500).json({ error: '获取事件详情失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { ship_id, event_type_id, parent_event_id, title, description, priority, due_date } = req.body;

    if (!ship_id || !title || !event_type_id) {
      return res.status(400).json({ error: '船舶、标题和事件标签不能为空' });
    }

    const eventType = await loadEventTypeById(event_type_id);
    if (!eventType) {
      return res.status(400).json({ error: '事件标签不存在' });
    }

    const expectedScope = parent_event_id ? 'branch' : 'main';
    if ((eventType.scope || 'main') !== expectedScope) {
      return res.status(400).json({ error: parent_event_id ? '分支事件必须选择分支事件标签' : '主事件必须选择主事件标签' });
    }

    const result = await db.prepare(`
      INSERT INTO events (ship_id, event_type_id, parent_event_id, title, description, priority, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ship_id,
      event_type_id,
      parent_event_id || null,
      title,
      description || null,
      priority || 'medium',
      due_date || null,
      req.user.id
    );

    const event = await loadEventById(result.lastInsertRowid);
    res.status(201).json(event);
  } catch (error) {
    console.error('Create event failed:', error);
    res.status(500).json({ error: '创建事件失败' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ship_id, event_type_id, title, description, priority, status, due_date } = req.body;

    const currentEvent = await db.prepare(`
      SELECT id, parent_event_id
      FROM events
      WHERE id = ?
    `).get(id);

    if (!currentEvent) {
      return res.status(404).json({ error: '事件不存在' });
    }

    if (status === 'archived') {
      return res.status(400).json({ error: '请通过归档操作归档主事件' });
    }

    if (event_type_id !== undefined && !event_type_id) {
      return res.status(400).json({ error: '事件标签不能为空' });
    }

    if (event_type_id !== undefined) {
      const eventType = await loadEventTypeById(event_type_id);
      if (!eventType) {
        return res.status(400).json({ error: '事件标签不存在' });
      }

      const expectedScope = currentEvent.parent_event_id ? 'branch' : 'main';
      if ((eventType.scope || 'main') !== expectedScope) {
        return res.status(400).json({ error: currentEvent.parent_event_id ? '分支事件必须选择分支事件标签' : '主事件必须选择主事件标签' });
      }
    }

    const updates = [];
    const params = [];

    if (ship_id !== undefined) {
      updates.push('ship_id = ?');
      params.push(ship_id);
    }
    if (event_type_id !== undefined) {
      updates.push('event_type_id = ?');
      params.push(event_type_id);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(due_date || null);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const event = await loadEventById(id);
    res.json(event);
  } catch (error) {
    console.error('Update event failed:', error);
    res.status(500).json({ error: '更新事件失败' });
  }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const rootEvent = await db.prepare(`
      SELECT id, parent_event_id, status
      FROM events
      WHERE id = ?
    `).get(id);

    if (!rootEvent) {
      return res.status(404).json({ error: '事件不存在' });
    }

    if (rootEvent.parent_event_id) {
      return res.status(400).json({ error: '只有主事件可以归档' });
    }

    const existingKnowledge = await db.prepare(`
      SELECT event_id
      FROM knowledge_base
      WHERE event_id = ?
    `).get(id);

    if (rootEvent.status === 'archived') {
      if (!existingKnowledge) {
        void runArchiveSummaryJob(id);
      }

      return res.json({
        message: existingKnowledge ? '事件已归档' : '事件已归档，AI总结正在后台生成',
        knowledge_pending: !existingKnowledge,
        event_id: Number(id)
      });
    }

    if (rootEvent.status !== 'completed') {
      return res.status(400).json({ error: '主事件完成后才可以归档' });
    }

    const activeBranch = await db.prepare(`
      WITH RECURSIVE event_tree AS (
        SELECT id, parent_event_id, status
        FROM events
        WHERE id = ?
        UNION ALL
        SELECT e.id, e.parent_event_id, e.status
        FROM events e
        JOIN event_tree et ON e.parent_event_id = et.id
      )
      SELECT id
      FROM event_tree
      WHERE id != ? AND status IN ('pending', 'in_progress')
      LIMIT 1
    `).get(id, id);

    if (activeBranch) {
      return res.status(400).json({ error: '请先完成全部分支后再归档主事件' });
    }

    await db.prepare(`
      UPDATE events
      SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    void runArchiveSummaryJob(id);

    res.json({
      message: '事件已归档，AI总结正在后台生成',
      knowledge_pending: true,
      event_id: Number(id)
    });
  } catch (error) {
    console.error('Archive event failed:', error);
    res.status(500).json({ error: error.message || '归档事件失败' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await db.prepare(`
      SELECT id
      FROM events
      WHERE id = ?
    `).get(id);

    if (!event) {
      return res.status(404).json({ error: '事件不存在' });
    }

    // ponytail: detach direct children and keep their subtree intact; switch to recursive delete only if product policy changes.
    await db.prepare(`
      UPDATE events
      SET parent_event_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE parent_event_id = ?
    `).run(id);

    await db.prepare(`
      DELETE FROM attachments
      WHERE record_id IN (
        SELECT id
        FROM event_records
        WHERE event_id = ?
      )
    `).run(id);

    await db.prepare('DELETE FROM event_records WHERE event_id = ?').run(id);
    await db.prepare('DELETE FROM knowledge_base WHERE event_id = ?').run(id);
    await db.prepare('DELETE FROM events WHERE id = ?').run(id);

    res.json({ message: '事件删除成功' });
  } catch (error) {
    console.error('Delete event failed:', error);
    res.status(500).json({ error: '删除事件失败' });
  }
});

module.exports = router;
