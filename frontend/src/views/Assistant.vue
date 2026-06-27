<template>
  <div class="assistant-page">
    <section class="topbar">
      <div class="topbar-chips">
        <div class="stat-chip">历史案例 {{ lastContext.similarEvents.length }}</div>
        <div class="stat-chip">命中备注 {{ lastContext.matchingRecords.length }}</div>
      </div>

      <div class="topbar-actions">
        <el-button v-if="authStore.isAdmin" class="ghost-button" @click="openSkillDialog">Skill</el-button>
        <el-button class="ghost-button" @click="resetConversation">新对话</el-button>
      </div>
    </section>

    <section class="content-grid">
      <article class="page-panel chat-panel">
        <div class="panel-head">
          <h4>船舶运维专家</h4>
        </div>

        <div ref="messageViewport" class="message-viewport">
          <div v-for="item in messages" :key="item.id" class="message-row" :class="item.role">
            <div class="message-card">
              <div class="message-role">{{ item.role === 'user' ? '我' : '船舶运维专家' }}</div>
              <div class="message-content">{{ item.content || (item.streaming ? '思考中...' : '--') }}</div>
            </div>
          </div>
        </div>

        <div class="composer">
          <el-input
            v-model="draft"
            type="textarea"
            :rows="4"
            resize="none"
            placeholder="输入问题"
            @keydown.enter.exact.prevent="handleSend"
          />
          <div class="composer-actions">
            <div class="composer-buttons">
              <el-button v-if="streaming" class="ghost-button" @click="abortStreaming">停止</el-button>
              <el-button type="primary" :loading="streaming" @click="handleSend">发送</el-button>
            </div>
          </div>
        </div>
      </article>

      <aside class="side-stack">
        <section class="page-panel context-panel">
          <div class="panel-head">
            <h4>知识命中</h4>
          </div>

          <div class="context-section">
            <div class="card-title">历史案例</div>
            <div v-if="lastContext.similarEvents.length" class="context-list">
              <div v-for="item in lastContext.similarEvents" :key="item.event_id" class="context-card">
                <strong>{{ item.title }}</strong>
                <span>{{ item.ship_name }} / {{ item.event_type_name || '未分类' }}</span>
                <p>{{ item.summary || '--' }}</p>
              </div>
            </div>
            <el-empty v-else :image-size="80" />
          </div>

          <div class="context-section">
            <div class="card-title">相关备注</div>
            <div v-if="lastContext.matchingRecords.length" class="context-list">
              <div v-for="item in lastContext.matchingRecords" :key="item.id" class="context-card">
                <strong>{{ item.event_title }}</strong>
                <span>{{ item.ship_name }}</span>
              </div>
            </div>
            <el-empty v-else :image-size="80" />
          </div>
        </section>

        <section class="page-panel history-panel">
          <div class="panel-head">
            <h4>历史记录</h4>
          </div>

          <div v-if="conversationHistory.length" class="history-list">
            <div
              v-for="item in conversationHistory"
              :key="item.id"
              class="history-item"
              :class="{ active: activeConversationId === item.id }"
            >
              <button type="button" class="history-main" @click="loadConversation(item.id)">
                <strong>{{ item.title }}</strong>
                <span>{{ item.preview || '--' }}</span>
                <small>{{ formatHistoryTime(item.updated_at) }}</small>
              </button>
              <button type="button" class="history-delete" @click="handleDeleteConversation(item.id)">
                删除
              </button>
            </div>
          </div>
          <el-empty v-else :image-size="72" />
        </section>
      </aside>
    </section>

    <el-dialog
      v-model="skillDialogVisible"
      title="编辑Skill"
      width="760px"
      class="skill-dialog"
      destroy-on-close
    >
      <el-input
        v-model="skillDraft"
        type="textarea"
        :rows="16"
        resize="none"
        placeholder="输入船舶运维专家提示词"
      />
      <template #footer>
        <div class="dialog-actions">
          <el-button @click="skillDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="skillSaving" @click="saveSkill">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { assistant, config } from '@/api';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const messageViewport = ref(null);
const draft = ref('');
const streaming = ref(false);
const abortController = ref(null);
const messageSeed = ref(1);
const skillDialogVisible = ref(false);
const skillDraft = ref('');
const skillSaving = ref(false);
const activeConversationId = ref(null);
const conversationHistory = ref([]);
const typingQueue = [];
let typingTimer = null;
let typingDrainResolver = null;

const messages = ref([
  {
    id: 0,
    role: 'assistant',
    content: '请输入问题。',
    streaming: false
  }
]);

const lastContext = ref({
  similarEvents: [],
  matchingRecords: []
});

function createMessage(role, content = '', streamingState = false) {
  return {
    id: messageSeed.value++,
    role,
    content,
    streaming: streamingState
  };
}

