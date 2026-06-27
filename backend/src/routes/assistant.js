const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { searchAssistantContext } = require('../services/knowledgeService');
const { streamAssistantReply } = require('../services/aiService');

router.use(authenticateToken);

function sanitizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && String(item.content || '').trim())
    .map((item, index) => ({
      id: item.id || index + 1,
      role: item.role,
      content: String(item.content || '').trim()
    }));
}

function parseStoredMessages(messagesJson) {
  try {
    return sanitizeMessages(JSON.parse(messagesJson || '[]'));
  } catch {
    return [];
  }
}

function buildConversationTitle(messages) {
  const firstUserMessage = messages.find((item) => item.role === 'user')?.content || '新对话';
  return firstUserMessage.slice(0, 24) || '新对话';
}

function buildConversationPreview(messages) {
  const lastAssistantMessage = [...messages].reverse().find((item) => item.role === 'assistant')?.content;
  const lastUserMessage = [...messages].reverse().find((item) => item.role === 'user')?.content;
  return String(lastAssistantMessage || lastUserMessage || '').slice(0, 80);
}

async function saveConversationSnapshot(userId, conversationId, messages) {
  const sanitizedMessages = sanitizeMessages(messages);
  const title = buildConversationTitle(sanitizedMessages);
  const preview = buildConversationPreview(sanitizedMessages);
  const messagesJson = JSON.stringify(sanitizedMessages);
  const messageCount = sanitizedMessages.length;

  if (conversationId) {
    await db.prepare(`
      UPDATE assistant_conversations
      SET title = ?, preview = ?, messages_json = ?, message_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(title, preview, messagesJson, messageCount, conversationId, userId);

    return Number(conversationId);
  }

  const result = await db.prepare(`
    INSERT INTO assistant_conversations (user_id, title, preview, messages_json, message_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, title, preview, messagesJson, messageCount);

  return Number(result.lastInsertRowid);
}

router.get('/conversations', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT id, title, preview, message_count, created_at, updated_at
      FROM assistant_conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 30
    `).all(req.user.id);

    res.json(rows);
  } catch (error) {
    console.error('获取AI问答历史错误:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const row = await db.prepare(`
      SELECT id, title, preview, message_count, messages_json, created_at, updated_at
      FROM assistant_conversations
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!row) {
      return res.status(404).json({ error: '历史记录不存在' });
    }

    res.json({
      id: row.id,
      title: row.title,
      preview: row.preview,
      message_count: row.message_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      messages: parseStoredMessages(row.messages_json)
    });
  } catch (error) {
    console.error('获取AI问答详情错误:', error);
    res.status(500).json({ error: '获取历史详情失败' });
  }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    const existing = await db.prepare(`
      SELECT id
      FROM assistant_conversations
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: '历史记录不存在' });
    }

    await db.prepare(`
      DELETE FROM assistant_conversations
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);

    res.json({ message: '历史记录删除成功' });
  } catch (error) {
    console.error('删除AI问答历史错误:', error);
    res.status(500).json({ error: '删除历史记录失败' });
  }
});

router.post('/chat/stream', async (req, res) => {
  try {
    const { messages, shipId, eventTypeId, conversationId } = req.body || {};
    const conversation = Array.isArray(messages) ? messages : [];
    const lastUserMessage = [...conversation].reverse().find((item) => item?.role === 'user' && String(item.content || '').trim());

    if (!lastUserMessage) {
      return res.status(400).json({ error: '问题不能为空' });
    }

    const savedConversationId = await saveConversationSnapshot(req.user.id, conversationId || null, conversation);

    const context = await searchAssistantContext(String(lastUserMessage.content).trim(), shipId || null, eventTypeId || null);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent({
      type: 'meta',
      context: {
        conversationId: savedConversationId,
        similarEvents: (context.similarEvents || []).map((item) => ({
          event_id: item.event_id,
          title: item.title,
          ship_name: item.ship_name,
          event_type_name: item.event_type_name,
          summary: item.summary
        })),
        matchingRecords: (context.matchingRecords || []).slice(0, 5).map((item) => ({
          id: item.id,
          event_id: item.event_id,
          event_title: item.event_title,
          ship_name: item.ship_name
        }))
      }
    });

    let assistantReply = '';

    await streamAssistantReply({
      messages: conversation,
      context,
      shipId: shipId || null,
      eventTypeId: eventTypeId || null,
      onEvent: (payload) => {
        if (payload?.type === 'delta' && payload.content) {
          assistantReply += payload.content;
        }
        sendEvent(payload);
      }
    });

    const finalMessages = sanitizeMessages([
      ...conversation,
      {
        role: 'assistant',
        content: assistantReply
      }
    ]);

    await saveConversationSnapshot(req.user.id, savedConversationId, finalMessages);

    sendEvent({ type: 'done' });
    res.end();
  } catch (error) {
    console.error('AI问答错误:', error);

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'AI问答失败' })}\n\n`);
      res.end();
      return;
    }

    res.status(500).json({ error: error.message || 'AI问答失败' });
  }
});

module.exports = router;
