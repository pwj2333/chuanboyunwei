const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { searchSimilarEvents, getKnowledgeGraph, getKnowledgeByEventId, updateKnowledgeGraph } = require('../services/knowledgeService');

router.use(authenticateToken);

// 搜索相似历史事件
router.post('/search', async (req, res) => {
  try {
    const { query, shipId, eventTypeId } = req.body;

    if (!query) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }

    const results = await searchSimilarEvents(query, shipId, eventTypeId);

    // 解析keywords字段
    results.forEach(result => {
      if (result.keywords) {
        result.keywords = JSON.parse(result.keywords);
      }
    });

    res.json(results);
  } catch (error) {
    console.error('搜索知识库错误:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

router.get('/graph', async (req, res) => {
  try {
    const { shipId, eventTypeId } = req.query;
    const graph = await getKnowledgeGraph(shipId, eventTypeId);
    res.json(graph);
  } catch (error) {
    console.error('获取知识图谱错误:', error);
    res.status(500).json({ error: '获取知识图谱失败' });
  }
});

// 获取指定事件的知识条目
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const knowledge = await getKnowledgeByEventId(eventId);

    if (!knowledge) {
      return res.status(404).json({ error: '知识条目不存在' });
    }

    res.json(knowledge);
  } catch (error) {
    console.error('获取知识条目错误:', error);
    res.status(500).json({ error: '获取知识条目失败' });
  }
});

router.patch('/:eventId/graph', async (req, res) => {
  try {
    const { eventId } = req.params;
    const graphPayload = req.body?.graph_payload;

    if (!graphPayload || !Array.isArray(graphPayload.tag_groups)) {
      return res.status(400).json({ error: '图谱数据格式不正确' });
    }

    const knowledge = await getKnowledgeByEventId(eventId);
    if (!knowledge) {
      return res.status(404).json({ error: '知识条目不存在' });
    }

    const updated = await updateKnowledgeGraph(eventId, graphPayload);
    res.json(updated);
  } catch (error) {
    console.error('更新知识图谱错误:', error);
    res.status(500).json({ error: '更新知识图谱失败' });
  }
});

module.exports = router;