function normalizeLoadedMessages(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && ['user', 'assistant'].includes(item.role))
    .map((item, index) => ({
      id: item.id || messageSeed.value + index,
      role: item.role,
      content: String(item.content || ''),
      streaming: false
    }));
}

function buildConversationPayload() {
  return messages.value
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      role: item.role,
      content: item.content
    }));
}

async function scrollToBottom() {
  await nextTick();
  const el = messageViewport.value;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}

function resolveTypingDrain() {
  if (typingDrainResolver) {
    const resolve = typingDrainResolver;
    typingDrainResolver = null;
    resolve();
  }
}

function clearTypingState() {
  typingQueue.length = 0;

  if (typingTimer) {
    window.clearTimeout(typingTimer);
    typingTimer = null;
  }

  resolveTypingDrain();
}

function pumpTypingQueue() {
  if (!typingQueue.length) {
    typingTimer = null;
    resolveTypingDrain();
    return;
  }

  const nextChar = typingQueue.shift();
  nextChar.message.content += nextChar.char;
  scrollToBottom();
  typingTimer = window.setTimeout(pumpTypingQueue, nextChar.char === '\n' ? 8 : 16);
}

function enqueueTyping(message, chunk) {
  for (const char of chunk) {
    typingQueue.push({ message, char });
  }

  if (!typingTimer) {
    pumpTypingQueue();
  }
}

function waitForTypingComplete() {
  if (!typingQueue.length && !typingTimer) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    typingDrainResolver = resolve;
  });
}

function resetConversation() {
  abortStreaming();
  clearTypingState();
  activeConversationId.value = null;
  messages.value = [
    {
      id: 0,
      role: 'assistant',
      content: '请输入问题。',
      streaming: false
    }
  ];
  lastContext.value = {
    similarEvents: [],
    matchingRecords: []
  };
}

function abortStreaming() {
  abortController.value?.abort();
  abortController.value = null;
  streaming.value = false;
  clearTypingState();
}

async function refreshConversationHistory() {
  try {
    conversationHistory.value = await assistant.listConversations();
  } catch (error) {
    ElMessage.error(error.message || '读取历史记录失败');
  }
}

async function loadConversation(id) {
  if (streaming.value) {
    return;
  }

  try {
    const data = await assistant.getConversation(id);
    const loadedMessages = normalizeLoadedMessages(data?.messages);
    if (!loadedMessages.length) {
      return;
    }

    clearTypingState();
    activeConversationId.value = data.id;
    messages.value = loadedMessages;
    messageSeed.value = Math.max(...loadedMessages.map((item) => Number(item.id) || 0), 0) + 1;
    await scrollToBottom();
  } catch (error) {
    ElMessage.error(error.message || '读取历史详情失败');
  }
}

async function handleDeleteConversation(id) {
  if (streaming.value) {
    return;
  }

  try {
    await ElMessageBox.confirm('确认删除这条历史记录？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    });
  } catch {
    return;
  }

  try {
    await assistant.deleteConversation(id);

    if (activeConversationId.value === id) {
      resetConversation();
    }

    await refreshConversationHistory();
    ElMessage.success('历史记录已删除');
  } catch (error) {
    ElMessage.error(error.message || '删除历史记录失败');
  }
}

function formatHistoryTime(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function openSkillDialog() {
  try {
    const data = await config.getAssistantSkill();
    skillDraft.value = data?.prompt_text || '';
    skillDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error.message || '读取Skill失败');
  }
}

async function saveSkill() {
  const promptText = skillDraft.value.trim();
  if (!promptText) {
    ElMessage.error('Skill提示词不能为空');
    return;
  }

  skillSaving.value = true;

  try {
    const data = await config.saveAssistantSkill(promptText);
    skillDraft.value = data?.prompt_text || promptText;
    skillDialogVisible.value = false;
    ElMessage.success('Skill已保存');
  } catch (error) {
    ElMessage.error(error.message || '保存Skill失败');
  } finally {
    skillSaving.value = false;
  }
}

async function handleSend() {
  const question = draft.value.trim();
  if (!question || streaming.value) {
    return;
  }

  const userMessage = createMessage('user', question, false);
  const assistantMessage = createMessage('assistant', '', true);
  messages.value.push(userMessage, assistantMessage);
  draft.value = '';
  streaming.value = true;
  abortController.value = new AbortController();
  await scrollToBottom();

  try {
    await assistant.streamChat({
      messages: buildConversationPayload(),
      conversationId: activeConversationId.value,
      signal: abortController.value.signal,
      onMeta: (context) => {
        activeConversationId.value = context?.conversationId || activeConversationId.value;
        lastContext.value = {
          similarEvents: context?.similarEvents || [],
          matchingRecords: context?.matchingRecords || []
        };
      },
      onDelta: (chunk) => {
        enqueueTyping(assistantMessage, chunk);
      }
    });

    await waitForTypingComplete();
    assistantMessage.streaming = false;
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = '--';
    }
    await refreshConversationHistory();
  } catch (error) {
    if (error.name === 'AbortError') {
      assistantMessage.content = assistantMessage.content || '已停止';
    } else {
      clearTypingState();
      messages.value.pop();
      ElMessage.error(error.message || 'AI问答失败');
    }
  } finally {
    assistantMessage.streaming = false;
    streaming.value = false;
    abortController.value = null;
    await scrollToBottom();
  }
}

