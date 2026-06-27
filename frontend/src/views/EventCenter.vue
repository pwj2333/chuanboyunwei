<template>
  <div class="event-center">
    <section class="workspace-grid">
      <article class="page-panel lane-board">
        <div v-for="ship in shipBoards" :key="ship.id" class="ship-section">
          <div class="ship-head">
            <div>
              <p class="ship-name">{{ ship.name }}</p>
                <h4>{{ ship.lanes.length ? `共有 ${ship.lanes.length} 条待归档事件链` : '当前无待归档事件' }}</h4>
            </div>
            <div class="ship-stats">
              <span>活跃节点 {{ ship.activeNodes }}</span>
              <span>高优先级 {{ ship.highPriority }}</span>
              <span>备注 {{ ship.recordCount }}</span>
            </div>
          </div>

          <div v-if="ship.lanes.length" class="lane-list">
            <div v-for="lane in ship.lanes" :key="lane.root.id" class="case-lane">
              <div class="lane-summary">
                <span class="lane-label">完整事件链</span>
                <strong>{{ lane.root.title }}</strong>
                <small>
                  {{ lane.activeCount }} 个未完成节点
                  <template v-if="lane.root.status && !activeStatuses.includes(lane.root.status)">
                    ，主事件已{{ getStatusMeta(lane.root.status).label }}
                  </template>
                </small>
              </div>

              <div class="lane-track-shell">
                <div
                  class="lane-track"
                  @wheel="handleTrackWheel"
                  @mousedown="startTrackDrag"
                  @click.capture="suppressTrackClick"
                >
                  <div class="lane-rail"></div>
                  <button
                    v-for="node in lane.nodes"
                    :key="node.id"
                    type="button"
                    class="lane-node"
                    :class="[
                      node.kind,
                      { active: selectedEvent?.id === node.id, muted: !activeStatuses.includes(node.status) }
                    ]"
                    @click="selectEvent(node.id)"
                    @dragstart.prevent
                  >
                    <div class="node-top">
                      <span class="role-chip">{{ node.kind === 'root' ? '主事件' : `分支 L${node.depth}` }}</span>
                      <span class="status-chip" :style="{ color: getStatusMeta(node.status).color }">
                        {{ getStatusMeta(node.status).label }}
                      </span>
                    </div>

                    <strong>{{ node.title }}</strong>
                    <p>{{ node.description || '--' }}</p>

                    <div class="node-foot">
                      <span>{{ getPriorityMeta(node.priority).label }}</span>
                      <span>{{ node.record_count || 0 }} 条备注</span>
                      <span>{{ formatDateTime(node.updated_at || node.created_at, { year: undefined }) }}</span>
                    </div>

                    <div class="node-actions">
                      <button type="button" class="mini-action" @click.stop="openEditDialog(node)">编辑</button>
                      <button type="button" class="mini-action" @click.stop="prepareQuickNote(node)">备注</button>
                      <button type="button" class="mini-action" @click.stop="openCreateDialog(node.id)">分支</button>
                      <button
                        v-if="canArchiveEvent(node)"
                        type="button"
                        class="mini-action archive"
                        @click.stop="handleArchiveEvent(node)"
                      >
                        归档
                      </button>
                      <button
                        v-if="authStore.isAdmin"
                        type="button"
                        class="mini-action danger"
                        @click.stop="handleDeleteEvent(node)"
                      >
                        删除
                      </button>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="ship-empty">暂无数据</div>
        </div>
      </article>

      <aside class="page-panel inspector-panel">
        <div class="panel-head">
          <div>
            <h4>事件编辑与备注</h4>
          </div>
          <div class="panel-head-actions">
            <el-button class="ghost-button" @click="loadData">刷新</el-button>
            <el-button class="ghost-button" @click="openCreateDialog()">新建主事件</el-button>
            <el-button v-if="selectedEvent" class="ghost-button" @click="openEvent(selectedEvent.id)">
              进入详情
            </el-button>
          </div>
        </div>

        <template v-if="selectedEvent">
          <div class="inspector-card">
            <div class="inspector-top">
              <div>
                <strong>{{ selectedEvent.title }}</strong>
                <p>{{ selectedEvent.ship_name }} · {{ getStatusMeta(selectedEvent.status).label }}</p>
              </div>
              <span class="priority-pill" :style="{ color: getPriorityMeta(selectedEvent.priority).color }">
                {{ getPriorityMeta(selectedEvent.priority).label }}
              </span>
            </div>

            <p class="inspector-desc">{{ selectedEvent.description || '--' }}</p>

            <div class="meta-grid">
              <span>创建人 {{ selectedEvent.creator_name || '--' }}</span>
              <span>督办截至 {{ selectedEvent.due_date ? formatDateTime(selectedEvent.due_date, { year: undefined }) : '未设置' }}</span>
              <span>上级事件 {{ selectedParentEvent?.title || '无' }}</span>
              <span>子分支 {{ selectedChildren.length }} 个</span>
            </div>

            <div class="inspector-actions">
              <el-button class="ghost-button" @click="openEditDialog(selectedEvent)">编辑事件</el-button>
              <el-button class="ghost-button" @click="openCreateDialog(selectedEvent.id)">继续派生</el-button>
              <el-button
                v-if="authStore.isAdmin"
                class="danger-button"
                @click="handleDeleteEvent(selectedEvent)"
              >
                删除事件
              </el-button>
            </div>
          </div>

          <div class="note-card">
            <div class="card-title">新增备注</div>
            <el-input
              v-model="quickNote"
              type="textarea"
              :rows="4"
              placeholder="输入备注"
            />
            <div class="note-actions">
              <el-button type="primary" :loading="noteSubmitting" @click="handleQuickNote">
                提交备注
              </el-button>
            </div>
          </div>

          <div class="knowledge-card">
            <div class="card-title">AI 总结</div>
            <template v-if="selectedKnowledge">
              <strong>{{ selectedKnowledge.problem_type || '已生成知识条目' }}</strong>
              <p>{{ selectedKnowledge.summary }}</p>
              <div class="knowledge-chip">{{ selectedKnowledge.solution || '--' }}</div>
            </template>
            <template v-else>
              <p>--</p>
            </template>
          </div>

          <div class="records-card">
            <div class="card-title">最近备注</div>
            <div v-if="selectedRecords.length" class="record-list">
              <div v-for="record in selectedRecords" :key="record.id" class="record-item">
                <div class="record-head">
                  <div class="record-meta">
                    <strong>{{ record.operator || '系统用户' }}</strong>
                    <span>{{ formatDateTime(record.created_at, { year: undefined }) }}</span>
                  </div>
                  <div v-if="canManageRecord(record)" class="record-actions">
                    <button type="button" class="mini-action" @click="startEditRecord(record)">编辑</button>
                    <button type="button" class="mini-action danger" @click="handleDeleteRecord(record)">删除</button>
                  </div>
                </div>
                <p>{{ record.content }}</p>
              </div>
            </div>
            <el-empty v-else description="暂无数据" :image-size="80" />
          </div>
        </template>

        <div v-else class="inspector-empty">
          <div class="empty-actions">
            <el-button class="ghost-button" @click="loadData">刷新</el-button>
            <el-button type="primary" @click="openCreateDialog()">新建主事件</el-button>
          </div>
        </div>
      </aside>
    </section>

    <el-dialog v-model="showCreateDialog" :title="newEvent.parent_event_id ? '派生事件分支' : '创建主事件'" width="680px">
      <el-form :model="newEvent" label-width="100px">
        <el-form-item label="船舶" required>
          <el-select v-model="newEvent.ship_id" placeholder="选择船舶" style="width: 100%">
            <el-option v-for="ship in shipList" :key="ship.id" :label="ship.name" :value="ship.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="上级事件">
          <el-select v-model="newEvent.parent_event_id" clearable placeholder="无则为主事件" style="width: 100%">
            <el-option v-for="event in eventList" :key="event.id" :label="event.title" :value="event.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="事件标题" required>
          <el-input v-model="newEvent.title" placeholder="请输入事件标题" />
        </el-form-item>

        <el-form-item label="事件描述">
          <el-input v-model="newEvent.description" type="textarea" :rows="4" placeholder="请输入事件描述" />
        </el-form-item>

        <el-form-item label="事件类型" required>
          <el-select
            v-model="newEvent.event_type_id"
            :placeholder="newEvent.parent_event_id ? '选择分支事件标签' : '选择主事件标签'"
            style="width: 100%"
          >
            <el-option
              v-for="item in availableCreateEventTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="优先级">
          <el-radio-group v-model="newEvent.priority">
            <el-radio label="high">高优先级</el-radio>
            <el-radio label="medium">中优先级</el-radio>
            <el-radio label="low">低优先级</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="督办时间">
          <el-date-picker
            v-model="newEvent.due_date"
            type="datetime"
            placeholder="选择督办时间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateEvent">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditDialog" title="编辑事件" width="680px">
      <el-form :model="editEvent" label-width="100px">
        <el-form-item label="船舶" required>
          <el-select v-model="editEvent.ship_id" style="width: 100%">
            <el-option v-for="ship in shipList" :key="ship.id" :label="ship.name" :value="ship.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="事件标题" required>
          <el-input v-model="editEvent.title" />
        </el-form-item>
        <el-form-item label="事件描述">
          <el-input v-model="editEvent.description" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="事件类型" required>
          <el-select v-model="editEvent.event_type_id" style="width: 100%">
            <el-option
              v-for="item in availableEditEventTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="editEvent.priority">
            <el-radio label="high">高优先级</el-radio>
            <el-radio label="medium">中优先级</el-radio>
            <el-radio label="low">低优先级</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editEvent.status" style="width: 100%">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="in_progress" />
            <el-option label="已完成" value="completed" />
            <el-option v-if="isRootEventById(editEvent.id)" label="已归档" value="archived" />
          </el-select>
        </el-form-item>
        <el-form-item label="督办时间">
          <el-date-picker
            v-model="editEvent.due_date"
            type="datetime"
            placeholder="选择督办时间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateEvent">保存修改</el-button>
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
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { eventTypes, events, knowledge, records as recordsApi, ships } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime, getPriorityMeta, getStatusMeta } from '@/utils/ops';

