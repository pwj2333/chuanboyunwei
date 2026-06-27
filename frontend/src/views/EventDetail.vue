<template>
  <div class="event-detail">
    <section v-if="currentEvent" class="detail-panel hero-panel">
      <div class="hero-main">
        <div>
          <h3>{{ currentEvent.title }}</h3>
          <div class="hero-tags">
            <span class="tag tag-ship">{{ currentEvent.ship_name }}</span>
            <span class="tag" :style="{ color: getStatusMeta(currentEvent.status).color }">
              {{ getStatusMeta(currentEvent.status).label }}
            </span>
            <span class="tag" :style="{ color: getPriorityMeta(currentEvent.priority).color }">
              {{ getPriorityMeta(currentEvent.priority).label }}
            </span>
            <span v-if="currentEvent.event_type_name" class="tag">{{ currentEvent.event_type_name }}</span>
          </div>
        </div>

        <div class="hero-actions">
          <el-button class="ghost-button" @click="$router.push('/events')">返回事件中心</el-button>
          <el-button class="ghost-button" @click="showRecordDialog = true">新增记录</el-button>
          <el-button class="ghost-button" @click="openBranchDialog()">继续派生</el-button>
          <el-button class="ghost-button" @click="showUpdateDialog = true">修改状态</el-button>
          <el-button
            v-if="isActiveBranch"
            type="success"
            @click="completeBranch"
          >
            完成分支
          </el-button>
          <el-button
            v-if="canArchiveRoot"
            type="primary"
            @click="handleArchive"
          >
            归档主事件
          </el-button>
        </div>
      </div>
    </section>

    <section v-if="currentEvent" class="detail-grid">
      <article class="detail-panel topology-panel">
        <div class="panel-head">
          <div>
            <h4>事件分支拓扑</h4>
          </div>
          <el-button
            v-if="activeBranchEvent && activeBranchEvent.id !== currentEvent.id"
            class="ghost-button"
            @click="switchToSelectedBranch"
          >
            切到当前分支
          </el-button>
        </div>

        <RelationCanvas
          :nodes="branchGraph.nodes"
          :edges="branchGraph.edges"
          :selected-id="selectedGraphNodeId"
          min-height="520px"
          empty-title="暂无数据"
          @select="handleGraphSelect"
        />
      </article>

      <aside class="detail-panel insight-panel">
        <div class="panel-head">
          <div>
            <h4>当前节点</h4>
          </div>
        </div>

        <div v-if="activeBranchEvent" class="focus-card">
          <div class="focus-top">
            <strong>{{ activeBranchEvent.title }}</strong>
            <span>{{ isRootEvent ? '主事件' : '分支事件' }}</span>
          </div>
          <p>{{ activeBranchEvent.description || '--' }}</p>

          <div class="meta-grid">
            <span>所属船舶 {{ activeBranchEvent.ship_name }}</span>
            <span>创建人 {{ activeBranchEvent.creator_name || '--' }}</span>
            <span>创建时间 {{ formatDateTime(activeBranchEvent.created_at, { year: undefined }) }}</span>
            <span>督办截止 {{ activeBranchEvent.due_date ? formatDateTime(activeBranchEvent.due_date, { year: undefined }) : '未设置' }}</span>
          </div>
        </div>

        <div class="knowledge-card">
          <div class="card-title">AI 总结</div>
          <template v-if="knowledgeEntry">
            <strong>{{ knowledgeEntry.problem_type || '已生成总结' }}</strong>
            <p>{{ knowledgeEntry.summary }}</p>
            <div class="info-chip">{{ knowledgeEntry.solution || '--' }}</div>
            <div class="info-chip">{{ knowledgeEntry.lessons_learned || '--' }}</div>
          </template>
          <template v-else>
            <p>--</p>
          </template>
        </div>

        <div class="related-card">
          <div class="card-title">相似历史事件</div>
          <div v-if="similarEvents.length" class="related-list">
            <button
              v-for="item in similarEvents"
              :key="item.id"
              type="button"
              class="related-item"
              @click="openEvent(item.event_id)"
            >
              <strong>{{ item.title }}</strong>
              <small>{{ item.problem_type || item.event_type_name || '未分类' }}</small>
            </button>
          </div>
          <el-empty v-else description="暂无数据" :image-size="80" />
        </div>
      </aside>
    </section>

    <section v-if="activeBranchEvent" class="detail-panel records-panel">
      <div class="panel-head">
        <div>
          <h4>处理记录</h4>
        </div>
        <div class="record-target">
          当前记录目标：{{ activeBranchEvent.title }}
        </div>
      </div>

      <el-timeline v-if="recordsList.length">
        <el-timeline-item
          v-for="record in recordsList"
          :key="record.id"
          :timestamp="formatDateTime(record.created_at)"
          placement="top"
        >
          <el-card class="record-card">
            <div class="record-top">
              <strong>{{ record.operator || '系统用户' }}</strong>
              <div v-if="canManageRecord(record)" class="record-actions">
                <el-button class="ghost-button" size="small" @click="startEditRecord(record)">编辑</el-button>
                <el-button type="danger" plain size="small" @click="handleDeleteRecord(record)">删除</el-button>
              </div>
            </div>
            <p>{{ record.content }}</p>
            <div v-if="record.attachments?.length" class="attachment-list">
              <el-tag v-for="attachment in record.attachments" :key="attachment.id">
                <a :href="`/api/attachments/${attachment.id}`" target="_blank">{{ attachment.filename }}</a>
              </el-tag>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无数据" :image-size="88" />
    </section>

    <el-dialog v-model="showRecordDialog" title="新增处理记录" width="620px">
      <el-form :model="newRecord" label-width="90px">
        <el-form-item label="记录内容" required>
          <el-input v-model="newRecord.content" type="textarea" :rows="4" placeholder="请输入处理动作、判断过程或结果反馈" />
        </el-form-item>
        <el-form-item label="附件">
          <el-upload v-model:file-list="fileList" :auto-upload="false" :limit="5" multiple>
            <el-button type="primary">选择文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRecordDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAddRecord">提交记录</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRecordEditDialog" title="编辑备注" width="620px">
      <el-form label-width="90px">
        <el-form-item label="备注内容" required>
          <el-input v-model="editingRecordContent" type="textarea" :rows="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRecordEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="recordEditing" @click="handleUpdateRecord">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showUpdateDialog" title="修改事件状态" width="420px">
      <el-form label-width="90px">
        <el-form-item label="状态">
          <el-select v-model="newStatus" style="width: 100%">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="in_progress" />
            <el-option label="已完成" value="completed" />
            <el-option v-if="isRootEvent" label="已归档" value="archived" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUpdateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateStatus">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showBranchDialog" title="派生分支事件" width="640px">
      <el-form :model="branchEvent" label-width="100px">
        <el-form-item label="上级事件">
          <el-input :model-value="activeBranchEvent?.title || currentEvent?.title || '--'" disabled />
        </el-form-item>
        <el-form-item label="船舶" required>
          <el-select v-model="branchEvent.ship_id" style="width: 100%">
            <el-option v-for="ship in shipList" :key="ship.id" :label="ship.name" :value="ship.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="branchEvent.title" placeholder="请输入分支事件标题" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="branchEvent.description" type="textarea" :rows="4" placeholder="请输入分支事件说明" />
        </el-form-item>
        <el-form-item label="事件类型" required>
          <el-select v-model="branchEvent.event_type_id" style="width: 100%">
            <el-option v-for="item in branchEventTypes" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="branchEvent.priority">
            <el-radio label="high">高优先级</el-radio>
            <el-radio label="medium">中优先级</el-radio>
            <el-radio label="low">低优先级</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="督办时间">
          <el-date-picker
            v-model="branchEvent.due_date"
            type="datetime"
            placeholder="选择督办时间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBranchDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateBranch">创建分支</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { eventTypes, events, knowledge, records as recordsApi, ships } from '@/api';
