<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

onMounted(() => {
  authStore.fetchCurrentUser();
});
</script>

<style>
:root {
  color-scheme: dark;
  --app-bg: #040b14;
  --panel-bg: rgba(9, 20, 34, 0.92);
  --panel-border: rgba(91, 151, 205, 0.16);
  --text-main: #eefaff;
  --text-muted: rgba(198, 215, 231, 0.72);
  --accent: #47d1ff;
  --success: #54f1b5;
  --warning: #ffb347;
  --danger: #ff6b6b;
}

html,
body,
#app {
  min-height: 100%;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  --el-bg-color: rgba(8, 18, 31, 0.96);
  --el-bg-color-page: #040b14;
  --el-bg-color-overlay: rgba(8, 18, 31, 0.98);
  --el-fill-color-blank: transparent;
  --el-fill-color-light: rgba(16, 31, 49, 0.92);
  --el-fill-color-lighter: rgba(13, 27, 43, 0.92);
  --el-fill-color-dark: rgba(5, 14, 25, 0.96);
  --el-border-color: rgba(91, 151, 205, 0.14);
  --el-border-color-light: rgba(91, 151, 205, 0.1);
  --el-border-color-lighter: rgba(91, 151, 205, 0.08);
  --el-text-color-primary: #eefaff;
  --el-text-color-regular: rgba(219, 236, 250, 0.78);
  --el-text-color-secondary: rgba(190, 214, 231, 0.68);
  --el-text-color-placeholder: rgba(156, 187, 213, 0.54);
  --el-mask-color: rgba(2, 8, 16, 0.72);
  font-family: 'Bahnschrift', 'DIN Alternate', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  background:
    radial-gradient(circle at top left, rgba(71, 209, 255, 0.12), transparent 22%),
    radial-gradient(circle at top right, rgba(84, 241, 181, 0.08), transparent 20%),
    linear-gradient(180deg, #06111d 0%, var(--app-bg) 100%);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

.el-card,
.el-dialog,
.el-drawer,
.el-popover,
.el-select-dropdown,
.el-picker-panel,
.el-message-box {
  background:
    linear-gradient(180deg, rgba(10, 22, 38, 0.98), rgba(6, 13, 24, 0.99)) !important;
  border-color: rgba(91, 151, 205, 0.12) !important;
  color: var(--text-main) !important;
  box-shadow: 0 24px 56px rgba(2, 8, 16, 0.42) !important;
}

.el-card__header,
.el-dialog__header,
.el-message-box__header {
  border-color: rgba(91, 151, 205, 0.08) !important;
}

.el-input__wrapper,
.el-select__wrapper,
.el-date-editor.el-input__wrapper,
.el-textarea__inner,
.el-input-number,
.el-upload-dragger {
  background: rgba(8, 18, 31, 0.92) !important;
  box-shadow: inset 0 0 0 1px rgba(91, 151, 205, 0.1) !important;
  border-color: rgba(91, 151, 205, 0.12) !important;
  color: var(--text-main) !important;
}

.el-input__wrapper.is-focus,
.el-select__wrapper.is-focused,
.el-textarea__inner:focus,
.el-date-editor.el-input__wrapper.is-focus {
  box-shadow:
    inset 0 0 0 1px rgba(71, 209, 255, 0.26),
    0 0 0 3px rgba(71, 209, 255, 0.08) !important;
}

.el-textarea__inner,
.el-input__inner,
.el-select__placeholder,
.el-radio__label,
.el-form-item__label,
.el-dialog__title,
.el-checkbox__label {
  color: var(--text-main) !important;
}

.el-form-item__label,
.el-upload__tip,
.el-radio__label,
.el-checkbox__label,
.el-tabs__item {
  color: rgba(198, 215, 231, 0.74) !important;
}

.el-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: rgba(8, 18, 31, 0.68);
  --el-table-header-bg-color: rgba(11, 21, 34, 0.88);
  --el-table-border-color: rgba(91, 151, 205, 0.08);
  --el-table-text-color: #e6f3ff;
  --el-table-header-text-color: rgba(198, 215, 231, 0.74);
}

.el-dialog {
  border-radius: 28px !important;
  overflow: hidden;
}

.el-dialog__body,
.el-card__body {
  color: var(--text-main);
}
</style>
