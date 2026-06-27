<template>
  <div class="user-management-container">
    <section class="page-panel page-banner">
      <div>
        <h3>用户管理</h3>
      </div>
      <el-button type="primary" @click="showCreateDialog = true">创建用户</el-button>
    </section>

    <section class="page-panel">
      <el-table :data="userList" style="width: 100%; margin-top: 8px">
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="display_name" label="显示名称" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : ''">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.created_at).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="editUser(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteUser(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="showCreateDialog" :title="editingUser ? '编辑用户' : '创建用户'" width="500px">
      <el-form :model="userForm" label-width="100px">
        <el-form-item label="用户名" required v-if="!editingUser">
          <el-input v-model="userForm.username" />
        </el-form-item>
        <el-form-item label="显示名称" required>
          <el-input v-model="userForm.display_name" />
        </el-form-item>
        <el-form-item label="密码" :required="!editingUser">
          <el-input v-model="userForm.password" type="password" :placeholder="editingUser ? '不修改请留空' : ''" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="userForm.role">
            <el-radio label="user">普通用户</el-radio>
            <el-radio label="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">{{ editingUser ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { users } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const userList = ref([]);
const showCreateDialog = ref(false);
const editingUser = ref(null);
const userForm = ref({
  username: '',
  display_name: '',
  password: '',
  role: 'user'
});

const loadUsers = async () => {
  try {
    userList.value = await users.list();
  } catch (error) {
    console.error('加载用户列表失败:', error);
  }
};

const editUser = (user) => {
  editingUser.value = user;
  userForm.value = {
    display_name: user.display_name,
    role: user.role,
    password: ''
  };
  showCreateDialog.value = true;
};

const handleSubmit = async () => {
  try {
    if (editingUser.value) {
      const data = { display_name: userForm.value.display_name, role: userForm.value.role };
      if (userForm.value.password) {
        data.password = userForm.value.password;
      }
      await users.update(editingUser.value.id, data);
      ElMessage.success('用户更新成功');
    } else {
      await users.create(userForm.value);
      ElMessage.success('用户创建成功');
    }
    showCreateDialog.value = false;
    editingUser.value = null;
    userForm.value = { username: '', display_name: '', password: '', role: 'user' };
    loadUsers();
  } catch (error) {
    console.error('操作失败:', error);
  }
};

const deleteUser = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该用户吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await users.delete(id);
    ElMessage.success('用户删除成功');
    loadUsers();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除用户失败:', error);
    }
  }
};

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.user-management-container {
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

.page-banner {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.page-banner h3 {
  margin: 0;
  color: #f3fbff;
}

.user-management-container :deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: rgba(8, 18, 31, 0.68);
  --el-table-header-bg-color: rgba(11, 21, 34, 0.88);
  --el-table-border-color: rgba(91, 151, 205, 0.08);
  --el-table-text-color: #e6f3ff;
  --el-table-header-text-color: rgba(198, 215, 231, 0.74);
  --el-fill-color-blank: transparent;
}
</style>
