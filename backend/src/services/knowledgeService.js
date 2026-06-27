const { db } = require('../db/database');

async function searchSimilarEvents(query, shipId = null, eventTypeId = null) {
  let sql = `
    SELECT
      kb.*,
      e.title,
      e.ship_id,
      e.event_type_id,
      s.name as ship_name,
      et.name as event_type_name,
      e.priority,
      e.created_at as event_created_at
    FROM knowledge_base kb
    JOIN events e ON kb.event_id = e.id
    JOIN ships s ON e.ship_id = s.id
    LEFT JOIN event_types et ON e.event_type_id = et.id
    WHERE (
      kb.summary LIKE ? OR
      kb.keywords LIKE ? OR
      kb.problem_type LIKE ? OR
      e.title LIKE ?
    )
  `;

  const searchTerm = `%${query}%`;
  const params = [searchTerm, searchTerm, searchTerm, searchTerm];

  if (shipId) {
    sql += ' AND e.ship_id = ?';
    params.push(shipId);
  }
  if (eventTypeId) {
    sql += ' AND e.event_type_id = ?';
    params.push(eventTypeId);
  }

  sql += ' ORDER BY e.created_at DESC LIMIT 5';

  return await db.prepare(sql).all(...params);
}

async function createKnowledgeEntry(eventId, aiSummary) {
  const safeSummary = {
    ...aiSummary,
    keywords: Array.isArray(aiSummary?.keywords) ? aiSummary.keywords : [],
    graph_payload: aiSummary?.graph_payload && Array.isArray(aiSummary.graph_payload.tag_groups)
      ? aiSummary.graph_payload
      : { tag_groups: [] }
  };

  const result = await db.prepare(`
    INSERT INTO knowledge_base (event_id, summary, keywords, problem_type, solution, lessons_learned, graph_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET
      summary = excluded.summary,
      keywords = excluded.keywords,
      problem_type = excluded.problem_type,
      solution = excluded.solution,
      lessons_learned = excluded.lessons_learned,
      graph_payload = excluded.graph_payload,
      created_at = CURRENT_TIMESTAMP
  `).run(
    eventId,
    safeSummary.summary,
    JSON.stringify(safeSummary.keywords),
    safeSummary.problem_type,
    safeSummary.solution,
    safeSummary.lessons_learned,
    JSON.stringify(safeSummary.graph_payload)
  );

  return result;
}

async function getKnowledgeGraph(shipId = null, eventTypeId = null) {
  let sql = `
    SELECT
      e.id as event_id,
      e.parent_event_id,
      e.title,
      e.description,
      e.priority,
      e.status,
      e.ship_id,
      e.event_type_id,
      e.created_at,
      e.updated_at,
      e.archived_at,
      s.name as ship_name,
      et.name as event_type_name,
      kb.summary,
      kb.keywords,
      kb.problem_type,
      kb.solution,
      kb.lessons_learned,
      kb.graph_payload,
      (
        SELECT COUNT(*)
        FROM event_records er
        WHERE er.event_id = e.id
      ) as record_count
    FROM events e
    JOIN ships s ON e.ship_id = s.id
    LEFT JOIN event_types et ON e.event_type_id = et.id
    LEFT JOIN knowledge_base kb ON kb.event_id = e.id
    WHERE 1 = 1
  `;

  const params = [];

  if (shipId) {
    sql += ' AND e.ship_id = ?';
    params.push(shipId);
  }
  if (eventTypeId) {
    sql += ' AND e.event_type_id = ?';
    params.push(eventTypeId);
  }

  sql += ' ORDER BY e.created_at DESC';

  const rows = await db.prepare(sql).all(...params);

  rows.forEach((row) => {
    row.keywords = row.keywords ? JSON.parse(row.keywords) : [];
    row.graph_payload = row.graph_payload ? JSON.parse(row.graph_payload) : null;
  });

  return rows;
}

async function getKnowledgeByEventId(eventId) {
  const knowledge = await db.prepare(`
    SELECT
      kb.*,
      e.title,
      e.ship_id,
      e.event_type_id,
      s.name as ship_name,
      et.name as event_type_name
    FROM knowledge_base kb
    JOIN events e ON kb.event_id = e.id
    JOIN ships s ON e.ship_id = s.id
    LEFT JOIN event_types et ON e.event_type_id = et.id
    WHERE kb.event_id = ?
  `).get(eventId);

  if (knowledge && knowledge.keywords) {
    knowledge.keywords = JSON.parse(knowledge.keywords);
  }

  if (knowledge?.graph_payload) {
    knowledge.graph_payload = JSON.parse(knowledge.graph_payload);
  } else if (knowledge) {
    knowledge.graph_payload = null;
  }

  return knowledge;
}

async function updateKnowledgeGraph(eventId, graphPayload) {
  await db.prepare(`
    UPDATE knowledge_base
    SET graph_payload = ?, created_at = CURRENT_TIMESTAMP
    WHERE event_id = ?
  `).run(JSON.stringify(graphPayload || null), eventId);

  return getKnowledgeByEventId(eventId);
}

async function searchAssistantContext(query, shipId = null, eventTypeId = null) {
  const similarEvents = await searchSimilarEvents(query, shipId, eventTypeId);

  similarEvents.forEach((item) => {
    item.keywords = item.keywords ? JSON.parse(item.keywords) : [];
    item.graph_payload = item.graph_payload ? JSON.parse(item.graph_payload) : null;
  });

  let recordSql = `
    SELECT
      er.id,
      er.content,
      er.created_at,
      er.operator_id,
      e.id as event_id,
      e.title as event_title,
      e.ship_id,
      e.event_type_id,
      s.name as ship_name,
      et.name as event_type_name,
      u.display_name as operator
    FROM event_records er
    JOIN events e ON er.event_id = e.id
    JOIN ships s ON e.ship_id = s.id
    LEFT JOIN event_types et ON e.event_type_id = et.id
    LEFT JOIN users u ON er.operator_id = u.id
    WHERE er.content LIKE ?
  `;

  const recordParams = [`%${query}%`];

  if (shipId) {
    recordSql += ' AND e.ship_id = ?';
    recordParams.push(shipId);
  }

  if (eventTypeId) {
    recordSql += ' AND e.event_type_id = ?';
    recordParams.push(eventTypeId);
  }

  recordSql += ' ORDER BY er.created_at DESC LIMIT 8';

  const matchingRecords = await db.prepare(recordSql).all(...recordParams);

  return {
    similarEvents,
    matchingRecords
  };
}

module.exports = {
  searchSimilarEvents,
  createKnowledgeEntry,
  getKnowledgeGraph,
  getKnowledgeByEventId,
  updateKnowledgeGraph,
  searchAssistantContext
};