import RelationCanvas from '@/components/RelationCanvas.vue';
import { buildBranchGraph, formatDateTime, getPriorityMeta, getStatusMeta } from '@/utils/ops';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const treeEvents = ref([]);
const shipList = ref([]);
const eventTypeList = ref([]);
const recordsList = ref([]);
const knowledgeEntry = ref(null);
const similarEvents = ref([]);
const selectedGraphNodeId = ref(null);

const showRecordDialog = ref(false);
const showRecordEditDialog = ref(false);
const showUpdateDialog = ref(false);
const showBranchDialog = ref(false);
const submitting = ref(false);
const recordEditing = ref(false);

const newRecord = ref({ content: '' });
const fileList = ref([]);
const editingRecordId = ref(null);
const editingRecordContent = ref('');
const newStatus = ref('pending');
const branchEvent = ref({
  ship_id: null,
  event_type_id: null,
  title: '',
  description: '',
  priority: 'medium',
  due_date: null
});

const currentEvent = computed(() => treeEvents.value[0] || null);
const branchEventTypes = computed(() => eventTypeList.value.filter((item) => item.scope === 'branch'));

const activeBranchEvent = computed(() => {
  const eventId = Number(String(selectedGraphNodeId.value || '').replace('event-', '') || route.params.id);
  return treeEvents.value.find((event) => event.id === eventId) || currentEvent.value;
});

const activeBranchChildren = computed(() => {
  if (!activeBranchEvent.value) return [];
  return treeEvents.value.filter((event) => event.parent_event_id === activeBranchEvent.value.id);
});

