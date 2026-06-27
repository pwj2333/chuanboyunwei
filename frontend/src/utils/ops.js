const PRIORITY_META = {
  high: { label: '高优先级', color: '#ff6b6b', glow: 'rgba(255, 107, 107, 0.28)' },
  medium: { label: '中优先级', color: '#ffb347', glow: 'rgba(255, 179, 71, 0.26)' },
  low: { label: '低优先级', color: '#47d1ff', glow: 'rgba(71, 209, 255, 0.24)' }
};

const STATUS_META = {
  pending: { label: '待处理', color: '#6f7d95', tone: '#27364f' },
  in_progress: { label: '处理中', color: '#47d1ff', tone: '#133447' },
  completed: { label: '已完成', color: '#54f1b5', tone: '#153a35' },
  archived: { label: '已归档', color: '#8c7bff', tone: '#282552' }
};

export function getPriorityMeta(priority = 'medium') {
  return PRIORITY_META[priority] || PRIORITY_META.medium;
}

export function getStatusMeta(status = 'pending') {
  return STATUS_META[status] || STATUS_META.pending;
}

export function formatDateTime(value, options = {}) {
  if (!value) return '--';

  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
}

export function formatShortDate(value) {
  if (!value) return '--';

  return new Date(value).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  });
}

export function distributeAxis(index, total, start = 14, end = 86) {
  if (total <= 1) return (start + end) / 2;
  const step = (end - start) / (total - 1);
  return start + step * index;
}

export function buildBranchGraph(events, options = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    return { nodes: [], edges: [], ids: [] };
  }

  const {
    focusId = null,
    startX = 18,
    levelGap = 24,
    startY = 16,
    endY = 84
  } = options;

  const eventMap = new Map(events.map((event) => [Number(event.id), event]));
  const childrenMap = new Map();

  events.forEach((event) => {
    const parentId = event.parent_event_id == null ? null : Number(event.parent_event_id);
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId).push(event);
  });

  childrenMap.forEach((list) => {
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  });

  const roots = focusId != null
    ? [eventMap.get(Number(focusId))].filter(Boolean)
    : (childrenMap.get(null) || []);

  const levels = [];
  const edges = [];
  const visited = new Set();

  const walk = (event, depth) => {
    const eventId = Number(event.id);
    if (visited.has(eventId)) return;

    visited.add(eventId);
    levels[depth] ||= [];
    levels[depth].push(event);

    const children = childrenMap.get(eventId) || [];
    children.forEach((child) => {
      edges.push({
        id: `${eventId}-${child.id}`,
        source: `event-${eventId}`,
        target: `event-${child.id}`,
        label: '分支'
      });
      walk(child, depth + 1);
    });
  };

  roots.forEach((root) => walk(root, 0));

  const nodes = [];

  levels.forEach((level, depth) => {
    level.forEach((event, index) => {
      const status = getStatusMeta(event.status);
      const priority = getPriorityMeta(event.priority);

      nodes.push({
        id: `event-${event.id}`,
        label: event.title,
        x: startX + depth * levelGap,
        y: distributeAxis(index, level.length, startY, endY),
        width: depth === 0 ? 210 : 180,
        height: depth === 0 ? 108 : 92,
        type: depth === 0 ? 'root' : 'event',
        badge: depth === 0 ? '主事件' : '事件分支',
        meta: `${event.ship_name || '未分配船舶'} · ${status.label}`,
        tag: priority.label,
        statusColor: status.color,
        accentColor: priority.color,
        raw: event
      });
    });
  });

  return {
    nodes,
    edges,
    ids: Array.from(visited)
  };
}

export function summarizeBy(items, field) {
  return items.reduce((accumulator, item) => {
    const key = item[field] ?? 'unknown';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}