const router = useRouter();
const authStore = useAuthStore();

const shipList = ref([]);
const eventTypeList = ref([]);
const eventList = ref([]);
const selectedEventId = ref(null);
const selectedRecords = ref([]);
const selectedKnowledge = ref(null);
const quickNote = ref('');
const noteSubmitting = ref(false);
const showRecordEditDialog = ref(false);
const editingRecordId = ref(null);
const editingRecordContent = ref('');
const recordEditing = ref(false);

const showCreateDialog = ref(false);
const showEditDialog = ref(false);

const dragState = {
  track: null,
  startX: 0,
  scrollLeft: 0,
  moved: false
};

const newEvent = ref({
  ship_id: null,
  event_type_id: null,
  parent_event_id: null,
  title: '',
  description: '',
  priority: 'medium',
  due_date: null
});

const editEvent = ref({
  id: null,
  ship_id: null,
  event_type_id: null,
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  due_date: null
});

const activeStatuses = ['pending', 'in_progress'];

const eventMap = computed(() => {
  return new Map(eventList.value.map((event) => [event.id, event]));
});

const mainEventTypes = computed(() => eventTypeList.value.filter((item) => (item.scope || 'main') === 'main'));
const branchEventTypes = computed(() => eventTypeList.value.filter((item) => item.scope === 'branch'));
const availableCreateEventTypes = computed(() => (newEvent.value.parent_event_id ? branchEventTypes.value : mainEventTypes.value));
const availableEditEventTypes = computed(() => (isRootEventById(editEvent.value.id) ? mainEventTypes.value : branchEventTypes.value));

