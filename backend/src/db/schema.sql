-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'user')) DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 船舶表
CREATE TABLE IF NOT EXISTS ships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'main' CHECK(scope IN ('main', 'branch')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, scope)
);

-- 事件表
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ship_id INTEGER NOT NULL,
  event_type_id INTEGER,
  parent_event_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'archived')) DEFAULT 'pending',
  due_date DATETIME,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME,
  FOREIGN KEY (ship_id) REFERENCES ships(id),
  FOREIGN KEY (event_type_id) REFERENCES event_types(id),
  FOREIGN KEY (parent_event_id) REFERENCES events(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 事件记录表
CREATE TABLE IF NOT EXISTS event_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  operator_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- 附件表
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  filesize INTEGER,
  mimetype TEXT,
  uploaded_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES event_records(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL UNIQUE,
  summary TEXT,
  keywords TEXT,
  problem_type TEXT,
  solution TEXT,
  lessons_learned TEXT,
  graph_payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- AI配置表
CREATE TABLE IF NOT EXISTS ai_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  api_base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model_name TEXT DEFAULT 'gpt-3.5-turbo',
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assistant_skill_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  prompt_text TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assistant_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  preview TEXT,
  messages_json TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 机器人配置表
CREATE TABLE IF NOT EXISTS bot_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_type TEXT CHECK(bot_type IN ('wechat_work', 'feishu')) NOT NULL,
  webhook_url TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_events_ship_id ON events(ship_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_due_date ON events(due_date);
CREATE INDEX IF NOT EXISTS idx_event_types_name ON event_types(name);
CREATE INDEX IF NOT EXISTS idx_event_records_event_id ON event_records(event_id);
CREATE INDEX IF NOT EXISTS idx_attachments_record_id ON attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_event_id ON knowledge_base(event_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_updated ON assistant_conversations(user_id, updated_at DESC);
