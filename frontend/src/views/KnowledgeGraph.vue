<template>
  <div class="knowledge-map">
    <section class="map-panel toolbar">
      <div class="toolbar-left">
        <el-select v-model="shipFilter" placeholder="按船舶筛选" clearable @change="loadGraph">
          <el-option v-for="ship in shipList" :key="ship.id" :label="ship.name" :value="ship.id" />
        </el-select>
        <el-select v-model="eventTypeFilter" placeholder="按主事件标签筛选" clearable @change="loadGraph">
          <el-option v-for="item in mainEventTypes" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-select
          v-model="selectedEventId"
          placeholder="选择归档主事件"
          filterable
          :disabled="!filteredRoots.length"
        >
          <el-option
            v-for="item in filteredRoots"
            :key="item.event_id"
            :label="`${item.title} / ${item.ship_name}`"
            :value="item.event_id"
          />
        </el-select>
      </div>

      <div class="toolbar-right">
        <div class="stat-chip">归档主事件 {{ filteredRoots.length }}</div>
        <div class="stat-chip">分支标签 {{ branchTagCount }}</div>
        <div class="stat-chip">AI经验 {{ totalExperienceCount }}</div>
        <el-button class="ghost-button" @click="loadGraph">刷新</el-button>
      </div>
    </section>

    <article class="map-panel canvas-panel">
      <div class="panel-head">
        <div>
          <h4>主事件 / 分支事件标签 / AI经验</h4>
        </div>

        <div v-if="selectedItem" class="panel-actions">
          <el-button class="ghost-button" @click="openEvent(selectedItem.event_id)">打开事件</el-button>
          <el-button class="ghost-button" @click="openGraphPreview">放大查看</el-button>
          <el-button class="ghost-button" @click="downloadGraphHtml">导出 HTML</el-button>
        </div>
      </div>

      <div
        v-if="graphScene"
        class="mindmap-viewport"
        @dblclick="openGraphPreview"
      >
        <div
          class="mindmap-stage"
          :style="{ width: `${graphScene.stageWidth}px`, height: `${graphScene.stageHeight}px` }"
        >
          <svg
            class="mindmap-lines"
            :viewBox="`0 0 ${graphScene.stageWidth} ${graphScene.stageHeight}`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="root-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#46d7ff" />
                <stop offset="45%" stop-color="#4d8dff" />
                <stop offset="100%" stop-color="#8a7dff" />
              </linearGradient>
              <linearGradient id="branch-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="rgba(86, 190, 255, 0.92)" />
                <stop offset="100%" stop-color="rgba(155, 124, 255, 0.82)" />
              </linearGradient>
              <linearGradient id="experience-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="rgba(91, 239, 192, 0.82)" />
                <stop offset="100%" stop-color="rgba(97, 232, 255, 0.66)" />
              </linearGradient>
              <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path
              v-for="path in graphScene.paths"
              :key="path.id"
              :d="path.d"
              class="mindmap-path"
              :class="path.kind"
            />
          </svg>

          <button type="button" class="map-node root" :style="blockStyle(graphScene.root)" @click="openEvent(selectedItem.event_id)">
            <span class="node-caption">主事件</span>
            <strong>{{ graphScene.root.title }}</strong>
            <small>主事件标签 · {{ graphScene.root.rootTag }}</small>
            <small>{{ graphScene.root.meta }}</small>
          </button>

          <template v-for="group in graphScene.groups" :key="group.id">
            <div class="map-node tag" :style="blockStyle(group.tag)">
              <span class="node-caption">分支事件标签</span>
              <strong>{{ group.tag.title }}</strong>
              <small>{{ group.tag.meta }}</small>
              <small>{{ group.tag.extra }}</small>
            </div>

            <button
              v-for="experience in group.experiences"
              :key="experience.id"
              type="button"
              class="map-leaf"
              :style="blockStyle(experience)"
              @click="openExperienceEditor(group, experience)"
            >
              <span class="leaf-index">{{ experience.index }}</span>
              <p>{{ experience.text }}</p>
              <small>{{ experience.meta }}</small>
            </button>
          </template>

          <button type="button" class="preview-trigger" @click="openGraphPreview">
            放大查看
          </button>
        </div>
      </div>

      <el-empty v-else description="暂无数据" :image-size="88" />
    </article>

    <el-dialog v-model="previewDialogVisible" title="知识图谱大图" width="92%" top="4vh" destroy-on-close>
      <div class="preview-toolbar">
        <el-button class="ghost-button" @click="downloadGraphHtml">下载 HTML</el-button>
      </div>
      <div class="preview-frame">
        <iframe v-if="previewHtml" :srcdoc="previewHtml" title="知识图谱预览" />
      </div>
    </el-dialog>

    <el-dialog v-model="experienceDialogVisible" title="编辑 AI 经验" width="760px">
      <template v-if="editingExperience">
        <div class="dialog-grid">
          <div class="dialog-block">
            <div class="dialog-title">分支标签</div>
            <p>{{ editingExperience.groupName }}</p>
          </div>
          <div class="dialog-block">
            <div class="dialog-title">经验标题</div>
            <el-input v-model="editingExperience.title" maxlength="40" show-word-limit />
          </div>
          <div class="dialog-block dialog-block-full">
            <div class="dialog-title">经验内容</div>
            <el-input
              v-model="editingExperience.text"
              type="textarea"
              :rows="7"
              placeholder="输入内容"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <el-button @click="experienceDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingExperience" @click="saveExperienceEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { eventTypes, events, knowledge, records as recordsApi, ships } from '@/api';