const childrenMap = computed(() => {
  const map = new Map();
  eventList.value.forEach((event) => {
    const parentId = event.parent_event_id ?? null;
    if (!map.has(parentId)) {
      map.set(parentId, []);
    }
    map.get(parentId).push(event);
  });

  map.forEach((list) => {
    list.sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
  });

  return map;
});

const selectedEvent = computed(() => {
  return eventMap.value.get(selectedEventId.value) || null;
});

const selectedParentEvent = computed(() => {
  if (!selectedEvent.value?.parent_event_id) return null;
  return eventMap.value.get(selectedEvent.value.parent_event_id) || null;
});

const selectedChildren = computed(() => {
  if (!selectedEvent.value) return [];
  return childrenMap.value.get(selectedEvent.value.id) || [];
});

const shipBoards = computed(() => {
  return shipList.value.map((ship) => {
    const shipEvents = eventList.value.filter((event) => event.ship_id === ship.id);
    const roots = shipEvents.filter((event) => !event.parent_event_id || !eventMap.value.has(event.parent_event_id));

    const lanes = roots
      .map((root) => buildLane(root.id))
      .filter(Boolean)
      .sort((left, right) => {
        const rightHigh = right.nodes.filter((node) => node.priority === 'high').length;
        const leftHigh = left.nodes.filter((node) => node.priority === 'high').length;
        return rightHigh - leftHigh || new Date(right.root.updated_at || right.root.created_at) - new Date(left.root.updated_at || left.root.created_at);
      });

    return {
      id: ship.id,
      name: ship.name,
      lanes,
      activeNodes: lanes.reduce((count, lane) => count + lane.activeCount, 0),
      highPriority: lanes.reduce((count, lane) => count + lane.nodes.filter((node) => node.priority === 'high' && activeStatuses.includes(node.status)).length, 0),
      recordCount: lanes.reduce((count, lane) => count + lane.nodes.reduce((sum, node) => sum + (node.record_count || 0), 0), 0)
    };
  });
});

