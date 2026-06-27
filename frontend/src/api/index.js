import axios from 'axios';
import { ElMessage } from 'element-plus';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000
});

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error || error.message || '请求失败';
    const suppressedStatuses = error.config?.suppressErrorStatuses || [];

    if (!suppressedStatuses.includes(error.response?.status)) {
      ElMessage.error(message);
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// 认证
export const auth = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  getCurrentUser: () => api.get('/auth/me')
};

// 用户管理
export const users = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`)
};

// 船舶管理
export const ships = {
  list: () => api.get('/ships'),
  create: (name) => api.post('/ships', { name })
};

export const eventTypes = {
  list: (params) => api.get('/event-types', { params }),
  create: (name, scope = 'main') => api.post('/event-types', { name, scope }),
  delete: (id) => api.delete(`/event-types/${id}`)
};

// 事件管理
export const events = {
  list: (params) => api.get('/events', { params }),
  get: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.patch(`/events/${id}`, data),
  archive: (id) => api.post(`/events/${id}/archive`),
  delete: (id) => api.delete(`/events/${id}`)
};

// 事件记录
export const records = {
  list: (eventId) => api.get(`/records/${eventId}`),
  create: (eventId, formData) => api.post(`/records/${eventId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (recordId, data) => api.patch(`/records/${recordId}`, data),
  delete: (recordId) => api.delete(`/records/${recordId}`)
};

// 附件
export const attachments = {
  download: (id) => `/api/attachments/${id}`,
  delete: (id) => api.delete(`/attachments/${id}`)
};

// 知识库
export const knowledge = {
  search: (query, shipId, eventTypeId) => api.post('/knowledge/search', { query, shipId, eventTypeId }),
  graph: (params) => api.get('/knowledge/graph', { params }),
  get: (eventId, options = {}) => api.get(`/knowledge/${eventId}`, options),
  updateGraph: (eventId, graph_payload) => api.patch(`/knowledge/${eventId}/graph`, { graph_payload })
};

export const assistant = {
  listConversations: () => api.get('/assistant/conversations'),
  getConversation: (id) => api.get(`/assistant/conversations/${id}`),
  deleteConversation: (id) => api.delete(`/assistant/conversations/${id}`),
  streamChat: async ({ messages, shipId, eventTypeId, conversationId, onMeta, onDelta, signal }) => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/assistant/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ messages, shipId, eventTypeId, conversationId }),
      signal
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      let message = 'AI问答失败';

      try {
        const parsed = JSON.parse(errorText);
        message = parsed?.error || message;
      } catch {
        message = errorText || message;
      }

      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const line = chunk
          .split('\n')
          .map((item) => item.trim())
          .find((item) => item.startsWith('data:'));

        if (!line) {
          continue;
        }

        const raw = line.slice(5).trim();
        if (!raw) {
          continue;
        }

        const payload = JSON.parse(raw);

        if (payload.type === 'meta' && onMeta) {
          onMeta(payload.context);
        }

        if (payload.type === 'delta' && onDelta) {
          onDelta(payload.content || '');
        }

        if (payload.type === 'error') {
          throw new Error(payload.error || 'AI问答失败');
        }
      }
    }
  }
};

// 配置
export const config = {
  getAI: () => api.get('/config/ai'),
  saveAI: (data) => api.post('/config/ai', data),
  testAI: (data) => api.post('/config/ai/test', data),
  getAssistantSkill: () => api.get('/config/assistant-skill'),
  saveAssistantSkill: (prompt_text) => api.post('/config/assistant-skill', { prompt_text }),
  listBots: () => api.get('/config/bots'),
  createBot: (data) => api.post('/config/bots', data),
  updateBot: (id, data) => api.patch(`/config/bots/${id}`, data),
  deleteBot: (id) => api.delete(`/config/bots/${id}`),
  testBot: (id) => api.post(`/config/bots/${id}/test`)
};

export default api;