import { formatDateTime } from '@/utils/ops';

const router = useRouter();

const shipList = ref([]);
const eventTypeList = ref([]);
const graphRows = ref([]);
const shipFilter = ref(null);
const eventTypeFilter = ref(null);
const selectedEventId = ref(null);
const eventTree = ref([]);
const branchRecords = ref({});
const selectedKnowledge = ref(null);

const previewDialogVisible = ref(false);
const previewHtml = ref('');
const experienceDialogVisible = ref(false);
const savingExperience = ref(false);
const editingExperience = ref(null);

const mainEventTypes = computed(() => eventTypeList.value.filter((item) => (item.scope || 'main') === 'main'));

const archivedRoots = computed(() => {
  return [...graphRows.value]
    .filter((row) => row.status === 'archived' && !row.parent_event_id)
    .sort((left, right) => {
      const leftTime = new Date(left.archived_at || left.updated_at || left.created_at).getTime();
      const rightTime = new Date(right.archived_at || right.updated_at || right.created_at).getTime();
      return rightTime - leftTime;
    });
});

const filteredRoots = computed(() => {
  return archivedRoots.value.filter((row) => {
    if (shipFilter.value && row.ship_id !== shipFilter.value) {
      return false;
    }

    if (eventTypeFilter.value && row.event_type_id !== eventTypeFilter.value) {
      return false;
    }

    return true;
  });
});

const selectedItem = computed(() => {
  return filteredRoots.value.find((item) => item.event_id === selectedEventId.value) || filteredRoots.value[0] || null;
});

const branchEvents = computed(() => eventTree.value.filter((event) => event.parent_event_id));

const fallbackBranchTagGroups = computed(() => {
  const groups = new Map();

  branchEvents.value.forEach((event) => {
    const tagName = event.event_type_name || event.title || '未分类分支标签';
    const tagKey = event.event_type_id ? `tag-${event.event_type_id}` : `name-${tagName}`;
    const existing = groups.get(tagKey) || {
      id: tagKey,
      tagName,
      branchCount: 0,
      branchTitles: [],
      experiences: []
    };

    existing.branchCount += 1;
    existing.branchTitles.push(event.title);

    collectBranchExperienceSources(event).forEach((source, index) => {
      existing.experiences.push({
        id: `${tagKey}-${event.id}-${index}`,
        title: `经验 ${String(index + 1).padStart(2, '0')}`,
        text: source.text,
        meta: source.meta
      });
    });

    groups.set(tagKey, existing);
  });

  return Array.from(groups.values())
    .map((group) => {
      const uniqueTexts = new Set();
      const experiences = group.experiences
        .filter((item) => {
          const key = `${item.text}-${item.meta}`;
          if (uniqueTexts.has(key)) {
            return false;
          }
          uniqueTexts.add(key);
          return true;
        })
        .slice(0, 6)
        .map((item, index) => ({
          ...item,
          index: `经验 ${String(index + 1).padStart(2, '0')}`
        }));

      return {
        ...group,
        branchTitles: Array.from(new Set(group.branchTitles)),
        experiences
      };
    })
    .filter((group) => group.experiences.length > 0)
    .sort((left, right) => right.branchCount - left.branchCount || left.tagName.localeCompare(right.tagName, 'zh-CN'));
});