const visibleEventIds = computed(() => {
  return shipBoards.value.flatMap((ship) => ship.lanes.flatMap((lane) => lane.nodes.map((node) => node.id)));
});

function collectSubtree(rootId, depth = 0) {
  const root = eventMap.value.get(rootId);
  if (!root) return [];

  const output = [{ ...root, depth }];
  (childrenMap.value.get(rootId) || []).forEach((child) => {
    output.push(...collectSubtree(child.id, depth + 1));
  });
  return output;
}

function buildLane(rootId) {
  const nodes = collectSubtree(rootId);
  const root = nodes[0];
  if (!root || root.status === 'archived') {
    return null;
  }

  const activeCount = nodes.filter((node) => activeStatuses.includes(node.status)).length;
  const visibleNodes = nodes.map((node) => ({
    ...node,
    kind: node.id === root.id ? 'root' : 'branch'
  }));

  return {
    root,
    nodes: visibleNodes,
    activeCount
  };
}

function normalizeDateValue(value) {
  return value ? new Date(value) : null;
}

function selectEvent(id) {
  selectedEventId.value = id;
}

function openCreateDialog(parentEventId = null) {
  const parent = parentEventId ? eventMap.value.get(parentEventId) : null;
  const availableTypes = parentEventId ? branchEventTypes.value : mainEventTypes.value;
  const inheritedTypeId = availableTypes.some((item) => item.id === parent?.event_type_id) ? parent?.event_type_id || null : null;

  showCreateDialog.value = true;
  newEvent.value = {
    ship_id: parent?.ship_id || null,
    event_type_id: inheritedTypeId,
    parent_event_id: parentEventId,
    title: '',
    description: '',
    priority: parent?.priority || 'medium',
    due_date: null
  };
}

