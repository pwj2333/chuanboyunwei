<template>
  <div class="archive-summary">
    <section class="page-panel toolbar-panel">
      <div class="toolbar-group">
        <el-input v-model="keyword" placeholder="搜索主事件标题、总结、分类、关键词" clearable />
        <el-select v-model="shipFilter" placeholder="按船舶筛选" clearable>
          <el-option v-for="ship in shipList" :key="ship.id" :label="ship.name" :value="ship.id" />
        </el-select>
        <el-select v-model="eventTypeFilter" placeholder="按事件类型筛选" clearable>
          <el-option v-for="item in mainEventTypes" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </div>

      <div class="toolbar-side">
        <div class="stat-chip">归档主事件 {{ archivedItems.length }}</div>
        <div class="stat-chip">已生成总结 {{ summarizedCount }}</div>
        <el-button class="ghost-button" @click="loadData">刷新</el-button>
      </div>
    </section>

    <section class="content-grid">
      <article class="page-panel list-panel">
        <div class="panel-head">
          <div>
            <h4>归档总结</h4>
          </div>
        </div>

        <div v-if="filteredItems.length" class="archive-list">
          <button
            v-for="item in filteredItems"
            :key="item.event_id"
            type="button"
            class="archive-item"
            :class="{ active: selectedEventId === item.event_id }"
            @click="selectedEventId = item.event_id"
          >
            <div class="item-top">
              <strong>{{ item.title }}</strong>
              <span>{{ item.event_type_name || item.problem_type || '未分类' }}</span>
            </div>
            <div class="item-meta">
              <span>{{ item.ship_name }}</span>
              <span>{{ formatDateTime(item.archived_at || item.updated_at || item.created_at) }}</span>
            </div>
            <p>{{ item.summary || '--' }}</p>
          </button>
        </div>
        <el-empty v-else description="暂无数据" :image-size="88" />
      </article>

      <aside class="page-panel detail-panel">
        <div class="panel-head">
          <div>
            <h4>AI 总结详情</h4>
          </div>
          <div class="detail-actions" v-if="selectedItem">
            <el-button class="ghost-button" @click="openEvent(selectedItem.event_id)">
              查看原事件
            </el-button>
            <el-button
              v-if="authStore.isAdmin"
              type="danger"
              plain
              @click="handleDeleteArchive"
            >
              删除归档
            </el-button>
          </div>
        </div>

        <template v-if="selectedItem">
          <div class="detail-card">
            <div class="detail-top">
              <div>
                <strong>{{ selectedItem.title }}</strong>
                <p>{{ selectedItem.ship_name }} / {{ selectedItem.event_type_name || selectedItem.problem_type || '未分类' }}</p>
              </div>
              <span class="status-pill">已归档</span>
            </div>

            <div class="meta-grid">
              <span>归档时间 {{ formatDateTime(selectedItem.archived_at || selectedItem.updated_at || selectedItem.created_at) }}</span>
              <span>优先级 {{ getPriorityMeta(selectedItem.priority).label }}</span>
              <span>记录数 {{ selectedItem.record_count || 0 }}</span>
              <span>关键词 {{ selectedItem.keywords?.length || 0 }}</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="card-title">事件摘要</div>
            <p>{{ selectedItem.summary || '--' }}</p>
          </div>

          <div class="summary-card">
            <div class="card-title">解决方案</div>
            <p>{{ selectedItem.solution || '--' }}</p>
          </div>

          <div class="summary-card">
            <div class="card-title">经验总结</div>
            <p>{{ selectedItem.lessons_learned || '--' }}</p>
          </div>

          <div class="summary-card">
            <div class="card-title">关键词</div>
            <div class="keyword-list" v-if="selectedItem.keywords?.length">
              <span v-for="keyword in selectedItem.keywords" :key="keyword" class="keyword-chip">{{ keyword }}</span>
            </div>
            <p v-else>--</p>
          </div>
        </template>

        <div v-else class="empty-detail">
          <p>暂无数据</p>
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { eventTypes, events, knowledge, ships } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime, getPriorityMeta } from '@/utils/ops';

const router = useRouter();
const authStore = useAuthStore();

const shipList = ref([]);
const eventTypeList = ref([]);
const graphRows = ref([]);
const keyword = ref('');
const shipFilter = ref(null);
const eventTypeFilter = ref(null);
const selectedEventId = ref(null);
const mainEventTypes = computed(() => eventTypeList.value.filter((item) => (item.scope || 'main') === 'main'));

const archivedItems = computed(() => {
  return graphRows.value.filter((row) => row.status === 'archived' && !row.parent_event_id);
});