const branchTagGroups = computed(() => {
  const payloadGroups = selectedKnowledge.value?.graph_payload?.tag_groups;
  if (!Array.isArray(payloadGroups) || !payloadGroups.length) {
    return fallbackBranchTagGroups.value;
  }

  return payloadGroups.map((group, groupIndex) => {
    const matchingBranches = branchEvents.value.filter((event) => (event.event_type_name || event.title) === group.tag_name);
    const branchTitles = Array.from(new Set(matchingBranches.map((event) => event.title))).slice(0, 3);

    return {
      id: `graph-${groupIndex}`,
      tagName: group.tag_name || `分支标签 ${groupIndex + 1}`,
      branchCount: matchingBranches.length || group.experiences?.length || 0,
      branchTitles,
      experiences: (group.experiences || []).map((item, experienceIndex) => ({
        id: `graph-${groupIndex}-${experienceIndex}`,
        sourceIndex: experienceIndex,
        groupIndex,
        title: item.title || `经验 ${String(experienceIndex + 1).padStart(2, '0')}`,
        index: item.title || `经验 ${String(experienceIndex + 1).padStart(2, '0')}`,
        text: item.content || item.text || '--',
        meta: branchTitles[0] ? `AI整理 · ${branchTitles[0]}` : 'AI整理'
      }))
    };
  });
});

const branchTagCount = computed(() => branchTagGroups.value.length);
const totalExperienceCount = computed(() => branchTagGroups.value.reduce((sum, group) => sum + group.experiences.length, 0));
const graphScene = computed(() => buildGraphScene(selectedItem.value, branchTagGroups.value));

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function splitTextSegments(text) {
  const clean = normalizeText(text);
  if (!clean) {
    return [];
  }

  const byLine = clean.split(/\n+/).map((part) => normalizeText(part)).filter(Boolean);
  const base = byLine.length > 1 ? byLine : clean.split(/[；;。！？]/).map((part) => normalizeText(part)).filter(Boolean);
  return base.length ? base : [clean];
}

function collectBranchExperienceSources(event) {
  const sources = [];
  const records = branchRecords.value[event.id] || [];

  records.forEach((record) => {
    splitTextSegments(record.content).forEach((text) => {
      sources.push({
        text,
        meta: `来自备注 · ${event.title}`
      });
    });
  });

  if (!sources.length && event.description) {
    splitTextSegments(event.description).forEach((text) => {
      sources.push({
        text,
        meta: `来自分支描述 · ${event.title}`
      });
    });
  }

  if (!sources.length) {
    sources.push({
      text: event.title,
      meta: `来自分支事件 · ${event.title}`
    });
  }

  return sources;
}

function blockStyle(block) {
  return {
    left: `${block.left}px`,
    top: `${block.top}px`,
    width: `${block.width}px`,
    minHeight: `${block.height}px`
  };
}

function distribute(start, total, size, gap) {
  return Array.from({ length: total }, (_, index) => start + index * (size + gap));
}

function estimateLeafHeight(experience) {
  const text = normalizeText(experience.text);
  const meta = normalizeText(experience.meta);
  const title = normalizeText(experience.title || experience.index);
  const textLines = Math.max(2, Math.ceil(text.length / 24));
  const metaLines = meta ? Math.max(1, Math.ceil(meta.length / 26)) : 0;
  const titleLines = title ? Math.max(1, Math.ceil(title.length / 20)) : 0;
  return Math.max(118, 30 + titleLines * 18 + textLines * 30 + metaLines * 22);
}

function buildCurve(startX, startY, endX, endY, bend = 140) {
  const distance = Math.max(bend, Math.abs(endX - startX) / 2);
  return `M ${startX} ${startY} C ${startX + distance} ${startY}, ${endX - distance} ${endY}, ${endX} ${endY}`;
}