function openEditDialog(event) {
  const availableTypes = event.parent_event_id ? branchEventTypes.value : mainEventTypes.value;
  const safeEventTypeId = availableTypes.some((item) => item.id === event.event_type_id) ? event.event_type_id || null : null;

  showEditDialog.value = true;
  editEvent.value = {
    id: event.id,
    ship_id: event.ship_id,
    event_type_id: safeEventTypeId,
    title: event.title,
    description: event.description || '',
    priority: event.priority,
    status: event.status,
    due_date: normalizeDateValue(event.due_date)
  };
}

function isRootEventById(id) {
  if (!id) return false;
  return !eventMap.value.get(id)?.parent_event_id;
}

function canArchiveEvent(event) {
  if (!event || event.parent_event_id || event.status !== 'completed') {
    return false;
  }

  return !collectSubtree(event.id).some((item) => item.id !== event.id && activeStatuses.includes(item.status));
}

function prepareQuickNote(event) {
  selectedEventId.value = event.id;
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

function handleTrackWheel(event) {
  const track = event.currentTarget;

  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
    return;
  }

  event.preventDefault();
  track.scrollLeft += event.deltaY;
}

function startTrackDrag(event) {
  if (event.button !== 0) {
    return;
  }

  const track = event.currentTarget;
  dragState.track = track;
  dragState.startX = event.clientX;
  dragState.scrollLeft = track.scrollLeft;
  dragState.moved = false;
  track.classList.add('dragging');

  window.addEventListener('mousemove', handleTrackDrag);
  window.addEventListener('mouseup', stopTrackDrag);
}

function handleTrackDrag(event) {
  if (!dragState.track) {
    return;
  }

  const delta = event.clientX - dragState.startX;

  if (Math.abs(delta) > 4) {
    dragState.moved = true;
  }

  dragState.track.scrollLeft = dragState.scrollLeft - delta;
}

function stopTrackDrag() {
  if (!dragState.track) {
    return;
  }

  const track = dragState.track;
  track.classList.remove('dragging');

  if (dragState.moved) {
    track.dataset.dragClickSuppressed = 'true';
    window.setTimeout(() => {
      delete track.dataset.dragClickSuppressed;
    }, 80);
  }

  dragState.track = null;
  dragState.moved = false;

  window.removeEventListener('mousemove', handleTrackDrag);
  window.removeEventListener('mouseup', stopTrackDrag);
}

function suppressTrackClick(event) {
  const track = event.currentTarget;

  if (track.dataset.dragClickSuppressed === 'true') {
    event.preventDefault();
    event.stopPropagation();
  }
}

async function loadData() {
  const [shipsData, eventTypesData, eventsData] = await Promise.all([
    ships.list(),
    eventTypes.list(),
    events.list()
  ]);

  shipList.value = shipsData;
  eventTypeList.value = eventTypesData;
  eventList.value = eventsData;

  const firstVisible = visibleEventIds.value[0] || null;
  if (!selectedEventId.value || !visibleEventIds.value.includes(selectedEventId.value)) {
    selectedEventId.value = firstVisible;
  }
}

async function loadSelectedContext() {
  if (!selectedEvent.value) {
    selectedRecords.value = [];
    selectedKnowledge.value = null;
    return;
  }

  selectedRecords.value = await recordsApi.list(selectedEvent.value.id);

  try {
    selectedKnowledge.value = await knowledge.get(selectedEvent.value.id, {
      suppressErrorStatuses: [404]
    });
  } catch (error) {
    selectedKnowledge.value = null;
  }
}

async function handleCreateEvent() {
  if (!newEvent.value.ship_id || !newEvent.value.title || !newEvent.value.event_type_id) {
    ElMessage.warning(newEvent.value.parent_event_id ? '请先选择船舶、填写标题并选择分支事件标签' : '请先选择船舶、填写标题并选择主事件标签');
    return;
  }

  const payload = {
    ...newEvent.value,
    event_type_id: newEvent.value.event_type_id,
    due_date: newEvent.value.due_date || null
  };

  const created = await events.create(payload);
  ElMessage.success(newEvent.value.parent_event_id ? '分支事件创建成功' : '主事件创建成功');
  showCreateDialog.value = false;
  await loadData();
  selectedEventId.value = created.id;
}

