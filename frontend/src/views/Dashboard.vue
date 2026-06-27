<template>
  <div class="dashboard-screen">
    <section class="screen-hero screen-panel">
      <div class="hero-copy">
        <span class="hero-kicker">OPS COMMAND</span>
        <h3>运维看板</h3>
        <p>{{ focusRootEvent ? `${focusRootEvent.ship_name} / ${getStatusMeta(focusRootEvent.status).label}` : '全船队态势监控' }}</p>
        <div class="hero-badges">
          <span>船队态势</span>
          <span>事件链路</span>
          <span>归档知识</span>
        </div>
      </div>

      <div class="hero-visual" aria-hidden="true">
        <div class="hero-grid"></div>
        <div class="hero-orbit orbit-a"></div>
        <div class="hero-orbit orbit-b"></div>
        <div class="hero-radar"></div>
        <div class="hero-track track-a"></div>
        <div class="hero-track track-b"></div>
        <div class="hero-track track-c"></div>
        <div class="hero-ship ship-left">
          <div class="hero-ship-shadow"></div>
          <div class="hero-ship-hull"></div>
          <div class="hero-ship-deck"></div>
          <div class="hero-ship-bridge"></div>
          <div class="hero-ship-light"></div>
        </div>
        <div class="hero-ship ship-right">
          <div class="hero-ship-shadow"></div>
          <div class="hero-ship-hull"></div>
          <div class="hero-ship-deck"></div>
          <div class="hero-ship-bridge"></div>
          <div class="hero-ship-light"></div>
        </div>
      </div>

      <div class="hero-side">
        <div class="pulse-card">
          <span>当前焦点</span>
          <strong>{{ focusRootEvent?.title || '暂无主事件' }}</strong>
          <small>{{ focusRootEvent ? `${focusRootEvent.ship_name} · ${getStatusMeta(focusRootEvent.status).label}` : '--' }}</small>
        </div>
      </div>
    </section>

    <section class="metric-grid">
      <article
        v-for="item in metricCards"
        :key="item.label"
        class="metric-card"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </section>

    <section class="content-grid">
      <article class="screen-panel status-panel">
        <div class="panel-head">
          <div>
            <h4>处置进度面板</h4>
          </div>
        </div>

        <div class="status-list">
          <div v-for="item in statusCards" :key="item.key" class="status-item">
            <div class="status-meta">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="status-bar">
              <div class="status-fill" :style="{ width: `${item.percent}%`, background: item.color }"></div>
            </div>
          </div>
        </div>

        <div class="priority-radar">
          <div v-for="item in priorityCards" :key="item.key" class="priority-card">
            <span :style="{ color: item.color }">{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
            <small>{{ item.description }}</small>
          </div>
        </div>
      </article>

      <article class="screen-panel topology-panel">
        <div class="panel-head">
          <div>
            <h4>主事件分支拓扑</h4>
          </div>
          <el-button v-if="focusRootEvent" class="ghost-button" @click="openEvent(focusRootEvent.id)">
            查看详情
          </el-button>
        </div>

        <div class="focus-tabs" v-if="rootEvents.length">
          <button
            v-for="item in rootEvents.slice(0, 4)"
            :key="item.id"
            type="button"
            class="focus-pill"
            :class="{ active: focusRootEvent?.id === item.id }"
            @click="focusEventId = item.id"
          >
            {{ item.title }}
          </button>
        </div>

        <RelationCanvas
          :nodes="focusGraph.nodes"
          :edges="focusGraph.edges"
          :selected-id="selectedGraphNodeId"
          min-height="520px"
          empty-title="暂无数据"
          @select="handleGraphSelect"
        />
      </article>

      <article class="screen-panel alert-panel">
        <div class="panel-head">
          <div>
            <h4>重点告警队列</h4>
          </div>
        </div>

        <div class="alert-list" v-if="alertQueue.length">
          <button
            v-for="item in alertQueue"
            :key="item.id"
            type="button"
            class="alert-item"
            @click="openEvent(item.id)"
          >
            <div class="alert-top">
              <span class="alert-ship">{{ item.ship_name }}</span>
              <span class="alert-tag" :style="{ color: getPriorityMeta(item.priority).color }">
                {{ getPriorityMeta(item.priority).label }}
              </span>
            </div>
            <strong>{{ item.title }}</strong>
            <small>{{ item.due_date ? `督办截至 ${formatDateTime(item.due_date, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', year: undefined })}` : '--' }}</small>
          </button>
        </div>
        <el-empty v-else description="暂无数据" :image-size="88" />
      </article>

      <article class="screen-panel fleet-panel">
        <div class="panel-head">
          <div>
            <h4>船舶健康度</h4>
          </div>
        </div>

        <div class="fleet-list" v-if="fleetHealth.length">
          <div v-for="ship in fleetHealth" :key="ship.id" class="fleet-item">
            <div class="fleet-top">
              <strong>{{ ship.name }}</strong>
              <span>{{ ship.active }} 条活跃事件</span>
            </div>
            <div class="fleet-bar">
              <div class="fleet-fill" :style="{ width: `${ship.health}%` }"></div>
            </div>
            <div class="fleet-note">
              <span>高优先级 {{ ship.highPriority }}</span>
              <span>分支 {{ ship.branches }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无数据" :image-size="88" />
      </article>

      <article class="screen-panel trend-panel">
        <div class="panel-head">
          <div>
            <h4>近 7 日事件趋势</h4>
          </div>
        </div>

        <div class="trend-bars">
          <div v-for="item in weeklyTrend" :key="item.label" class="trend-item">
            <div class="trend-bar">
              <div class="trend-fill" :style="{ height: `${item.percent}%` }"></div>
            </div>
            <strong>{{ item.count }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </div>

        <div class="timeline-list">
          <div v-for="event in recentEvents" :key="event.id" class="timeline-item">
            <span>{{ formatDateTime(event.created_at, { year: undefined }) }}</span>
            <strong>{{ event.title }}</strong>
            <small>{{ event.ship_name }}</small>
          </div>
        </div>
      </article>

      <article class="screen-panel knowledge-panel">
        <div class="panel-head">
          <div>
            <h4>知识资产</h4>
          </div>
        </div>

        <div class="knowledge-list" v-if="knowledgeHighlights.length">
          <div v-for="item in knowledgeHighlights" :key="item.event_id" class="knowledge-item">
            <div class="knowledge-top">
              <strong>{{ item.title }}</strong>
              <span>{{ item.problem_type || '待归类' }}</span>
            </div>
            <p>{{ item.summary || '--' }}</p>
            <button type="button" class="link-button" @click="openEvent(item.event_id)">
              打开事件
            </button>
          </div>
        </div>
        <el-empty v-else description="暂无数据" :image-size="88" />
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { events, knowledge, ships } from '@/api';
import RelationCanvas from '@/components/RelationCanvas.vue';
import { buildBranchGraph, formatDateTime, getPriorityMeta, getStatusMeta, summarizeBy } from '@/utils/ops';

const router = useRouter();

const eventList = ref([]);
const shipList = ref([]);
const graphRows = ref([]);
const focusEventId = ref(null);
const selectedGraphNodeId = ref(null);

const statusOrder = ['pending', 'in_progress', 'completed', 'archived'];
const priorityOrder = ['high', 'medium', 'low'];

const rootEvents = computed(() => {
  return eventList.value.filter((event) => !event.parent_event_id);
});

const focusRootEvent = computed(() => {
  if (!rootEvents.value.length) return null;

  if (focusEventId.value) {
    const focus = rootEvents.value.find((event) => event.id === focusEventId.value);
    if (focus) return focus;
  }

  return [...rootEvents.value].sort((left, right) => {
    const leftRank = priorityOrder.indexOf(left.priority);
    const rightRank = priorityOrder.indexOf(right.priority);
    return leftRank - rightRank || new Date(right.created_at) - new Date(left.created_at);
  })[0];
});

const metricCards = computed(() => {
  const activeCount = eventList.value.filter((event) => ['pending', 'in_progress'].includes(event.status)).length;
  const highCount = eventList.value.filter((event) => event.priority === 'high').length;
  const branchCount = eventList.value.filter((event) => event.parent_event_id).length;
  const knowledgeCount = graphRows.value.filter((row) => row.summary).length;

  return [
    { label: '船舶总量', value: shipList.value.length, note: '' },
    { label: '活跃事件', value: activeCount, note: '' },
    { label: '高优先级', value: highCount, note: '' },
    { label: '分支事件', value: branchCount, note: '' },
    { label: '知识资产', value: knowledgeCount, note: '' }
  ];
});

const statusCards = computed(() => {
  const summary = summarizeBy(eventList.value, 'status');
  const total = eventList.value.length || 1;

  return statusOrder.map((key) => {
    const status = getStatusMeta(key);
    const count = summary[key] || 0;
    return {
      key,
      label: status.label,
      count,
      color: status.color,
      percent: Math.max(8, Math.round((count / total) * 100))
    };
  });
});

const priorityCards = computed(() => {
  const summary = summarizeBy(eventList.value, 'priority');
  return priorityOrder.map((key) => {
    const priority = getPriorityMeta(key);
    return {
      key,
      label: priority.label,
      color: priority.color,
      count: summary[key] || 0,
      description: ''
    };
  });
});

const focusGraph = computed(() => {
  if (!focusRootEvent.value) {
    return { nodes: [], edges: [] };
  }

  const descendants = collectSubtree(focusRootEvent.value.id);
  return buildBranchGraph(descendants, {
    focusId: focusRootEvent.value.id,
    startX: 18,
    levelGap: 24
  });
});

const alertQueue = computed(() => {
  return [...eventList.value]
    .filter((event) => ['pending', 'in_progress'].includes(event.status))
    .sort((left, right) => {
      const leftRank = priorityOrder.indexOf(left.priority);
      const rightRank = priorityOrder.indexOf(right.priority);
      const leftDue = left.due_date ? new Date(left.due_date).getTime() : Infinity;
      const rightDue = right.due_date ? new Date(right.due_date).getTime() : Infinity;
      return leftRank - rightRank || leftDue - rightDue;
    })
    .slice(0, 5);
});

const fleetHealth = computed(() => {
  return shipList.value.map((ship) => {
    const shipEvents = eventList.value.filter((event) => event.ship_id === ship.id);
    const active = shipEvents.filter((event) => ['pending', 'in_progress'].includes(event.status)).length;
    const highPriority = shipEvents.filter((event) => event.priority === 'high').length;
    const branches = shipEvents.filter((event) => event.parent_event_id).length;
    const penalty = active * 18 + highPriority * 16 + branches * 8;
    return {
      id: ship.id,
      name: ship.name,
      active,
      highPriority,
      branches,
      health: Math.max(18, 100 - penalty)
    };
  });
});

const weeklyTrend = computed(() => {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const label = date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    const count = eventList.value.filter((event) => {
      const created = new Date(event.created_at);
      return created.toDateString() === date.toDateString();
    }).length;
    days.push({ label, count });
  }

  const max = Math.max(...days.map((item) => item.count), 1);
  return days.map((item) => ({
    ...item,
    percent: Math.max(10, Math.round((item.count / max) * 100))
  }));
});

const recentEvents = computed(() => {
  return [...eventList.value]
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .slice(0, 5);
});

const knowledgeHighlights = computed(() => {
  return graphRows.value
    .filter((row) => row.summary || row.problem_type)
    .slice(0, 4);
});

async function loadData() {
  const [eventsData, shipsData, graphData] = await Promise.all([
    events.list(),
    ships.list(),
    knowledge.graph()
  ]);

  eventList.value = eventsData;
  shipList.value = shipsData;
  graphRows.value = graphData;

  if (!focusEventId.value && rootEvents.value.length) {
    focusEventId.value = rootEvents.value[0].id;
  }
}

function collectSubtree(rootId) {
  const map = new Map();
  eventList.value.forEach((event) => {
    const parentId = event.parent_event_id ?? null;
    if (!map.has(parentId)) {
      map.set(parentId, []);
    }
    map.get(parentId).push(event);
  });

  const result = [];
  const walk = (currentId) => {
    const current = eventList.value.find((event) => event.id === currentId);
    if (!current) return;
    result.push(current);
    (map.get(currentId) || []).forEach((child) => walk(child.id));
  };

  walk(rootId);
  return result;
}

function handleGraphSelect(node) {
  selectedGraphNodeId.value = node.id;
  if (node.raw?.id) {
    openEvent(node.raw.id);
  }
}

function openEvent(id) {
  router.push(`/events/${id}`);
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.dashboard-screen {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.screen-panel {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  padding: 22px;
  background:
    linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.16);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.02),
    0 20px 48px rgba(3, 10, 20, 0.34);
}

.screen-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 28px 28px 26px;
  background:
    radial-gradient(circle at 80% 12%, rgba(71, 209, 255, 0.22), transparent 18%),
    radial-gradient(circle at 18% 60%, rgba(84, 241, 181, 0.1), transparent 20%),
    linear-gradient(135deg, rgba(8, 29, 47, 0.98), rgba(4, 11, 21, 0.98));
}

.hero-copy {
  position: relative;
  z-index: 2;
  max-width: 760px;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 2px;
  color: #08131f;
  background: linear-gradient(135deg, #61e8ff, #59f0bc);
  box-shadow: 0 10px 24px rgba(97, 232, 255, 0.22);
}

.screen-hero h3 {
  margin: 18px 0 0;
  font-size: 40px;
  color: #f4fbff;
}

.screen-hero p {
  margin: 12px 0 0;
  max-width: 460px;
  line-height: 1.8;
  color: rgba(219, 236, 250, 0.76);
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.hero-badges span {
  padding: 8px 14px;
  border-radius: 999px;
  color: rgba(225, 244, 255, 0.82);
  background: rgba(8, 23, 36, 0.62);
  border: 1px solid rgba(103, 193, 255, 0.14);
  backdrop-filter: blur(10px);
}

.hero-visual {
  position: relative;
  flex: 1;
  min-height: 220px;
  overflow: hidden;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(6, 18, 30, 0.4), rgba(5, 12, 22, 0.2));
  border: 1px solid rgba(103, 193, 255, 0.12);
}

.hero-grid,
.hero-orbit,
.hero-radar,
.hero-track,
.hero-ship,
.hero-ship-shadow,
.hero-ship-hull,
.hero-ship-deck,
.hero-ship-bridge,
.hero-ship-light {
  position: absolute;
}

.hero-grid {
  inset: 0;
  background-image:
    linear-gradient(rgba(97, 232, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(97, 232, 255, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.88), transparent 100%);
}

.hero-orbit {
  border-radius: 999px;
  border: 1px solid rgba(97, 232, 255, 0.14);
}

.orbit-a {
  width: 220px;
  height: 220px;
  right: -32px;
  top: -18px;
  animation: rotateDrift 18s linear infinite;
}

.orbit-b {
  width: 110px;
  height: 110px;
  right: 26px;
  top: 38px;
  border-style: dashed;
  animation: rotateDriftReverse 12s linear infinite;
}

.hero-radar {
  right: 78px;
  top: 90px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #61e8ff;
  box-shadow:
    0 0 0 0 rgba(97, 232, 255, 0.24),
    0 0 18px rgba(97, 232, 255, 0.32);
  animation: radarPulse 3.4s ease-out infinite;
}

.hero-track {
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(97, 232, 255, 0), rgba(97, 232, 255, 0.6), rgba(97, 232, 255, 0));
}

.track-a {
  left: 8%;
  right: 26%;
  bottom: 88px;
  animation: seaShift 5.8s linear infinite;
}

.track-b {
  left: 18%;
  right: 18%;
  bottom: 66px;
  opacity: 0.5;
  animation: seaShift 7s linear infinite reverse;
}

.track-c {
  left: 12%;
  right: 32%;
  bottom: 44px;
  opacity: 0.36;
  animation: seaShift 8.4s linear infinite;
}

.hero-ship {
  width: 180px;
  height: 88px;
  transform-origin: center bottom;
}

.ship-left {
  left: 12%;
  bottom: 64px;
  animation: heroShipFloat 5.5s ease-in-out infinite;
}

.ship-right {
  right: 24%;
  bottom: 30px;
  transform: scale(0.84);
  opacity: 0.84;
  animation: heroShipFloat 6.8s ease-in-out infinite reverse;
}

.hero-ship-shadow {
  left: 12px;
  right: 12px;
  bottom: 4px;
  height: 14px;
  background: radial-gradient(circle at center, rgba(5, 18, 30, 0.72), transparent 72%);
  filter: blur(8px);
}

.hero-ship-hull {
  left: 0;
  right: 22px;
  bottom: 14px;
  height: 26px;
  background: linear-gradient(180deg, #14324e, #081523);
  clip-path: polygon(0 72%, 8% 40%, 80% 40%, 94% 54%, 100% 72%, 88% 100%, 12% 100%);
  border: 1px solid rgba(97, 232, 255, 0.12);
}

.hero-ship-deck {
  left: 22px;
  bottom: 32px;
  width: 88px;
  height: 12px;
  border-radius: 8px 14px 6px 6px;
  background: linear-gradient(180deg, rgba(92, 240, 188, 0.88), rgba(73, 177, 255, 0.72));
}

.hero-ship-bridge {
  left: 52px;
  bottom: 42px;
  width: 42px;
  height: 18px;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(180deg, rgba(13, 50, 80, 0.96), rgba(8, 22, 37, 0.98));
  border: 1px solid rgba(97, 232, 255, 0.14);
}

.hero-ship-light {
  left: 90px;
  bottom: 62px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #61e8ff;
  box-shadow: 0 0 12px rgba(97, 232, 255, 0.52);
}

.hero-side {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 290px;
}

.pulse-card {
  padding: 18px;
  border-radius: 22px;
  background: rgba(9, 19, 33, 0.76);
  border: 1px solid rgba(91, 151, 205, 0.16);
}

.pulse-card span {
  display: block;
  font-size: 12px;
  color: rgba(177, 207, 231, 0.62);
}

.pulse-card strong {
  display: block;
  margin-top: 8px;
  font-size: 20px;
}

.pulse-card small {
  display: block;
  margin-top: 8px;
  color: rgba(219, 236, 250, 0.74);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  padding: 18px 20px;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.14);
}

.metric-card span,
.metric-card small {
  display: block;
}

.metric-card span {
  color: rgba(185, 211, 230, 0.72);
}

.metric-card strong {
  display: block;
  margin: 14px 0 8px;
  font-size: 34px;
  color: #f3fbff;
  text-shadow: 0 10px 22px rgba(2, 10, 22, 0.34);
}

.metric-card small {
  color: rgba(185, 211, 230, 0.62);
  line-height: 1.6;
}

.content-grid {
  display: grid;
  grid-template-columns: 1.1fr 1.8fr 1.1fr;
  gap: 18px;
}

.fleet-panel,
.trend-panel,
.knowledge-panel {
  min-height: 330px;
}

.fleet-panel {
  grid-column: 1 / 2;
}

.trend-panel {
  grid-column: 2 / 3;
}

.knowledge-panel {
  grid-column: 3 / 4;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
}

.panel-head h4 {
  margin: 0;
  font-size: 22px;
  color: #f3fbff;
}

.ghost-button {
  border-radius: 14px;
  border-color: rgba(71, 209, 255, 0.16);
  background: rgba(13, 31, 47, 0.82);
  color: #d9f4ff;
}

.status-list,
.fleet-list,
.knowledge-list,
.timeline-list,
.alert-list {
  display: grid;
  gap: 14px;
}

.status-item,
.fleet-item,
.knowledge-item,
.timeline-item,
.alert-item {
  padding: 16px;
  border-radius: 18px;
  background: rgba(11, 21, 34, 0.82);
  border: 1px solid rgba(91, 151, 205, 0.1);
}

.status-meta,
.fleet-top,
.knowledge-top,
.alert-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.status-meta span,
.fleet-top span,
.alert-item small,
.knowledge-item p,
.timeline-item span,
.timeline-item small {
  color: rgba(190, 214, 231, 0.68);
}

.status-bar,
.fleet-bar {
  margin-top: 12px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.status-fill,
.fleet-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #47d1ff, #54f1b5);
}

.priority-radar {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.priority-card {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(7, 18, 31, 0.82);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.priority-card span,
.priority-card small {
  display: block;
}

.priority-card strong {
  display: block;
  margin: 8px 0 6px;
  font-size: 22px;
}

.focus-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.focus-pill,
.link-button,
.alert-item {
  border: none;
}

.focus-pill {
  padding: 10px 14px;
  border-radius: 999px;
  color: rgba(220, 239, 255, 0.76);
  background: rgba(12, 30, 46, 0.8);
  cursor: pointer;
}

.focus-pill.active {
  color: #04111d;
  background: linear-gradient(135deg, #61e8ff, #59f0bc);
}

.alert-item {
  text-align: left;
  cursor: pointer;
}

.alert-item strong,
.timeline-item strong,
.knowledge-item strong {
  display: block;
  margin: 8px 0 6px;
  color: #f3fbff;
}

.alert-ship,
.alert-tag {
  font-size: 12px;
}

.fleet-note {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  color: rgba(190, 214, 231, 0.68);
  font-size: 12px;
}

.trend-bars {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
  min-height: 220px;
}

.trend-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.trend-bar {
  display: flex;
  align-items: end;
  width: 100%;
  height: 150px;
  padding: 8px;
  border-radius: 16px;
  background: rgba(9, 22, 36, 0.78);
}

.trend-fill {
  width: 100%;
  border-radius: 12px 12px 8px 8px;
  background: linear-gradient(180deg, #61e8ff 0%, #1785c7 100%);
}

.link-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
  padding: 0;
  color: #61e8ff;
  background: transparent;
  cursor: pointer;
}

@keyframes rotateDrift {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes rotateDriftReverse {
  from {
    transform: rotate(360deg);
  }

  to {
    transform: rotate(0deg);
  }
}

@keyframes radarPulse {
  0% {
    box-shadow:
      0 0 0 0 rgba(97, 232, 255, 0.28),
      0 0 18px rgba(97, 232, 255, 0.32);
  }

  70% {
    box-shadow:
      0 0 0 22px rgba(97, 232, 255, 0),
      0 0 24px rgba(97, 232, 255, 0.18);
  }

  100% {
    box-shadow:
      0 0 0 0 rgba(97, 232, 255, 0),
      0 0 18px rgba(97, 232, 255, 0.14);
  }
}

@keyframes heroShipFloat {
  0%, 100% {
    transform: translateY(0) rotate(-1deg);
  }

  50% {
    transform: translateY(-7px) rotate(1deg);
  }
}

@keyframes seaShift {
  0% {
    transform: translateX(-3%);
  }

  50% {
    transform: translateX(3%);
  }

  100% {
    transform: translateX(-3%);
  }
}

@media (max-width: 1440px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .fleet-panel,
  .trend-panel,
  .knowledge-panel {
    grid-column: auto;
  }
}

@media (max-width: 900px) {
  .screen-hero {
    flex-direction: column;
  }

  .hero-visual {
    min-height: 180px;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-orbit,
  .hero-radar,
  .hero-track,
  .ship-left,
  .ship-right {
    animation: none !important;
  }
}
</style>