function buildGraphScene(root, groups) {
  if (!root || !groups.length) {
    return null;
  }

  const groupLayouts = groups.map((group) => {
    const leafHeights = group.experiences.map((experience) => estimateLeafHeight(experience));
    const experienceHeight = leafHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, leafHeights.length - 1) * 22;
    return {
      ...group,
      leafHeights,
      blockHeight: Math.max(164, experienceHeight + 20)
    };
  });

  const totalHeight = groupLayouts.reduce((sum, group) => sum + group.blockHeight, 0);
  const groupGap = 56;
  const stageHeight = Math.max(760, totalHeight + Math.max(0, groupLayouts.length - 1) * groupGap + 180);
  const stageWidth = 1760;

  const rootBlock = {
    left: 90,
    top: stageHeight / 2 - 82,
    width: 280,
    height: 164,
    title: root.title,
    rootTag: root.event_type_name || '未分类标签',
    meta: `${root.ship_name} · ${formatDateTime(root.archived_at || root.updated_at || root.created_at)}`
  };

  let cursorTop = 88;
  const positionedGroups = groupLayouts.map((group) => {
    const tagTop = cursorTop + group.blockHeight / 2 - 66;
    const tagBlock = {
      left: 520,
      top: tagTop,
      width: 260,
      height: 132,
      title: group.tagName,
      meta: `分支事件 ${group.branchCount} 个`,
      extra: group.branchTitles.length ? group.branchTitles.join(' / ') : '--'
    };

    let leafCursorTop = cursorTop + 8;
    const leafPositions = group.experiences.map((experience, index) => {
      const height = group.leafHeights[index];
      const block = {
        ...experience,
        left: 970,
        top: leafCursorTop,
        width: 460,
        height
      };
      leafCursorTop += height + 22;
      return block;
    });

    cursorTop += group.blockHeight + groupGap;

    return {
      ...group,
      tag: tagBlock,
      experiences: leafPositions
    };
  });

  const rootMidY = rootBlock.top + rootBlock.height / 2;
  const paths = [
    {
      id: 'root-entry',
      kind: 'main',
      d: `M 20 ${rootMidY} L ${rootBlock.left} ${rootMidY}`
    },
    ...positionedGroups.map((group) => ({
      id: `root-${group.id}`,
      kind: 'main',
      d: buildCurve(
        rootBlock.left + rootBlock.width,
        rootMidY,
        group.tag.left,
        group.tag.top + group.tag.height / 2,
        170
      )
    })),
    ...positionedGroups.flatMap((group) => {
      const tagStartX = group.tag.left + group.tag.width;
      const tagMidY = group.tag.top + group.tag.height / 2;

      return group.experiences.map((experience) => ({
        id: `${group.id}-${experience.id}`,
        kind: 'experience',
        d: buildCurve(
          tagStartX,
          tagMidY,
          experience.left,
          experience.top + experience.height / 2,
          160
        )
      }));
    })
  ];

  return {
    stageWidth,
    stageHeight,
    root: rootBlock,
    groups: positionedGroups,
    paths
  };
}

function buildGraphPayloadForSave() {
  return {
    tag_groups: branchTagGroups.value.map((group) => ({
      tag_name: group.tagName,
      experiences: group.experiences.map((experience) => ({
        title: experience.title || experience.index,
        content: experience.text
      }))
    }))
  };
}