async function handleUpdateEvent() {
  if (!editEvent.value.id || !editEvent.value.ship_id || !editEvent.value.title || !editEvent.value.event_type_id) {
    ElMessage.warning('请完善事件信息并选择正确的事件标签后再保存');
    return;
  }

  if (editEvent.value.status === 'archived') {
    await ElMessageBox.confirm(
      `归档后将为主事件“${editEvent.value.title}”生成 AI 总结，是否继续？`,
      '归档确认',
      {
        confirmButtonText: '继续归档',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    await events.archive(editEvent.value.id);
    ElMessage.success('主事件已归档');
    showEditDialog.value = false;
    await loadData();
    selectedEventId.value = editEvent.value.id;
    return;
  }

  await events.update(editEvent.value.id, {
    ship_id: editEvent.value.ship_id,
    event_type_id: editEvent.value.event_type_id,
    title: editEvent.value.title,
    description: editEvent.value.description,
    priority: editEvent.value.priority,
    status: editEvent.value.status,
    due_date: editEvent.value.due_date || null
  });

  ElMessage.success('事件更新成功');
  showEditDialog.value = false;
  await loadData();
  selectedEventId.value = editEvent.value.id;
}

async function handleQuickNote() {
  if (!selectedEvent.value || !quickNote.value.trim()) {
    ElMessage.warning('请先输入备注内容');
    return;
  }

  try {
    noteSubmitting.value = true;
    const formData = new FormData();
    formData.append('content', quickNote.value.trim());
    await recordsApi.create(selectedEvent.value.id, formData);
    ElMessage.success('备注已记录，AI 总结会参考这条内容');
    quickNote.value = '';
    await Promise.all([loadData(), loadSelectedContext()]);
  } finally {
    noteSubmitting.value = false;
  }
}

async function handleUpdateRecord() {
  if (!editingRecordId.value || !editingRecordContent.value.trim()) {
    ElMessage.warning('请先输入备注内容');
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
    await Promise.all([loadData(), loadSelectedContext()]);
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
  await Promise.all([loadData(), loadSelectedContext()]);
}

async function handleArchiveEvent(event) {
  if (!canArchiveEvent(event)) {
    ElMessage.warning('请先完成主事件和全部分支后再归档');
    return;
  }

  await ElMessageBox.confirm(
    `归档后会立即归档事件“${event.title}”，AI 总结将在后台生成。是否继续？`,
    '归档确认',
    {
      confirmButtonText: '继续归档',
      cancelButtonText: '取消',
      type: 'warning'
    }
  );

  await events.archive(event.id);
  ElMessage.success('归档成功，AI 总结正在后台生成');

  if (selectedEventId.value === event.id) {
    selectedEventId.value = null;
  }

  await loadData();
}

async function handleDeleteEvent(event) {
  if (!event || !authStore.isAdmin) {
    return;
  }

  const childCount = (childrenMap.value.get(event.id) || []).length;
  const warning = childCount
    ? `该事件下还有 ${childCount} 个直接子分支。删除后，这些子分支会变成独立主线继续保留。`
    : '删除后无法恢复。';

  await ElMessageBox.confirm(
    `确定删除事件「${event.title}」吗？${warning}`,
    '删除确认',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  );

  await events.delete(event.id);
  ElMessage.success('事件已删除');

  if (selectedEventId.value === event.id) {
    selectedEventId.value = null;
  }

  await loadData();
}

function openEvent(id) {
  router.push(`/events/${id}`);
}

watch(
  () => selectedEventId.value,
  async () => {
    await loadSelectedContext();
  },
  { immediate: true }
);

watch(
  () => newEvent.value.parent_event_id,
  (parentEventId) => {
    const parent = parentEventId ? eventMap.value.get(parentEventId) : null;
    const availableTypes = parentEventId ? branchEventTypes.value : mainEventTypes.value;

    newEvent.value.ship_id = parent?.ship_id || newEvent.value.ship_id;

    if (!availableTypes.some((item) => item.id === newEvent.value.event_type_id)) {
      newEvent.value.event_type_id = null;
    }
  }
);

onMounted(async () => {
  await loadData();
});

onBeforeUnmount(() => {
  stopTrackDrag();
});
</script>

<style scoped>
.event-center {
  min-height: calc(100vh - 180px);
}

.page-panel {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  padding: 22px;
  background:
    linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.16);
  box-shadow: 0 18px 40px rgba(3, 10, 20, 0.28);
}

.page-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 0%, rgba(97, 232, 255, 0.05) 45%, transparent 100%);
  transform: translateX(-120%);
  animation: sweep 8s linear infinite;
  pointer-events: none;
}

