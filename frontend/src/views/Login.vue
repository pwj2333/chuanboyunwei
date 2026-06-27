<template>
  <div class="login-container">
    <el-card class="login-card">
      <div class="card-header">
        <h1>船舶信息化运维系统</h1>
      </div>

      <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            :prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="handleLogin">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  username: '',
  password: ''
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

const formRef = ref(null);
const loading = ref(false);

const handleLogin = async () => {
  try {
    await formRef.value.validate();
    loading.value = true;

    await authStore.login(form.value.username, form.value.password);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (error) {
    console.error('登录失败:', error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at 20% 18%, rgba(71, 209, 255, 0.18), transparent 22%),
    radial-gradient(circle at 82% 84%, rgba(84, 241, 181, 0.1), transparent 24%),
    linear-gradient(180deg, #07131f 0%, #030913 100%);
}

.login-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(97, 232, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(97, 232, 255, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.8), transparent 100%);
  pointer-events: none;
}

.login-card {
  position: relative;
  overflow: hidden;
  z-index: 2;
  align-self: center;
  width: 100%;
  max-width: 460px;
  padding: 18px;
  border-radius: 30px;
  border: 1px solid rgba(91, 151, 205, 0.16);
  background: linear-gradient(180deg, rgba(9, 21, 36, 0.95), rgba(6, 13, 24, 0.98));
  backdrop-filter: blur(18px);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.02),
    0 28px 64px rgba(3, 10, 20, 0.42),
    0 0 0 1px rgba(71, 209, 255, 0.06);
}

.login-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(97, 232, 255, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 24%);
  pointer-events: none;
}

.card-header {
  margin-bottom: 24px;
  text-align: center;
}

.card-header h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.25;
  letter-spacing: 1px;
  color: #f3fbff;
}

.login-card :deep(.el-form-item) {
  margin-bottom: 22px;
}

.login-card :deep(.el-card__body) {
  position: relative;
  z-index: 1;
  padding: 30px;
}

.login-card :deep(.el-input__wrapper) {
  min-height: 50px;
  border-radius: 16px;
  background: rgba(8, 18, 31, 0.86);
  box-shadow: 0 0 0 1px rgba(91, 151, 205, 0.08) inset;
}

.login-card :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px rgba(97, 232, 255, 0.36) inset,
    0 0 0 5px rgba(97, 232, 255, 0.08);
}

.login-card :deep(.el-button--primary) {
  height: 52px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #4bd8ff 0%, #59f0bc 100%);
  color: #05111d;
  box-shadow: 0 18px 30px rgba(75, 216, 255, 0.24);
}

.login-card :deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 20px 34px rgba(75, 216, 255, 0.28);
}

@media (max-width: 1100px) {
  .login-container {
    padding: 20px;
  }

  .login-card {
    max-width: none;
  }
}
</style>