function buildGraphHtmlDocument() {
  if (!graphScene.value || !selectedItem.value) {
    return '';
  }

  const lines = graphScene.value.paths
    .map((path) => `<path d="${path.d}" class="mindmap-path ${path.kind}" />`)
    .join('');

  const groupsHtml = graphScene.value.groups
    .map((group) => {
      const tagHtml = `
        <div class="node tag" style="left:${group.tag.left}px;top:${group.tag.top}px;width:${group.tag.width}px;min-height:${group.tag.height}px">
          <span class="caption">分支事件标签</span>
          <strong>${escapeHtml(group.tag.title)}</strong>
          <small>${escapeHtml(group.tag.meta)}</small>
          <small>${escapeHtml(group.tag.extra || '')}</small>
        </div>
      `;

      const leafHtml = group.experiences
        .map((experience) => `
          <div class="node leaf" style="left:${experience.left}px;top:${experience.top}px;width:${experience.width}px;min-height:${experience.height}px">
            <span class="caption">${escapeHtml(experience.index)}</span>
            <strong>${escapeHtml(experience.title || experience.index)}</strong>
            <p>${escapeHtml(experience.text)}</p>
            <small>${escapeHtml(experience.meta || '')}</small>
          </div>
        `)
        .join('');

      return `${tagHtml}${leafHtml}`;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(selectedItem.value.title)} - 知识图谱</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      background:
        radial-gradient(circle at 16% 18%, rgba(57, 201, 255, 0.14), transparent 24%),
        radial-gradient(circle at 86% 78%, rgba(138, 125, 255, 0.18), transparent 28%),
        linear-gradient(180deg, #07121f 0%, #040913 100%);
      color: #effaff;
    }
    .page {
      padding: 24px;
    }
    .hero {
      margin-bottom: 18px;
      padding: 18px 22px;
      border-radius: 24px;
      background: rgba(8, 18, 31, 0.88);
      border: 1px solid rgba(91, 151, 205, 0.16);
    }
    .hero h1 { margin: 0 0 8px; font-size: 28px; }
    .hero p { margin: 0; color: rgba(198, 215, 231, 0.76); }
    .stage {
      position: relative;
      width: ${graphScene.value.stageWidth}px;
      height: ${graphScene.value.stageHeight}px;
      overflow: hidden;
      border-radius: 28px;
      background:
        linear-gradient(rgba(71, 209, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(71, 209, 255, 0.03) 1px, transparent 1px),
        linear-gradient(180deg, rgba(7, 18, 33, 0.98), rgba(5, 12, 23, 0.99));
      background-size: 44px 44px, 44px 44px, auto;
      border: 1px solid rgba(91, 151, 205, 0.12);
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .mindmap-path {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 8px rgba(97, 232, 255, 0.22));
    }
    .mindmap-path.main { stroke: url(#root-line); stroke-width: 4; }
    .mindmap-path.experience { stroke: url(#experience-line); stroke-width: 3; }
    .node {
      position: absolute;
      padding: 18px 20px;
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(13, 28, 48, 0.94), rgba(8, 17, 29, 0.96));
      border: 1px solid rgba(91, 151, 205, 0.12);
      box-shadow: 0 18px 36px rgba(2, 10, 20, 0.28);
      box-sizing: border-box;
    }
    .node.root { background: linear-gradient(180deg, rgba(11, 36, 60, 0.96), rgba(8, 18, 32, 0.98)); }
    .caption {
      display: inline-block;
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(190, 214, 231, 0.68);
    }
    .node strong {
      display: block;
      margin: 8px 0 8px;
      color: #f3fbff;
      line-height: 1.35;
    }
    .node p,
    .node small {
      display: block;
      margin: 0;
      color: rgba(198, 215, 231, 0.76);
      line-height: 1.65;
    }
    .node.leaf p { margin-top: 8px; }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(selectedItem.value.title)}</h1>
      <p>${escapeHtml(selectedItem.value.ship_name)} · ${escapeHtml(selectedItem.value.event_type_name || '未分类标签')}</p>
    </section>
    <div class="stage">
      <svg viewBox="0 0 ${graphScene.value.stageWidth} ${graphScene.value.stageHeight}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="root-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#46d7ff" />
            <stop offset="45%" stop-color="#4d8dff" />
            <stop offset="100%" stop-color="#8a7dff" />
          </linearGradient>
          <linearGradient id="experience-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(91, 239, 192, 0.82)" />
            <stop offset="100%" stop-color="rgba(97, 232, 255, 0.66)" />
          </linearGradient>
        </defs>
        ${lines}
      </svg>
      <div class="node root" style="left:${graphScene.value.root.left}px;top:${graphScene.value.root.top}px;width:${graphScene.value.root.width}px;min-height:${graphScene.value.root.height}px">
        <span class="caption">主事件</span>
        <strong>${escapeHtml(graphScene.value.root.title)}</strong>
        <small>${escapeHtml(`主事件标签 · ${graphScene.value.root.rootTag}`)}</small>
        <small>${escapeHtml(graphScene.value.root.meta)}</small>
      </div>
      ${groupsHtml}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openGraphPreview() {
  previewHtml.value = buildGraphHtmlDocument();
  previewDialogVisible.value = true;
}

function downloadGraphHtml() {
  const html = buildGraphHtmlDocument();
  if (!html || !selectedItem.value) {
    ElMessage.warning('当前没有可导出的图谱');
    return;
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${selectedItem.value.title.replace(/[\\\\/:*?"<>|]/g, '_')}-知识图谱.html`;
  link.click();
  URL.revokeObjectURL(url);
}

function openExperienceEditor(group, experience) {
  editingExperience.value = {
    groupIndex: experience.groupIndex,
    sourceIndex: experience.sourceIndex,
    groupName: group.tagName,
    title: experience.title || experience.index,
    text: experience.text
  };
  experienceDialogVisible.value = true;
}

async function saveExperienceEdit() {
  if (!editingExperience.value || !selectedItem.value || !selectedKnowledge.value) {
    return;
  }

  const title = editingExperience.value.title.trim();
  const text = editingExperience.value.text.trim();

  if (!title || !text) {
    ElMessage.warning('经验标题和经验内容都不能为空');
    return;
  }

  const payload = selectedKnowledge.value.graph_payload?.tag_groups
    ? JSON.parse(JSON.stringify(selectedKnowledge.value.graph_payload))
    : buildGraphPayloadForSave();

  const group = payload.tag_groups?.[editingExperience.value.groupIndex];
  const experience = group?.experiences?.[editingExperience.value.sourceIndex];

  if (!group || !experience) {
    ElMessage.warning('当前经验节点无法定位，请刷新后重试');
    return;
  }

  experience.title = title;
  experience.content = text;

  try {
    savingExperience.value = true;
    const updated = await knowledge.updateGraph(selectedItem.value.event_id, payload);
    selectedKnowledge.value = updated;
    ElMessage.success('AI 经验已更新');
    experienceDialogVisible.value = false;
  } finally {
    savingExperience.value = false;
  }
}

async function loadGraph() {
  const params = {};
  if (shipFilter.value) {
    params.shipId = shipFilter.value;
  }
  if (eventTypeFilter.value) {
    params.eventTypeId = eventTypeFilter.value;
  }

  const [shipsData, eventTypesData, graphData] = await Promise.all([
    ships.list(),
    eventTypes.list(),
    knowledge.graph(Object.keys(params).length ? params : undefined)
  ]);

  shipList.value = shipsData;
  eventTypeList.value = eventTypesData;
  graphRows.value = graphData;
}

async function loadSelectedTree() {
  if (!selectedItem.value) {
    eventTree.value = [];
    branchRecords.value = {};
    selectedKnowledge.value = null;
    return;
  }

  const tree = await events.get(selectedItem.value.event_id);
  eventTree.value = tree;

  const branchList = tree.filter((event) => event.parent_event_id);
  const recordResults = await Promise.all(
    branchList.map(async (event) => {
      try {
        const records = await recordsApi.list(event.id);
        return [event.id, records];
      } catch (error) {
        return [event.id, []];
      }
    })
  );

  branchRecords.value = Object.fromEntries(recordResults);

  try {
    selectedKnowledge.value = await knowledge.get(selectedItem.value.event_id, {
      suppressErrorStatuses: [404]
    });
  } catch (error) {
    selectedKnowledge.value = null;
  }
}

function openEvent(id) {
  router.push(`/events/${id}`);
}

watch(
  filteredRoots,
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

watch(
  () => selectedItem.value?.event_id,
  async () => {
    await loadSelectedTree();
  },
  { immediate: true }
);

onMounted(() => {
  loadGraph();
});
</script>

<style scoped>
.knowledge-map {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.map-panel {
  border-radius: 28px;
  padding: 22px;
  background: linear-gradient(180deg, rgba(9, 21, 36, 0.96), rgba(6, 13, 24, 0.98));
  border: 1px solid rgba(91, 151, 205, 0.16);
  box-shadow: 0 18px 40px rgba(3, 10, 20, 0.28);
}

.toolbar,
.toolbar-left,
.toolbar-right,
.panel-head,
.panel-actions,
.archive-top,
.archive-meta,
.dialog-grid,
.tag-group-head,
.action-list,
.preview-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.toolbar,
.panel-head,
.archive-top,
.archive-meta,
.preview-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right,
.panel-actions,
.action-list {
  flex-wrap: wrap;
}

.stat-chip {
  padding: 10px 14px;
  border-radius: 999px;
  color: #d9f4ff;
  background: rgba(11, 21, 34, 0.86);
  border: 1px solid rgba(71, 209, 255, 0.12);
}

.panel-head h4 {
  margin: 0;
  color: #f3fbff;
}

.ghost-button {
  border-radius: 14px;
  border-color: rgba(71, 209, 255, 0.16);
  background: rgba(13, 31, 47, 0.82);
  color: #d9f4ff;
}

.mindmap-viewport {
  overflow: auto;
  padding-bottom: 4px;
}

.mindmap-stage {
  position: relative;
  overflow: hidden;
  border-radius: 30px;
  background:
    radial-gradient(circle at 14% 18%, rgba(57, 201, 255, 0.12), transparent 25%),
    radial-gradient(circle at 82% 78%, rgba(138, 125, 255, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(7, 18, 33, 0.98), rgba(5, 12, 23, 0.99));
  border: 1px solid rgba(91, 151, 205, 0.12);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.02),
    0 22px 50px rgba(2, 10, 20, 0.35);
}

.mindmap-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(71, 209, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(71, 209, 255, 0.03) 1px, transparent 1px);
  background-size: 44px 44px;
  opacity: 0.28;
}

.mindmap-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.mindmap-path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: url(#line-glow);
}

.mindmap-path.main {
  stroke: url(#root-line);
  stroke-width: 4;
}

.mindmap-path.experience {
  stroke: url(#experience-line);
  stroke-width: 3;
}

.map-node,
.map-leaf {
  position: absolute;
  text-align: left;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(13, 28, 48, 0.94), rgba(8, 17, 29, 0.96));
  border: 1px solid rgba(91, 151, 205, 0.12);
  box-shadow:
    0 18px 36px rgba(2, 10, 20, 0.28),
    inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(10px);
}

.map-node {
  padding: 18px 20px;
}

.map-node.root {
  cursor: pointer;
  background: linear-gradient(180deg, rgba(9, 35, 56, 0.96), rgba(7, 18, 32, 0.98));
}

.map-leaf {
  padding: 16px 18px;
  cursor: pointer;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.map-leaf:hover,
.map-node.root:hover {
  transform: translateY(-2px);
  border-color: rgba(132, 131, 255, 0.22);
  box-shadow:
    0 22px 42px rgba(2, 10, 20, 0.34),
    0 0 24px rgba(132, 131, 255, 0.14);
}

.map-node.root::before,
.map-node.tag::before,
.map-leaf::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 18px;
  width: 3px;
  border-radius: 999px;
}

.map-node.root::before {
  background: linear-gradient(180deg, #39c9ff, #4d8cff);
}

.map-node.tag::before {
  background: linear-gradient(180deg, #5aaeff, #7f92ff);
}

.map-leaf::before {
  background: linear-gradient(180deg, #54f1b5, #61e8ff);
}

.node-caption,
.leaf-index,
.dialog-title,
.card-title {
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.node-caption,
.leaf-index,
.dialog-block p {
  color: rgba(190, 214, 231, 0.68);
}

.map-node strong,
.map-leaf p {
  color: #f3fbff;
}

.map-node strong {
  display: block;
  margin: 8px 0 6px;
  font-size: 24px;
  line-height: 1.28;
}

.map-node.tag strong {
  font-size: 20px;
}

.map-node small,
.map-leaf small {
  display: block;
  line-height: 1.55;
  color: rgba(179, 205, 230, 0.72);
}

.map-leaf p {
  margin: 10px 0 8px;
  line-height: 1.72;
}

.preview-trigger {
  position: absolute;
  right: 24px;
  bottom: 24px;
  padding: 10px 14px;
  border: 1px solid rgba(71, 209, 255, 0.14);
  border-radius: 14px;
  background: rgba(8, 18, 31, 0.82);
  color: #d9f4ff;
  cursor: pointer;
  z-index: 3;
}

.dialog-block {
  padding: 16px;
  border-radius: 20px;
  background: rgba(8, 18, 31, 0.84);
  border: 1px solid rgba(91, 151, 205, 0.08);
}

.dialog-block p {
  margin: 0;
  line-height: 1.7;
  color: rgba(190, 214, 231, 0.76);
}

.card-title,
.dialog-title {
  margin-bottom: 10px;
  color: #61e8ff;
}

.action-list {
  justify-content: flex-start;
}

.preview-frame {
  height: 78vh;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(91, 151, 205, 0.12);
  background: rgba(5, 12, 23, 0.98);
}

.preview-frame iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.dialog-block-full {
  grid-column: 1 / -1;
}

@media (max-width: 960px) {
  .toolbar,
  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .dialog-grid {
    display: grid;
  }
}
</style>
