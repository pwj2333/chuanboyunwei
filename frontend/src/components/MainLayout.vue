<template>
  <el-container class="shell">
    <el-aside class="shell-aside" width="260px">
      <div class="brand-block">
        <div class="brand-mark">OPS</div>
        <div>
          <h1>船舶运维看板</h1>
        </div>
      </div>

      <div class="aside-status">
        <span class="status-dot"></span>
        <span>系统在线</span>
      </div>

      <el-menu
        class="shell-menu"
        :default-active="activeMenu"
        background-color="transparent"
        text-color="#c6d7e7"
        active-text-color="#47d1ff"
        router
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <div class="menu-copy">
            <span>{{ item.label }}</span>
          </div>
        </el-menu-item>
      </el-menu>

      <div class="user-panel">
        <div class="user-meta">
          <strong>{{ authStore.user?.display_name || '未登录用户' }}</strong>
          <span>{{ authStore.isAdmin ? '系统管理员' : '运维成员' }}</span>
        </div>
        <el-button class="logout-button" @click="handleLogout">退出登录</el-button>
      </div>
    </el-aside>

    <el-container class="shell-main-wrap">
      <el-header class="shell-header">
        <div>
          <h2>{{ currentTitle }}</h2>
        </div>

        <div class="header-side">
          <div class="header-chip">
            <span class="chip-label">当前时间</span>
            <strong>{{ nowText }}</strong>
          </div>
          <div class="header-chip">
            <span class="chip-label">值守状态</span>
            <strong>全链路监控中</strong>
          </div>
        </div>
      </el-header>

      <el-main class="shell-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  DataAnalysis,
  ChatDotRound,
  Document,
  Management,
  OfficeBuilding,
  Setting,
  Share,
  UserFilled
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const nowText = ref('');
let timer = null;

const menuItems = computed(() => {
  const items = [
    {
      path: '/dashboard',
      label: '运维看板',
      icon: DataAnalysis
    },
    {
      path: '/events',
      label: '事件中心',
      icon: Management
    },
    {
      path: '/archives',
      label: '归档总结',
      icon: Document
    },
    {
      path: '/knowledge-map',
      label: '知识图谱',
      icon: Share
    },
    {
      path: '/assistant',
      label: 'AI问答',
      icon: ChatDotRound
    }
  ];

  if (authStore.isAdmin) {
    items.push(
      {
        path: '/ships',
        label: '船舶管理',
        icon: OfficeBuilding
      },
      {
        path: '/users',
        label: '用户管理',
        icon: UserFilled
      },
      {
        path: '/settings',
        label: '系统设置',
        icon: Setting
      }
    );
  }

  return items;
});

const activeMenu = computed(() => {
  if (route.path.startsWith('/events/')) return '/events';
  if (route.path.startsWith('/archives')) return '/archives';
  if (route.path.startsWith('/knowledge-map')) return '/knowledge-map';
  if (route.path.startsWith('/assistant')) return '/assistant';
  if (route.path.startsWith('/ships')) return '/ships';
  if (route.path.startsWith('/users')) return '/users';
  if (route.path.startsWith('/settings')) return '/settings';
  return '/dashboard';
});

const currentPage = computed(() => menuItems.value.find((item) => item.path === activeMenu.value));
const currentTitle = computed(() => route.meta.title || currentPage.value?.label || '船舶运维看板');

function refreshTime() {
  nowText.value = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

onMounted(() => {
  refreshTime();
  timer = window.setInterval(refreshTime, 1000);
});

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});
</script>

<style scoped>
.shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(71, 209, 255, 0.16), transparent 24%),
    linear-gradient(180deg, #07131f 0%, #040b14 100%);
}

.shell-aside {
  display: flex;
  flex-direction: column;
  padding: 28px 18px 20px;
  background: linear-gradient(180deg, rgba(8, 18, 33, 0.98), rgba(5, 11, 21, 0.98));
  border-right: 1px solid rgba(91, 151, 205, 0.18);
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.03);
}

.brand-block {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 8px 10px 20px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #04111d;
  background: linear-gradient(135deg, #61e8ff 0%, #59f0bc 100%);
  box-shadow: 0 18px 32px rgba(71, 209, 255, 0.28);
  animation: brandFloat 4.8s ease-in-out infinite;
}

.brand-block h1 {
  margin: 0;
  font-size: 22px;
  color: #f3fbff;
}

.aside-status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  align-self: flex-start;
  margin: 0 10px 18px;
  padding: 10px 14px;
  border-radius: 999px;
  color: #9ddcf4;
  background: rgba(12, 30, 48, 0.88);
  border: 1px solid rgba(71, 209, 255, 0.16);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #54f1b5;
  box-shadow: 0 0 0 5px rgba(84, 241, 181, 0.14);
  animation: statusPulse 1.8s ease-in-out infinite;
}

.shell-menu {
  flex: 1;
  border-right: none;
}

:deep(.shell-menu .el-menu-item) {
  height: auto;
  margin-bottom: 10px;
  border-radius: 18px;
  line-height: 1.4;
  padding: 16px 14px !important;
  transition: background 0.22s ease, border-color 0.22s ease;
  border: 1px solid transparent;
}

:deep(.shell-menu .el-menu-item:hover) {
  background: rgba(16, 38, 57, 0.9) !important;
  border-color: rgba(71, 209, 255, 0.16);
}

:deep(.shell-menu .el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(14, 48, 68, 0.98), rgba(11, 29, 47, 0.98)) !important;
  border-color: rgba(71, 209, 255, 0.24);
  box-shadow: 0 14px 30px rgba(3, 11, 24, 0.34);
}

.menu-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 12px;
}

.menu-copy span {
  font-size: 15px;
  font-weight: 600;
}

.user-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(11, 25, 41, 0.96);
  border: 1px solid rgba(91, 151, 205, 0.16);
}

.user-meta strong {
  display: block;
  color: #f3fbff;
}

.user-meta span {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(198, 215, 231, 0.66);
}

.logout-button {
  width: 100%;
  border-radius: 14px;
  border-color: rgba(71, 209, 255, 0.16);
  background: rgba(15, 35, 53, 0.82);
  color: #d8ecff;
}

.shell-main-wrap {
  min-width: 0;
}

.shell-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  height: auto;
  padding: 28px 32px 0;
  background: transparent;
}

.shell-header h2 {
  margin: 0;
  font-size: 30px;
  line-height: 1.1;
  color: #f4fbff;
}

.header-side {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.header-chip {
  min-width: 180px;
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid rgba(91, 151, 205, 0.16);
  background: rgba(11, 23, 39, 0.86);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  position: relative;
  overflow: hidden;
}

.header-chip::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 0%, rgba(97, 232, 255, 0.12) 45%, transparent 100%);
  transform: translateX(-120%);
  animation: chipScan 6.5s linear infinite;
}

.chip-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(189, 213, 231, 0.66);
}

.header-chip strong {
  color: #effaff;
}

.shell-main {
  padding: 24px 32px 32px;
}

@keyframes statusPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 5px rgba(84, 241, 181, 0.14);
  }

  50% {
    transform: scale(1.18);
    box-shadow: 0 0 0 10px rgba(84, 241, 181, 0.08);
  }
}

@keyframes brandFloat {
  0%, 100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }
}

@keyframes chipScan {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(140%);
  }
}

@media (max-width: 1200px) {
  .shell {
    flex-direction: column;
  }

  .shell-aside {
    width: 100% !important;
  }

  .shell-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-side {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
