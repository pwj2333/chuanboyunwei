<template>
  <div class="relation-canvas" :style="{ minHeight }">
    <div class="canvas-grid"></div>

    <svg
      v-if="nodes.length"
      class="canvas-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="relation-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(71, 209, 255, 0.12)" />
          <stop offset="50%" stop-color="rgba(71, 209, 255, 0.8)" />
          <stop offset="100%" stop-color="rgba(84, 241, 181, 0.18)" />
        </linearGradient>
        <marker
          id="relation-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="#47d1ff" />
        </marker>
      </defs>

      <g v-for="edge in resolvedEdges" :key="edge.id">
        <path
          :d="edge.path"
          class="edge-path"
          :class="{ dashed: edge.type === 'weak' }"
          marker-end="url(#relation-arrow)"
        />
        <text
          v-if="edge.label"
          class="edge-label"
          :x="edge.midX"
          :y="edge.midY"
          text-anchor="middle"
        >
          {{ edge.label }}
        </text>
      </g>
    </svg>

    <button
      v-for="node in nodes"
      :key="node.id"
      type="button"
      class="graph-node"
      :class="[node.type, { active: selectedId === node.id }]"
      :style="getNodeStyle(node)"
      @click="$emit('select', node)"
    >
      <span v-if="node.badge" class="node-badge">{{ node.badge }}</span>
      <strong class="node-title">{{ node.label }}</strong>
      <span v-if="node.meta" class="node-meta">{{ node.meta }}</span>
      <span v-if="node.tag" class="node-tag">{{ node.tag }}</span>
    </button>

    <div v-if="!nodes.length" class="empty-state">
      <h4>{{ emptyTitle }}</h4>
      <p v-if="emptyDescription">{{ emptyDescription }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  edges: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: [String, Number],
    default: null
  },
  minHeight: {
    type: String,
    default: '520px'
  },
  emptyTitle: {
    type: String,
    default: '暂无数据'
  },
  emptyDescription: {
    type: String,
    default: ''
  }
});

defineEmits(['select']);

const nodeMap = computed(() => {
  return props.nodes.reduce((accumulator, node) => {
    accumulator[node.id] = node;
    return accumulator;
  }, {});
});

const resolvedEdges = computed(() => {
  return props.edges
    .map((edge) => {
      const source = nodeMap.value[edge.source];
      const target = nodeMap.value[edge.target];

      if (!source || !target) return null;

      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const bend = Math.max(4, Math.abs(target.x - source.x) / 2);
      const path = `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${target.x - bend} ${target.y}, ${target.x} ${target.y}`;

      return {
        ...edge,
        path,
        midX,
        midY
      };
    })
    .filter(Boolean);
});

function getNodeStyle(node) {
  return {
    left: `${node.x}%`,
    top: `${node.y}%`,
    width: `${node.width || 180}px`,
    minHeight: `${node.height || 90}px`,
    '--accent': node.accentColor || '#47d1ff',
    '--status': node.statusColor || '#47d1ff'
  };
}
</script>

<style scoped>
.relation-canvas {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  background:
    radial-gradient(circle at top, rgba(71, 209, 255, 0.14), transparent 38%),
    linear-gradient(180deg, rgba(8, 18, 32, 0.96), rgba(5, 12, 24, 0.98));
  border: 1px solid rgba(98, 160, 220, 0.18);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.03),
    0 24px 60px rgba(1, 9, 20, 0.42);
}

.canvas-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(71, 209, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(71, 209, 255, 0.04) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.5));
}

.canvas-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.edge-path {
  fill: none;
  stroke: url(#relation-line-gradient);
  stroke-width: 0.42;
  opacity: 0.92;
}

.edge-path.dashed {
  stroke-dasharray: 1.5 1.2;
}

.edge-label {
  fill: rgba(218, 239, 255, 0.76);
  font-size: 2.1px;
  letter-spacing: 0.2px;
}

.graph-node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  border: 1px solid rgba(71, 209, 255, 0.22);
  border-radius: 20px;
  text-align: left;
  color: #ecf7ff;
  background:
    linear-gradient(135deg, rgba(18, 32, 56, 0.94), rgba(10, 18, 30, 0.96));
  box-shadow:
    0 18px 35px rgba(2, 10, 22, 0.45),
    inset 0 0 24px rgba(71, 209, 255, 0.08);
  cursor: pointer;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.graph-node:hover,
.graph-node.active {
  border-color: var(--accent);
  box-shadow:
    0 24px 45px rgba(2, 10, 22, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 0 28px rgba(71, 209, 255, 0.18);
  transform: translate(-50%, -52%);
}

.graph-node.root {
  background:
    linear-gradient(135deg, rgba(11, 47, 69, 0.98), rgba(8, 22, 38, 0.98));
}

.graph-node.ship {
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(13, 54, 76, 0.98), rgba(8, 22, 38, 0.98));
}

.graph-node.knowledge,
.graph-node.keyword {
  background:
    linear-gradient(135deg, rgba(20, 40, 69, 0.98), rgba(12, 22, 42, 0.98));
}

.node-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--status);
  background: rgba(71, 209, 255, 0.08);
}

.node-title {
  font-size: 15px;
  line-height: 1.5;
  font-weight: 700;
}

.node-meta {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(222, 236, 249, 0.72);
}

.node-tag {
  font-size: 12px;
  color: var(--accent);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 32px;
  text-align: center;
  color: rgba(226, 239, 255, 0.72);
}

.empty-state h4 {
  margin: 0 0 10px;
  font-size: 22px;
  color: #f3fbff;
}

.empty-state p {
  margin: 0;
  max-width: 420px;
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .graph-node {
    width: min(100%, 160px) !important;
  }
}
</style>
