<template>
  <div class="ship-management">
    <section class="page-panel split-layout">
      <article class="manager-card">
        <div class="section-head">
          <div>
            <h3>船舶管理</h3>
          </div>
          <div class="inline-form">
            <el-input v-model="shipName" placeholder="新增船舶名称" @keyup.enter="handleCreateShip" />
            <el-button type="primary" @click="handleCreateShip">新增船舶</el-button>
          </div>
        </div>

        <el-table :data="shipList" style="width: 100%">
          <el-table-column prop="name" label="船舶名称" />
          <el-table-column prop="event_count" label="事件数" width="120" />
          <el-table-column prop="created_at" label="创建时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
      </article>

      <article class="manager-card">
        <div class="section-head section-head-stack">
          <div>
            <h3>事件标签管理</h3>
          </div>

          <div class="scope-grid">
            <div class="scope-box">
              <div class="scope-head">
                <strong>主事件标签</strong>
                <small>{{ mainEventTypes.length }} 个</small>
              </div>
              <div class="inline-form">
                <el-input
                  v-model="mainEventTypeName"
                  placeholder="新增主事件标签"
                  @keyup.enter="handleCreateEventType('main')"
                />
                <el-button type="primary" @click="handleCreateEventType('main')">新增</el-button>
              </div>

              <div class="tag-grid" v-if="mainEventTypes.length">
                <div v-for="item in mainEventTypes" :key="item.id" class="tag-card">
                  <div>
                    <strong>{{ item.name }}</strong>
                    <small>{{ item.event_count || 0 }} 条主事件</small>
                  </div>
                  <el-button type="danger" plain size="small" @click="handleDeleteEventType(item)">
                    删除
                  </el-button>
                </div>
              </div>
              <el-empty v-else description="暂无数据" :image-size="72" />
            </div>

            <div class="scope-box">
              <div class="scope-head">
                <strong>分支事件标签</strong>
                <small>{{ branchEventTypes.length }} 个</small>
              </div>
              <div class="inline-form">
                <el-input
                  v-model="branchEventTypeName"
                  placeholder="新增分支事件标签"
                  @keyup.enter="handleCreateEventType('branch')"
                />
                <el-button type="primary" @click="handleCreateEventType('branch')">新增</el-button>
              </div>

              <div class="tag-grid" v-if="branchEventTypes.length">
                <div v-for="item in branchEventTypes" :key="item.id" class="tag-card">
                  <div>
                    <strong>{{ item.name }}</strong>
                    <small>{{ item.event_count || 0 }} 条分支事件</small>
                  </div>
                  <el-button type="danger" plain size="small" @click="handleDeleteEventType(item)">
                    删除
                  </el-button>
                </div>
              </div>
              <el-empty v-else description="暂无数据" :image-size="72" />
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { eventTypes, ships } from '@/api';

const shipList = ref([]);
const eventTypeList = ref([]);
const shipName = ref('');
const mainEventTypeName = ref('');
const branchEventTypeName = ref('');

const mainEventTypes = computed(() => eventTypeList.value.filter((item) => (item.scope || 'main') === 'main'));
const branchEventTypes = computed(() => eventTypeList.value.filter((item) => item.scope === 'branch'));

function formatDate(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : '--';
}

async function loadData() {
  const [shipsData, eventTypesData] = await Promise.all([
    ships.list(),
    eventTypes.list()
  ]);

  shipList.value = shipsData;
  eventTypeList.value = eventTypesData;
}

async function handleCreateShip() {
  const name = shipName.value.trim();
  if (!name) {
    ElMessage.warning('请输入船舶名称');
    return;
  }

  await ships.create(name);
  shipName.value = '';
  ElMessage.success('船舶新增成功');
  await loadData();
}

async function handleCreateEventType(scope) {
  const source = scope === 'branch' ? branchEventTypeName : mainEventTypeName;
  const name = source.value.trim();

  if (!name) {
    ElMessage.warning(scope === 'branch' ? '请输入分支事件标签' : '请输入主事件标签');
    return;
  }

  await eventTypes.create(name, scope);
  source.value = '';
  ElMessage.success(scope === 'branch' ? '分支事件标签新增成功' : '主事件标签新增成功');
  await loadData();
}

async function handleDeleteEventType(item) {
  const scopeLabel = item.scope === 'branch' ? '分支事件标签' : '主事件标签';

  await ElMessageBox.confirm(
    `确认删除${scopeLabel}“${item.name}”吗？已有事件会保留，但标签会被清空。`,
    '删除确认',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  );

  await eventTypes.delete(item.id);
  ElMessage.success(`${scopeLabel}删除成功`);
  await loadData();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.ship-management {
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

.split-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.manager-card {
  padding: 18px;
  border-radius: 22px;
  background: rgba(8, 18, 31, 0.82);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.section-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.section-head-stack {
  flex-direction: column;
}

.section-head h3 {
  margin: 0;
  color: #f3fbff;
}

.inline-form {
  display: flex;
  gap: 10px;
  width: min(100%, 360px);
}

.scope-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  width: 100%;
}

.scope-box {
  padding: 18px;
  border-radius: 20px;
  background: rgba(11, 21, 34, 0.74);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.scope-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.scope-head strong {
  color: #f3fbff;
}

.scope-head small {
  color: rgba(190, 214, 231, 0.68);
}

.tag-grid {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.tag-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(8, 18, 31, 0.84);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.tag-card strong {
  display: block;
  color: #f3fbff;
}

.tag-card small {
  display: block;
  margin-top: 6px;
  color: rgba(190, 214, 231, 0.68);
}

.ship-management :deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: rgba(8, 18, 31, 0.68);
  --el-table-header-bg-color: rgba(11, 21, 34, 0.88);
  --el-table-border-color: rgba(91, 151, 205, 0.08);
  --el-table-text-color: #e6f3ff;
  --el-table-header-text-color: rgba(198, 215, 231, 0.74);
  --el-fill-color-blank: transparent;
}

@media (max-width: 1400px) {
  .split-layout,
  .scope-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1200px) {
  .section-head {
    flex-direction: column;
  }

  .inline-form {
    width: 100%;
  }
}
</style>
