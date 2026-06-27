const axios = require('axios');
const { db } = require('../db/database');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAIConfig() {
  const config = await db.prepare('SELECT * FROM ai_config WHERE id = 1').get();
  if (!config) {
    throw new Error('AI配置未设置，请先在设置页面配置 AI 参数');
  }
  return config;
}

const DEFAULT_ASSISTANT_SKILL_PROMPT = `你是“船舶运维专家”技能，服务于船舶信息化运维系统。

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

async function getAssistantSkillPrompt() {
  const config = await db.prepare('SELECT prompt_text FROM assistant_skill_config WHERE id = 1').get();
  return String(config?.prompt_text || DEFAULT_ASSISTANT_SKILL_PROMPT).trim();
}

function buildAIRequestHeaders(config) {
  return {
    Authorization: `Bearer ${config.api_key}`,
    'Content-Type': 'application/json'
  };
}

function toUserFacingAIError(error, fallbackMessage = 'AI服务暂时不可用，请稍后重试') {
  const code = error.code || error.cause?.code;
  const status = error.response?.status;
  const providerMessage = error.response?.data?.error?.message || error.cause?.message || error.message;

  if (code === 'ECONNRESET') {
    return new Error('AI服务连接被中断，请检查模型服务地址或稍后重试');
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
    return new Error('AI服务响应超时，请稍后重试');
  }

  if (status === 401 || status === 403) {
    return new Error('AI服务鉴权失败，请检查API Key');
  }

  if (status === 404) {
    return new Error('AI服务接口不存在，请检查API Base URL');
  }

  if (status >= 500) {
    return new Error('AI服务暂时不可用，请稍后重试');
  }

  return new Error(providerMessage || fallbackMessage);
}

function canFallbackToNonStream(error) {
  const code = error.code || error.cause?.code;
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(code);
}

async function requestChatCompletion(config, payload, extraOptions = {}) {
  return axios.post(
    `${config.api_base_url}/chat/completions`,
    payload,
    {
      headers: buildAIRequestHeaders(config),
      ...extraOptions
    }
  );
}

async function testAIConnection(config) {
  try {
    const response = await requestChatCompletion(config, {
      model: config.model_name,
      messages: [{ role: 'user', content: '测试连接，请回复“连接成功”' }],
      max_tokens: 50
    }, {
      timeout: 30000
    });

    return {
      success: true,
      message: '连接成功',
      response: response.data.choices[0].message.content
    };
  } catch (error) {
    return {
      success: false,
      message: toUserFacingAIError(error, '测试失败').message
    };
  }
}

async function summarizeEvent(eventData) {
  const config = await getAIConfig();
  const prompt = buildPrompt(eventData);
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await requestChatCompletion(config, {
        model: config.model_name,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        response_format: { type: 'json_object' }
      }, {
        timeout: 60000
      });

      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      const message = toUserFacingAIError(error, 'AI总结生成失败').message;
      console.error(`AI调用失败(尝试 ${attempt}/${maxAttempts}):`, error.response?.data || error.message);

      if (attempt >= maxAttempts) {
        throw new Error('AI总结生成失败: ' + message);
      }

      await sleep(1500);
    }
  }
}

async function streamAssistantReply({ messages, context, shipId = null, eventTypeId = null, onEvent }) {
  const config = await getAIConfig();
  const skillPrompt = await getAssistantSkillPrompt();
  const requestMessages = buildAssistantMessages(messages, context, shipId, eventTypeId, skillPrompt);
  let receivedDelta = false;

  try {
    const response = await requestChatCompletion(config, {
      model: config.model_name,
      messages: requestMessages,
      temperature: Math.min(config.temperature, 0.5),
      max_tokens: config.max_tokens,
      stream: true
    }, {
      responseType: 'stream',
      timeout: 0
    });

    return await new Promise((resolve, reject) => {
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line || !line.startsWith('data:')) {
            continue;
          }

          const data = line.slice(5).trim();

          if (data === '[DONE]') {
            resolve();
            return;
          }

          try {
            const payload = JSON.parse(data);
            const delta = payload.choices?.[0]?.delta?.content;
            if (delta) {
              receivedDelta = true;
              onEvent({ type: 'delta', content: delta });
            }
          } catch (error) {
            // ponytail: tolerate provider-specific non-JSON keepalive chunks; upgrade by adding full SSE frame parser if needed
          }
        }
      });

      response.data.on('end', resolve);
      response.data.on('error', reject);
    });
  } catch (error) {
    if (!receivedDelta && canFallbackToNonStream(error)) {
      try {
        const fallbackResponse = await requestChatCompletion(config, {
          model: config.model_name,
          messages: requestMessages,
          temperature: Math.min(config.temperature, 0.5),
          max_tokens: config.max_tokens
        }, {
          timeout: 60000
        });
        const content = String(fallbackResponse.data?.choices?.[0]?.message?.content || '').trim();
        if (content) {
          onEvent({ type: 'delta', content });
          return;
        }
      } catch (fallbackError) {
        throw toUserFacingAIError(fallbackError, 'AI问答失败');
      }
    }

    throw toUserFacingAIError(error, 'AI问答失败');
  }
}

function buildPrompt(eventData) {
  const branchesText = eventData.branch_events?.length
    ? eventData.branch_events
      .map((event) => {
        const titlePrefix = event.depth === 0 ? '主事件' : `分支L${event.depth}`;
        return `${titlePrefix}：${event.title}｜状态=${event.status}｜优先级=${event.priority}｜描述=${event.description || '无'}`;
      })
      .join('\n')
    : `主事件：${eventData.title}｜状态=${eventData.status}｜优先级=${eventData.priority}｜描述=${eventData.description || '无'}`;

  const recordsText = eventData.records
    .map((record) => `[${record.created_at}] ${record.event_title || eventData.title} / ${record.operator || '未知操作人'}: ${record.content}`)
    .join('\n');

  const attachmentsText = eventData.attachments?.length
    ? `\n相关附件：${eventData.attachments.map((attachment) => attachment.filename).join(', ')}`
    : '';
  const branchTagsText = eventData.branch_events?.filter((event) => event.depth > 0).length
    ? eventData.branch_events
      .filter((event) => event.depth > 0)
      .map((event) => `分支标签：${event.event_type_name || event.title}｜分支标题=${event.title}｜描述=${event.description || '无'}`)
      .join('\n')
    : '暂无分支标签';

  return `你是一名船舶运维专家。请根据以下事件信息生成结构化总结。