onMounted(async () => {
  await refreshConversationHistory();
  await scrollToBottom();
});
</script>

<style scoped>
.assistant-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.topbar,
.topbar-chips,
.topbar-actions,
.panel-head,
.composer-actions,
.composer-buttons,
.dialog-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar,
.panel-head,
.composer-actions {
  justify-content: space-between;
  flex-wrap: wrap;
}

.topbar-chips,
.topbar-actions,
.composer-buttons {
  flex-wrap: wrap;
}

.page-panel {
  border-radius: 28px;
  padding: 22px;
  background: linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.16);
  box-shadow: 0 18px 40px rgba(3, 10, 20, 0.28);
}

.stat-chip {
  padding: 10px 14px;
  border-radius: 999px;
  color: #d9f4ff;
  background: rgba(11, 21, 34, 0.86);
  border: 1px solid rgba(71, 209, 255, 0.12);
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.95fr);
  gap: 18px;
}

.side-stack {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.chat-panel,
.context-panel,
.history-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.panel-head h4 {
  margin: 0;
  color: #f3fbff;
}

.message-viewport {
  min-height: 560px;
  max-height: 68vh;
  overflow: auto;
  display: grid;
  gap: 16px;
  padding: 6px 4px;
}

.message-row {
  display: flex;
  align-items: flex-start;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.assistant {
  justify-content: flex-start;
}

.message-card {
  flex: 0 0 auto;
  width: fit-content;
  display: inline-block;
  max-width: min(52%, 520px);
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(8, 18, 31, 0.88);
  border: 1px solid rgba(91, 151, 205, 0.08);
  box-shadow: 0 14px 28px rgba(2, 8, 17, 0.18);
}

.message-row.user .message-card {
  max-width: min(34%, 320px);
  background: linear-gradient(135deg, rgba(16, 53, 77, 0.94), rgba(10, 29, 43, 0.98));
  border-color: rgba(97, 232, 255, 0.16);
}

.message-role {
  margin-bottom: 8px;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(190, 214, 231, 0.68);
}

.message-content {
  white-space: pre-wrap;
  line-height: 1.78;
  color: #f3fbff;
}

.composer {
  padding: 16px;
  border-radius: 20px;
  background: rgba(8, 18, 31, 0.88);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.composer-actions {
  margin-top: 14px;
}

.context-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-title {
  color: #61e8ff;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.context-list,
.history-list {
  display: grid;
  gap: 12px;
}

.context-card,
.history-item {
  padding: 16px;
  border-radius: 20px;
  background: rgba(8, 18, 31, 0.84);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.context-card strong,
.history-item strong {
  display: block;
  color: #f3fbff;
}

.context-card span,
.context-card p,
.history-item span,
.history-item small {
  display: block;
  margin-top: 8px;
  color: rgba(190, 214, 231, 0.72);
  line-height: 1.72;
}

.history-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.history-main {
  width: 100%;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  color: inherit;
}

.history-item.active,
.history-item:hover {
  border-color: rgba(97, 232, 255, 0.2);
  background: rgba(11, 28, 44, 0.92);
}

.history-delete {
  flex: 0 0 auto;
  min-width: 56px;
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 116, 116, 0.18);
  background: rgba(52, 18, 24, 0.56);
  color: #ffb1b1;
  cursor: pointer;
}

.ghost-button {
  border-radius: 14px;
  border-color: rgba(71, 209, 255, 0.16);
  background: rgba(13, 31, 47, 0.82);
  color: #d9f4ff;
}

.dialog-actions {
  justify-content: flex-end;
}

:deep(.skill-dialog .el-dialog) {
  border-radius: 26px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(9, 21, 36, 0.98), rgba(6, 13, 24, 0.99));
  border: 1px solid rgba(91, 151, 205, 0.18);
}

:deep(.skill-dialog .el-dialog__title) {
  color: #f3fbff;
}

@media (max-width: 1280px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .message-card,
  .message-row.user .message-card {
    min-width: 0;
    max-width: 100%;
  }
}
</style>
