import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import MainLayout from '@/components/MainLayout.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { requiresAuth: true, title: '运维看板' }
      },
      {
        path: 'events',
        name: 'EventCenter',
        component: () => import('@/views/EventCenter.vue'),
        meta: { requiresAuth: true, title: '事件中心' }
      },
      {
        path: 'events/:id',
        name: 'EventDetail',
        component: () => import('@/views/EventDetail.vue'),
        meta: { requiresAuth: true, title: '事件分支视图' }
      },
      {
        path: 'knowledge-map',
        name: 'KnowledgeGraph',
        component: () => import('@/views/KnowledgeGraph.vue'),
        meta: { requiresAuth: true, title: '知识图谱' }
      },
      {
        path: 'assistant',
        name: 'Assistant',
        component: () => import('@/views/Assistant.vue'),
        meta: { requiresAuth: true, title: 'AI问答' }
      },
      {
        path: 'archives',
        name: 'ArchiveSummary',
        component: () => import('@/views/ArchiveSummary.vue'),
        meta: { requiresAuth: true, title: '归档总结' }
      },
      {
        path: 'ships',
        name: 'ShipManagement',
        component: () => import('@/views/ShipManagement.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '船舶管理' }
      },
      {
        path: 'users',
        name: 'UserManagement',
        component: () => import('@/views/UserManagement.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '用户管理' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '系统设置' }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  if (authStore.token && !authStore.user) {
    await authStore.fetchCurrentUser();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/dashboard');
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