const isRootEvent = computed(() => !!activeBranchEvent.value && !activeBranchEvent.value.parent_event_id);
const isActiveBranch = computed(() => !!activeBranchEvent.value && !!activeBranchEvent.value.parent_event_id);
const canArchiveRoot = computed(() => {
  if (!isRootEvent.value || activeBranchEvent.value?.status !== 'completed') {
    return false;
  }

  return !treeEvents.value.some((event) => event.parent_event_id && ['pending', 'in_progress'].includes(event.status));
});

const branchGraph = computed(() => {
  if (!currentEvent.value) {
    return { nodes: [], edges: [] };
  }

  return buildBranchGraph(treeEvents.value, {
    focusId: currentEvent.value.id,
    startX: 18,
    levelGap: 24,
    startY: 18,
    endY: 82
  });
});

async function loadBaseData() {
  const [eventTree, shipsData, eventTypesData] = await Promise.all([
    events.get(route.params.id),
    ships.list(),
    eventTypes.list()
  ]);

  treeEvents.value = eventTree;
  shipList.value = shipsData;
  eventTypeList.value = eventTypesData;
  selectedGraphNodeId.value = `event-${route.params.id}`;
  newStatus.value = eventTree[0]?.status || 'pending';
}

async function loadRecords() {
  if (!activeBranchEvent.value) return;
  recordsList.value = await recordsApi.list(activeBranchEvent.value.id);
}

async function loadKnowledgeContext() {
  if (!activeBranchEvent.value) return;

  const knowledgeTargetId = isRootEvent.value ? activeBranchEvent.value.id : currentEvent.value?.id;

  try {
    knowledgeEntry.value = await knowledge.get(knowledgeTargetId, {
      suppressErrorStatuses: [404]
    });
  } catch (error) {
    knowledgeEntry.value = null;
  }

  try {
    const result = await knowledge.search(
      activeBranchEvent.value.title,
      activeBranchEvent.value.ship_id,
      activeBranchEvent.value.event_type_id
    );
    similarEvents.value = result.filter((item) => item.event_id !== activeBranchEvent.value.id);
  } catch (error) {
    similarEvents.value = [];
  }
}

function handleGraphSelect(node) {
  selectedGraphNodeId.value = node.id;
}

function canManageRecord(record) {
  if (!record || !authStore.user) {
    return false;
  }

  return authStore.isAdmin || record.operator_id === authStore.user.id;
}

function startEditRecord(record) {
  editingRecordId.value = record.id;
  editingRecordContent.value = record.content || '';
  showRecordEditDialog.value = true;
}

async function handleAddRecord() {
  if (!newRecord.value.content || !activeBranchEvent.value) {
    ElMessage.warning('请先填写记录内容');
    return;
  }

  try {
    submitting.value = true;
    const formData = new FormData();
    formData.append('content', newRecord.value.content);

    fileList.value.forEach((file) => {
      formData.append('attachments', file.raw);
    });

    await recordsApi.create(activeBranchEvent.value.id, formData);
    ElMessage.success('处理记录添加成功');
    showRecordDialog.value = false;
    newRecord.value = { content: '' };
    fileList.value = [];
    await loadRecords();
  } finally {
    submitting.value = false;
  }
}

async function handleUpdateRecord() {
  if (!editingRecordId.value || !editingRecordContent.value.trim()) {
    ElMessage.warning('请先填写记录内容');
    return;
  }

  try {
    recordEditing.value = true;
    await recordsApi.update(editingRecordId.value, {
      content: editingRecordContent.value.trim()
    });
    ElMessage.success('备注已更新');
    showRecordEditDialog.value = false;
    editingRecordId.value = null;
    editingRecordContent.value = '';
    await loadRecords();
  } finally {
    recordEditing.value = false;
  }
}

async function handleDeleteRecord(record) {
  if (!canManageRecord(record)) {
    return;
  }

  await ElMessageBox.confirm(
    '确定删除这条备注吗？',
    '删除确认',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  );

  await recordsApi.delete(record.id);
  ElMessage.success('备注已删除');
  await loadRecords();
}

async function handleUpdateStatus() {
  if (!activeBranchEvent.value) return;

  if (newStatus.value === 'archived') {
    await handleArchive();
    showUpdateDialog.value = false;
    return;
  }

  await events.update(activeBranchEvent.value.id, { status: newStatus.value });
  ElMessage.success('状态更新成功');
  showUpdateDialog.value = false;
  await loadBaseData();
}

async function completeBranch() {
  if (!activeBranchEvent.value || !isActiveBranch.value) return;

  await events.update(activeBranchEvent.value.id, { status: 'completed' });
  ElMessage.success('分支已完成');
  await loadBaseData();
}