const summarizedCount = computed(() => {
  return archivedItems.value.filter((row) => row.summary || row.problem_type || row.solution || row.lessons_learned).length;
});

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase();

  return archivedItems.value.filter((row) => {
    if (shipFilter.value && row.ship_id !== shipFilter.value) {
      return false;
    }

    if (eventTypeFilter.value && row.event_type_id !== eventTypeFilter.value) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      row.title,
      row.summary,
      row.problem_type,
      row.solution,
      row.lessons_learned,
      row.ship_name,
      row.event_type_name,
      ...(row.keywords || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
});

const selectedItem = computed(() => {
  return filteredItems.value.find((item) => item.event_id === selectedEventId.value) || filteredItems.value[0] || null;
});

async function loadData() {
  const [shipsData, eventTypesData, graphData] = await Promise.all([
    ships.list(),
    eventTypes.list(),
    knowledge.graph()
  ]);

  shipList.value = shipsData;
  eventTypeList.value = eventTypesData;
  graphRows.value = graphData;
}

function openEvent(id) {
  router.push(`/events/${id}`);
}

async function handleDeleteArchive() {
  if (!selectedItem.value || !authStore.isAdmin) return;

  await ElMessageBox.confirm(
    `确定删除归档主事件“${selectedItem.value.title}”吗？删除后 AI 总结和事件记录将一并移除。`,
    '删除确认',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  );

  await events.delete(selectedItem.value.event_id);
  ElMessage.success('归档主事件已删除');
  await loadData();
}

watch(
  filteredItems,
  (items) => {
    if (!items.length) {
      selectedEventId.value = null;
      return;
    }

    if (!selectedEventId.value || !items.some((item) => item.event_id === selectedEventId.value)) {
      selectedEventId.value = items[0].event_id;
    }
  },
  { immediate: true }
);

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.archive-summary {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-panel {
  border-radius: 28px;
  padding: 22px;
  background: linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.16);
  box-shadow: 0 18px 40px rgba(3, 10, 20, 0.28);
}

.toolbar-panel,
.toolbar-group,
.toolbar-side,
.panel-head,
.content-grid,
.item-top,
.item-meta,
.detail-top,
.detail-actions {
  display: flex;
}

.toolbar-panel,
.panel-head,
.detail-top {
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.toolbar-panel {
  flex-wrap: wrap;
}

.toolbar-group,
.toolbar-side,
.detail-actions {
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.content-grid {
  gap: 18px;
  align-items: stretch;
}

.list-panel {
  flex: 1.1;
}

.detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-head h4 {
  margin: 0;
  color: #f3fbff;
}

.stat-chip,
.status-pill,
.keyword-chip {
  border-radius: 999px;
}

.stat-chip {
  padding: 10px 14px;
  color: #d9f4ff;
  background: rgba(11, 21, 34, 0.86);
  border: 1px solid rgba(71, 209, 255, 0.12);
}

.ghost-button {
  border-radius: 14px;
  border-color: rgba(71, 209, 255, 0.16);
  background: rgba(13, 31, 47, 0.82);
  color: #d9f4ff;
}

.archive-list {
  display: grid;
  gap: 12px;
}

.archive-item,
.detail-card,
.summary-card,
.empty-detail {
  padding: 16px;
  border-radius: 20px;
  background: rgba(8, 18, 31, 0.84);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.archive-item {
  text-align: left;
  cursor: pointer;
  transition: border-color 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease;
}

.archive-item:hover,
.archive-item.active {
  border-color: rgba(71, 209, 255, 0.24);
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(3, 10, 20, 0.28);
}

.archive-item strong,
.detail-card strong {
  color: #f3fbff;
}

.archive-item span,
.archive-item p,
.item-meta span,
.detail-card p,
.summary-card p,
.card-title,
.meta-grid span,
.empty-detail p {
  color: rgba(190, 214, 231, 0.72);
}

.archive-item p,
.summary-card p {
  margin: 10px 0 0;
  line-height: 1.7;
}

.item-top,
.item-meta {
  justify-content: space-between;
  gap: 12px;
}

.item-meta {
  margin-top: 10px;
  font-size: 12px;
}

.status-pill {
  padding: 6px 12px;
  color: #d5d0ff;
  background: rgba(94, 86, 185, 0.24);
}

.meta-grid,
.keyword-list {
  display: grid;
  gap: 10px;
}

.meta-grid {
  margin-top: 14px;
}

.meta-grid span,
.keyword-chip {
  padding: 12px 14px;
  background: rgba(11, 21, 34, 0.86);
}

.card-title {
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.keyword-list {
  grid-template-columns: repeat(auto-fit, minmax(110px, max-content));
}

.keyword-chip {
  color: #9fe7ff;
}

.empty-detail {
  display: grid;
  place-items: center;
  min-height: 220px;
}

@media (max-width: 1320px) {
  .content-grid {
    flex-direction: column;
  }
}
</style>
