<template>
  <div class="settings-container">
    <section class="page-panel page-banner">
      <div>
        <h3>系统设置</h3>
      </div>
    </section>

    <section class="page-panel">
      <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="AI配置" name="ai">
        <el-card>
          <el-form :model="aiConfig" label-width="120px">
            <el-form-item label="API Base URL" required>
              <el-input v-model="aiConfig.api_base_url" placeholder="https://api.openai.com/v1" />
            </el-form-item>
            <el-form-item label="API Key" required>
              <el-input v-model="aiConfig.api_key" type="password" placeholder="sk-..." />
            </el-form-item>
            <el-form-item label="模型名称">
              <el-input v-model="aiConfig.model_name" placeholder="gpt-3.5-turbo" />
            </el-form-item>
            <el-form-item label="Temperature">
              <el-slider v-model="aiConfig.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="Max Tokens">
              <el-input-number v-model="aiConfig.max_tokens" :min="100" :max="4000" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveAIConfig">保存配置</el-button>
              <el-button @click="testAIConfig">测试连接</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="机器人通知" name="bot">
        <el-card>
          <el-button type="primary" @click="showBotDialog = true" style="margin-bottom: 16px">添加机器人</el-button>

          <el-table :data="bots" style="width: 100%">
            <el-table-column prop="bot_type" label="类型" width="120">
              <template #default="{ row }">
                {{ row.bot_type === 'wechat_work' ? '企业微信' : '飞书' }}
              </template>
            </el-table-column>
            <el-table-column prop="webhook_url" label="Webhook URL" />
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" :active-value="1" :inactive-value="0" @change="updateBot(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button size="small" @click="testBot(row.id)">测试</el-button>
                <el-button size="small" type="danger" @click="deleteBot(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="showBotDialog" title="添加机器人" width="600px">
      <el-form :model="newBot" label-width="120px">
        <el-form-item label="机器人类型" required>
          <el-radio-group v-model="newBot.bot_type">
            <el-radio label="wechat_work">企业微信</el-radio>
            <el-radio label="feishu">飞书</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Webhook URL" required>
          <el-input v-model="newBot.webhook_url" placeholder="https://..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBotDialog = false">取消</el-button>
        <el-button type="primary" @click="addBot">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { config } from '@/api';
import { ElMessage } from 'element-plus';

const activeTab = ref('ai');

const aiConfig = ref({
  api_base_url: '',
  api_key: '',
  model_name: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: 2000
});

const bots = ref([]);
const showBotDialog = ref(false);
const newBot = ref({
  bot_type: 'wechat_work',
  webhook_url: ''
});

const loadAIConfig = async () => {
  try {
    const data = await config.getAI();
    if (data) {
      aiConfig.value = { ...aiConfig.value, ...data };
    }
  } catch (error) {
    console.error('加载AI配置失败:', error);
  }
};

const saveAIConfig = async () => {
  try {
    await config.saveAI(aiConfig.value);
    ElMessage.success('AI配置保存成功');
  } catch (error) {
    console.error('保存AI配置失败:', error);
  }
};

const testAIConfig = async () => {
  try {
    const result = await config.testAI(aiConfig.value);
    if (result.success) {
      ElMessage.success('连接成功：' + result.response);
    } else {
      ElMessage.error('连接失败：' + result.message);
    }
  } catch (error) {
    console.error('测试AI连接失败:', error);
  }
};

const loadBots = async () => {
  try {
    bots.value = await config.listBots();
  } catch (error) {
    console.error('加载机器人配置失败:', error);
  }
};

const addBot = async () => {
  try {
    await config.createBot(newBot.value);
    ElMessage.success('机器人添加成功');
    showBotDialog.value = false;
    newBot.value = { bot_type: 'wechat_work', webhook_url: '' };
    loadBots();
  } catch (error) {
    console.error('添加机器人失败:', error);
  }
};

const updateBot = async (bot) => {
  try {
    await config.updateBot(bot.id, { enabled: bot.enabled });
    ElMessage.success('状态更新成功');
  } catch (error) {
    console.error('更新机器人失败:', error);
  }
};

const testBot = async (id) => {
  try {
    const result = await config.testBot(id);
    if (result.success) {
      ElMessage.success('测试消息发送成功');
    } else {
      ElMessage.error('发送失败：' + result.message);
    }
  } catch (error) {
    console.error('测试机器人失败:', error);
  }
};

const deleteBot = async (id) => {
  try {
    await config.deleteBot(id);
    ElMessage.success('机器人删除成功');
    loadBots();
  } catch (error) {
    console.error('删除机器人失败:', error);
  }
};

onMounted(() => {
  loadAIConfig();
  loadBots();
});
</script>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-panel {
  border-radius: 28px;
  padding: 22px;
  background:
    linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.16);
  box-shadow: 0 18px 40px rgba(3, 10, 20, 0.28);
}

.page-banner h3 {
  margin: 0;
  color: #f3fbff;
}

.settings-tabs {
  margin-top: 4px;
}

.settings-container :deep(.el-card) {
  background: rgba(8, 18, 31, 0.84);
  border-color: rgba(91, 151, 205, 0.08);
}

.settings-container :deep(.el-tabs__item) {
  color: rgba(198, 215, 231, 0.72);
}

.settings-container :deep(.el-tabs__item.is-active) {
  color: #47d1ff;
}
</style>