请优先参考“跟进备注/记录”中的实际处理过程，提炼问题、处理动作、结果和经验。

事件主标题：${eventData.title}
船舶：${eventData.ship_name}
完整分支链：
${branchesText}

分支标签清单：
${branchTagsText}

跟进备注/记录：
${recordsText || '暂无备注记录'}${attachmentsText}

请以有效 JSON 输出：
{
  "summary": "事件摘要，100字内",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "problem_type": "问题分类",
  "solution": "解决方案，150字内",
  "lessons_learned": "主事件经验总结",
  "graph_payload": {
    "tag_groups": [
      {
        "tag_name": "分支事件标签名称",
        "experiences": [
          {
            "title": "经验1",
            "content": "根据备注整理出的经验内容"
          },
          {
            "title": "经验2",
            "content": "第二条经验"
          }
        ]
      }
    ]
  }
}`;
}

function buildAssistantMessages(messages, context, shipId, eventTypeId, skillPrompt) {
  const history = Array.isArray(messages)
    ? messages
      .filter((item) => item && ['user', 'assistant'].includes(item.role) && String(item.content || '').trim())
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: String(item.content).trim()
      }))
    : [];

  const contextText = buildAssistantContextText(context, shipId, eventTypeId);

  return [
    {
      role: 'system',
      content: skillPrompt
    },
    {
      role: 'system',
      content: contextText
    },
    ...history
  ];
}

function buildAssistantContextText(context, shipId, eventTypeId) {
  const similarEvents = context?.similarEvents || [];
  const matchingRecords = context?.matchingRecords || [];

  const eventText = similarEvents.length
    ? similarEvents.map((item, index) => {
      const graphText = item.graph_payload?.tag_groups?.length
        ? item.graph_payload.tag_groups
          .slice(0, 3)
          .map((group) => {
            const experiences = (group.experiences || [])
              .slice(0, 2)
              .map((experience) => `${experience.title || '经验'}:${experience.content || ''}`)
              .join('；');
            return `${group.tag_name}${experiences ? ` -> ${experiences}` : ''}`;
          })
          .join(' | ')
        : '无图谱经验';

      return [
        `案例${index + 1}: ${item.title}`,
        `船舶=${item.ship_name}`,
        `标签=${item.event_type_name || item.problem_type || '未分类'}`,
        `摘要=${item.summary || '无'}`,
        `方案=${item.solution || '无'}`,
        `经验=${item.lessons_learned || '无'}`,
        `图谱=${graphText}`
      ].join('｜');
    }).join('\n')
    : '未检索到匹配的历史归档案例';

  const recordText = matchingRecords.length
    ? matchingRecords.map((item, index) => {
      return `记录${index + 1}: ${item.event_title}｜船舶=${item.ship_name}｜标签=${item.event_type_name || '未分类'}｜操作人=${item.operator || '未知'}｜内容=${item.content}`;
    }).join('\n')
    : '未检索到匹配的历史备注';

  return `当前筛选：
shipId=${shipId || '不限'}
eventTypeId=${eventTypeId || '不限'}

历史归档案例：
${eventText}

历史备注记录：
${recordText}`;
}

module.exports = { getAIConfig, getAssistantSkillPrompt, testAIConnection, summarizeEvent, streamAssistantReply };
