
# i18n 集成指南

## 已完成的工作

1. ✅ 安装了 next-intl 包
2. ✅ 创建了翻译文件:
   - client/locales/en/common.json (英文)
   - client/locales/zh/common.json (中文)
3. ✅ 创建了 i18n.ts 配置文件
4. ✅ 更新了 next.config.ts
5. ✅ 创建了 app/[locale] 目录结构
6. ✅ 创建了语言切换组件: components/i18n/language-switcher.tsx
7. ✅ 创建了 middleware.ts

## 如何在组件中使用翻译

### 1. 导入 hook


### 2. 在组件中使用


### 3. 添加语言切换器


## 访问应用

- 英文版: http://localhost:3000/en
- 中文版: http://localhost:3000/zh

## 下一步

需要手动更新以下组件以使用翻译:
- components/settings/settings-panel.tsx (已提供示例)
- components/chat/chat-panel.tsx
- components/chat/chat-input.tsx
- components/sidebar/sidebar.tsx
- components/character/* (所有角色相关组件)

参考 components/settings/settings-panel-i18n-example.tsx 了解如何添加翻译。