async function handleArchive() {
  if (!canArchiveRoot.value || !activeBranchEvent.value) return;

  await ElMessageBox.confirm(
    `归档后将为主事件“${activeBranchEvent.value.title}”生成 AI 总结，是否继续？`,
    '归档确认',
    {
      confirmButtonText: '继续归档',
      cancelButtonText: '取消',
      type: 'warning'
    }
  );

  try {
    await events.archive(activeBranchEvent.value.id);
    ElMessage.success('归档成功，AI 总结正在后台生成');
    await Promise.all([loadBaseData(), loadKnowledgeContext()]);
  } finally {}
}

function openBranchDialog() {
  const target = activeBranchEvent.value || currentEvent.value;
  showBranchDialog.value = true;
  branchEvent.value = {
    ship_id: target?.ship_id || null,
    event_type_id: branchEventTypes.value.some((item) => item.id === target?.event_type_id) ? target?.event_type_id || null : null,
    title: '',
    description: '',
    priority: target?.priority || 'medium',
    due_date: null
  };
}

async function handleCreateBranch() {
  const target = activeBranchEvent.value || currentEvent.value;

  if (!target || !branchEvent.value.ship_id || !branchEvent.value.title || !branchEvent.value.event_type_id) {
    ElMessage.warning('请先完善分支事件的船舶、标题和分支事件标签');
    return;
  }

  const created = await events.create({
    ...branchEvent.value,
    parent_event_id: target.id
  });

  ElMessage.success('分支事件创建成功');
  showBranchDialog.value = false;
  await loadBaseData();
  selectedGraphNodeId.value = `event-${created.id}`;
}

function openEvent(id) {
  router.push(`/events/${id}`);
}

function switchToSelectedBranch() {
  if (activeBranchEvent.value?.id) {
    openEvent(activeBranchEvent.value.id);
  }
}

watch(
  () => route.params.id,
  async () => {
    await loadBaseData();
  },
  { immediate: true }
);

watch(
  activeBranchEvent,
  async (event) => {
    if (!event) return;
    newStatus.value = event.status;
    await Promise.all([loadRecords(), loadKnowledgeContext()]);
  },
  { immediate: true }
);
</script>

<style scoped>
.event-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-panel {
  border-radius: 28px;
  padding: 22px;
  background: linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.16);
  box-shadow: 0 18px 40px rgba(3, 10, 20, 0.28);
}

.hero-main,
.hero-actions,
.hero-tags,
.detail-grid,
.panel-head,
.focus-top {
  display: flex;
}

.hero-main {
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.hero-main h3,
.panel-head h4 {
  margin: 0;
  color: #f3fbff;
}

.hero-main h3 {
  font-size: 30px;
}

.hero-tags,
.hero-actions {
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.tag {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(71, 209, 255, 0.08);
  color: #bfeaff;
}

.tag-ship {
  color: #f3fbff;
}

.ghost-button {
  border-radius: 14px;
  border-color: rgba(71, 209, 255, 0.16);
  background: rgba(13, 31, 47, 0.82);
  color: #d9f4ff;
}

.detail-grid {
  gap: 18px;
  align-items: stretch;
}

.topology-panel {
  flex: 1.7;
}

.insight-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-head {
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.focus-card,
.knowledge-card,
.related-card,
.record-card {
  padding: 16px;
  border-radius: 20px;
  background: rgba(8, 18, 31, 0.84);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.focus-top span,
.focus-card p,
.card-title,
.meta-grid span,
.record-target,
.related-item small {
  color: rgba(190, 214, 231, 0.7);
}

.focus-card strong,
.knowledge-card strong,
.related-item strong {
  color: #f3fbff;
}

.focus-card p,
.knowledge-card p {
  margin: 12px 0 0;
  line-height: 1.7;
}

.meta-grid,
.related-list,
.attachment-list {
  display: grid;
  gap: 10px;
}

.meta-grid {
  margin-top: 14px;
}

.meta-grid span,
.info-chip {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(11, 21, 34, 0.86);
}

.card-title {
  margin-bottom: 10px;
}

.info-chip {
  margin-top: 10px;
  color: rgba(220, 239, 255, 0.82);
}

.related-item {
  padding: 14px;
  border: 1px solid rgba(91, 151, 205, 0.08);
  border-radius: 16px;
  background: rgba(11, 21, 34, 0.86);
  text-align: left;
  cursor: pointer;
}

.records-panel :deep(.el-timeline-item__timestamp) {
  color: rgba(190, 214, 231, 0.7);
}

.record-top strong,
.attachment-list a {
  color: #f3fbff;
}

.record-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.record-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.record-card p {
  margin: 10px 0 0;
  color: rgba(217, 234, 248, 0.74);
  line-height: 1.7;
}

@media (max-width: 1320px) {
  .hero-main,
  .detail-grid {
    flex-direction: column;
  }
}
</style>
