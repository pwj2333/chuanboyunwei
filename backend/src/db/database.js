const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/maintenance.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// 确保data目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

function execRows(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) {
    return [];
  }

  const [{ columns, values }] = result;
  return values.map((valueRow) => {
    const row = {};
    columns.forEach((column, index) => {
      row[column] = valueRow[index];
    });
    return row;
  });
}

// 初始化数据库连接
async function initDb() {
  const SQL = await initSqlJs();

  // 如果数据库文件存在，加载它
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    // 创建新数据库
    db = new SQL.Database();
  }

  return db;
}

// 保存数据库到文件
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 封装数据库API
const dbWrapper = {
  prepare: (sql) => {
    return {
      run: async (...params) => {
        if (!db) await initDb();
        db.run(sql, params);
        saveDb();
        return {
          lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] || 0,
          changes: db.getRowsModified()
        };
      },
      get: async (...params) => {
        if (!db) await initDb();
        const result = db.exec(sql, params);
        if (result.length === 0) return null;
        const columns = result[0].columns;
        const values = result[0].values[0];
        if (!values) return null;
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return row;
      },
      all: async (...params) => {
        if (!db) await initDb();
        const result = db.exec(sql, params);
        if (result.length === 0) return [];
        const columns = result[0].columns;
        const rows = result[0].values.map(values => {
          const row = {};
          columns.forEach((col, i) => {
            row[col] = values[i];
          });
          return row;
        });
        return rows;
      }
    };
  },
  exec: async (sql) => {
    if (!db) await initDb();
    db.exec(sql);
    saveDb();
  },
  close: () => {
    if (db) {
      saveDb();
      db.close();
    }
  }
};

// 初始化数据库schema
async function initDatabase() {
  try {
    await initDb();
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    db.exec(`
      CREATE TABLE IF NOT EXISTS event_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'main' CHECK(scope IN ('main', 'branch')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, scope)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS assistant_skill_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        prompt_text TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`
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
    `);
    try {
      db.exec('ALTER TABLE ships ADD COLUMN display_order INTEGER');
    } catch (migrationError) {
      if (!String(migrationError.message || '').includes('duplicate column name: display_order')) {
        throw migrationError;
      }
    }
    try {
      db.exec('ALTER TABLE events ADD COLUMN event_type_id INTEGER');
    } catch (migrationError) {
      if (!String(migrationError.message || '').includes('duplicate column name: event_type_id')) {
        throw migrationError;
      }
    }
    try {
      db.exec("ALTER TABLE event_types ADD COLUMN scope TEXT NOT NULL DEFAULT 'main'");
    } catch (migrationError) {
      if (!String(migrationError.message || '').includes('duplicate column name: scope')) {
        throw migrationError;
      }
    }
    try {
      db.exec('ALTER TABLE knowledge_base ADD COLUMN graph_payload TEXT');
    } catch (migrationError) {
      if (!String(migrationError.message || '').includes('duplicate column name: graph_payload')) {
        throw migrationError;
      }
    }
    const eventTypeTable = execRows(`
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = 'event_types'
    `)[0];

    const needsEventTypeRebuild = !String(eventTypeTable?.sql || '').includes('UNIQUE(name, scope)');

    if (needsEventTypeRebuild) {
      const hasScopeColumn = execRows(`PRAGMA table_info(event_types)`).some((column) => column.name === 'scope');
      const eventTypesData = execRows(`
        SELECT
          id,
          name,
          ${hasScopeColumn ? "scope" : "'main' AS scope"},
          created_at
        FROM event_types
        ORDER BY id ASC
      `);
      const usageRows = execRows(`
        SELECT
          et.id,
          SUM(CASE WHEN e.parent_event_id IS NULL THEN 1 ELSE 0 END) AS root_count,
          SUM(CASE WHEN e.parent_event_id IS NOT NULL THEN 1 ELSE 0 END) AS branch_count
        FROM event_types et
        LEFT JOIN events e ON e.event_type_id = et.id
        GROUP BY et.id
      `);
      const usageMap = new Map(usageRows.map((row) => [row.id, row]));

      db.exec(`
        DROP TABLE IF EXISTS event_types_new;
        CREATE TABLE event_types_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'main' CHECK(scope IN ('main', 'branch')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name, scope)
        );
      `);

      eventTypesData.forEach((eventType) => {
        const usage = usageMap.get(eventType.id) || { root_count: 0, branch_count: 0 };
        const rootCount = Number(usage.root_count || 0);
        const branchCount = Number(usage.branch_count || 0);
        const currentScope = eventType.scope === 'branch' ? 'branch' : 'main';
        const primaryScope = rootCount > 0 ? 'main' : (branchCount > 0 ? 'branch' : currentScope);

        db.run(
          `
            INSERT INTO event_types_new (id, name, scope, created_at)
            VALUES (?, ?, ?, ?)
          `,
          [eventType.id, eventType.name, primaryScope, eventType.created_at]
        );

        if (rootCount > 0 && branchCount > 0) {
          db.run(
            `
              INSERT INTO event_types_new (name, scope, created_at)
              VALUES (?, 'branch', ?)
            `,
            [eventType.name, eventType.created_at]
          );

          const branchTypeId = db.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0];
          if (branchTypeId) {
            db.run(
              `
                UPDATE events
                SET event_type_id = ?
                WHERE event_type_id = ?
                  AND parent_event_id IS NOT NULL
              `,
              [branchTypeId, eventType.id]
            );
          }
        }
      });

      db.exec(`
        DROP TABLE event_types;
        ALTER TABLE event_types_new RENAME TO event_types;
      `);
    }

    db.exec(`
      UPDATE event_types
      SET scope = CASE
        WHEN scope IN ('main', 'branch') THEN scope
        ELSE 'main'
      END
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_event_type_id ON events(event_type_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_event_types_name ON event_types(name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_event_types_scope ON event_types(scope)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_updated ON assistant_conversations(user_id, updated_at DESC)');
    const defaultAssistantSkill = `你是“船舶运维专家”技能，服务于船舶信息化运维系统。

工作规则：
1. 必须优先结合提供的历史归档知识、经验总结、事件备注和历史记录回答。
2. 如果用户背景不足，无法可靠判断，请先提出1到3个最关键的澄清问题，然后停止，不要直接给结论。
3. 如果信息已经足够，请直接给出专业建议，不要反复追问。
4. 回答时不要编造不存在的历史案例；如果没有检索到合适历史，要明确说明。
5. 回答尽量简洁、专业、可执行，优先面向值守人员。
6. 当可以给方案时，尽量按这个结构输出：
问题判断：
建议处理：
历史经验：
风险与下一步：`;
    db.run(
      `
        INSERT INTO assistant_skill_config (id, prompt_text)
        SELECT 1, ?
        WHERE NOT EXISTS (SELECT 1 FROM assistant_skill_config WHERE id = 1)
      `,
      [defaultAssistantSkill]
    );
    saveDb();
    console.log('数据库初始化成功');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

module.exports = { db: dbWrapper, initDatabase };