.panel-head h4,
.ship-head h4 {
  margin: 0;
  color: #f3fbff;
}

.ship-empty,
.inspector-desc,
.knowledge-card p,
.record-item p {
  margin-top: 12px;
  color: rgba(217, 234, 248, 0.74);
  line-height: 1.75;
}

.ship-stats span,
.node-foot span,
.record-head span {
  color: rgba(190, 214, 231, 0.68);
}

.record-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inspector-actions,
.note-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.ship-name,
.lane-summary strong,
.inspector-top strong,
.record-head strong,
.knowledge-card strong,
.record-item strong {
  color: #f3fbff;
}

.ghost-button {
  border-radius: 14px;
  border-color: rgba(71, 209, 255, 0.16);
  background: rgba(13, 31, 47, 0.82);
  color: #d9f4ff;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 1.65fr 1fr;
  gap: 18px;
}

.lane-board {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ship-section {
  padding: 18px;
  border-radius: 22px;
  background: rgba(8, 18, 31, 0.82);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.ship-head,
.ship-stats,
.panel-head,
.panel-head-actions,
.empty-actions,
.inspector-top,
.record-head,
.node-top,
.node-foot,
.node-actions {
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

.ship-name {
  margin: 0;
  font-size: 13px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: #61e8ff;
}

.ship-stats,
.panel-head-actions,
.empty-actions {
  flex-wrap: wrap;
}

.lane-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.case-lane {
  padding: 16px;
  border-radius: 20px;
  background: rgba(5, 14, 25, 0.86);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.lane-summary {
  margin-bottom: 14px;
}

.lane-label,
.lane-summary small,
.role-chip,
.status-chip,
.priority-pill,
.card-title {
  font-size: 12px;
}

.lane-label,
.lane-summary small,
.ship-empty,
.inspector-top p,
.meta-grid span,
.note-actions span,
.knowledge-chip {
  color: rgba(190, 214, 231, 0.68);
}

.lane-track-shell {
  position: relative;
}

.lane-track-shell::before,
.lane-track-shell::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 24px;
  z-index: 2;
  pointer-events: none;
}

.lane-track-shell::before {
  left: 0;
  background: linear-gradient(90deg, rgba(5, 14, 25, 0.98), rgba(5, 14, 25, 0));
}

.lane-track-shell::after {
  right: 0;
  background: linear-gradient(270deg, rgba(5, 14, 25, 0.98), rgba(5, 14, 25, 0));
}

.lane-track {
  position: relative;
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 26px 18px;
  cursor: grab;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.lane-track::-webkit-scrollbar {
  display: none;
}

.lane-track.dragging {
  cursor: grabbing;
  user-select: none;
}

.lane-rail {
  position: absolute;
  top: 52%;
  left: 26px;
  right: 26px;
  height: 2px;
  background: linear-gradient(90deg, rgba(71, 209, 255, 0.28), rgba(84, 241, 181, 0.18));
  transform: translateY(-50%);
}

.lane-rail::after {
  content: '';
  position: absolute;
  left: 0;
  top: -1px;
  width: 120px;
  height: 4px;
  background: linear-gradient(90deg, transparent 0%, rgba(97, 232, 255, 0.8) 45%, transparent 100%);
  animation: railMove 4.2s linear infinite;
}

.lane-node {
  position: relative;
  z-index: 1;
  min-width: 288px;
  max-width: 288px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  text-align: left;
  border-radius: 20px;
  border: 1px solid rgba(91, 151, 205, 0.1);
  background:
    linear-gradient(180deg, rgba(11, 21, 34, 0.94), rgba(7, 15, 26, 0.96));
  color: inherit;
  cursor: pointer;
  transition: transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease;
  overflow: hidden;
  -webkit-user-drag: none;
}

.lane-node::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(125deg, transparent 0%, rgba(97, 232, 255, 0.08) 48%, transparent 100%);
  transform: translateX(-120%);
  transition: transform 0.38s ease;
}

.lane-node:hover::after,
.lane-node.active::after {
  transform: translateX(120%);
}

.lane-node:hover,
.lane-node.active {
  transform: translateY(-4px);
  border-color: rgba(71, 209, 255, 0.24);
  box-shadow:
    0 20px 36px rgba(3, 10, 20, 0.38),
    0 0 0 1px rgba(71, 209, 255, 0.12);
}

.lane-node.root {
  background:
    linear-gradient(180deg, rgba(9, 35, 56, 0.96), rgba(7, 18, 32, 0.98));
}

.lane-node.muted {
  opacity: 0.74;
}

.role-chip,
.status-chip,
.priority-pill {
  padding: 4px 10px;
  border-radius: 999px;
}

.role-chip {
  color: #bfeaff;
  background: rgba(71, 209, 255, 0.08);
}

.lane-node strong {
  font-size: 16px;
}

.lane-node p {
  min-height: 66px;
  color: rgba(217, 234, 248, 0.74);
  line-height: 1.7;
}

.node-actions {
  margin-top: auto;
}

.mini-action {
  padding: 0;
  border: none;
  background: transparent;
  color: #61e8ff;
  cursor: pointer;
}

.mini-action.danger {
  color: #ff7f8c;
}

.mini-action.archive {
  color: #54f1b5;
}

.inspector-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-head {
  margin-bottom: 0;
}

.inspector-card,
.note-card,
.knowledge-card,
.records-card,
.record-item {
  padding: 16px;
  border-radius: 20px;
  background: rgba(8, 18, 31, 0.84);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.priority-pill {
  background: rgba(71, 209, 255, 0.08);
}

.danger-button {
  border-radius: 14px;
  border-color: rgba(255, 107, 107, 0.18);
  background: rgba(56, 17, 26, 0.86);
  color: #ffd1d5;
}

.meta-grid,
.record-list {
  display: grid;
  gap: 10px;
}

.meta-grid {
  margin-top: 14px;
}

.meta-grid span,
.knowledge-chip {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(11, 21, 34, 0.86);
}

.card-title {
  margin-bottom: 10px;
  color: #61e8ff;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.inspector-empty {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 34px 20px;
  border-radius: 22px;
  color: rgba(198, 215, 231, 0.7);
  text-align: center;
  background: rgba(8, 18, 31, 0.82);
}

.inspector-empty p {
  margin: 0;
}

@keyframes railMove {
  0% {
    transform: translateX(-40px);
    opacity: 0;
  }

  15% {
    opacity: 1;
  }

  100% {
    transform: translateX(calc(100vw - 420px));
    opacity: 0;
  }
}

@keyframes sweep {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(140%);
  }
}

@media (max-width: 1520px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1080px) {
  .ship-head,
  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 720px) {
  .lane-node {
    min-width: 250px;
    max-width: 250px;
  }

  .panel-head-actions,
  .empty-actions {
    justify-content: flex-start;
  }
}
</style>
