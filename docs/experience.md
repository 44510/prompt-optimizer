# 项目核心经验指南

本指南收录项目开发中的关键经验与最佳实践，快速解决常见问题，提升开发效率。

---

## 🎯 核心布局经验：动态 Flex 布局

**这是本项目最重要的经验。** 摒弃固定尺寸，全面使用 Flexbox 动态空间分配。

### 核心原则
- **最高指导原则**：一个元素若要作为 Flex 子项（`flex-1`）进行伸缩，其直接父元素必须是 Flex 容器（`display: flex`）
- **约束链完整性**：从顶层到底层的所有相关父子元素都必须遵循 Flex 规则
- **黄金组合**：`flex: 1` + `min-h-0`（或 `min-w-0`）

### 实施要点
```css
/* 父容器 */
.parent {
  display: flex;
  flex-direction: column;
  height: 100vh; /* 或其他明确高度 */
}

/* 动态子项 */
.child {
  flex: 1;
  min-height: 0; /* 关键：允许收缩 */
}

/* 滚动容器 */
.scrollable {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

### 调试方法
当 Flex 布局失效时，从出问题的元素开始，逐层向上检查父元素是否为 `display: flex`。

---

## 🔧 开发规范

### API 集成
```typescript
// 统一 OpenAI 兼容格式
const config = {
  baseURL: "https://api.provider.com/v1",
  models: ["model-name"],
  apiKey: import.meta.env.VITE_API_KEY // 必须使用 Vite 环境变量
};
```

**核心原则**：
- 业务逻辑与API配置分离
- 只传递用户明确配置的参数，不设默认值
- 敏感信息通过环境变量管理

### 错误处理
```typescript
try {
  await apiCall();
} catch (error) {
  console.error('[Service Error]', error); // 开发日志
  throw new Error('操作失败，请稍后重试'); // 用户友好提示
}
```

### 测试规范
```javascript
describe("功能测试", () => {
  beforeEach(() => {
    testId = `test-${Date.now()}`; // 唯一标识避免冲突
  });
  
  // LLM参数测试：每个参数独立测试
  it("should handle temperature parameter", async () => {
    await modelManager.updateModel(configKey, {
      llmParams: { temperature: 0.7 } // 只测试一个参数
    });
  });
});
```

**要点**：
- 使用动态唯一标识符
- 每个LLM参数创建独立测试
- 覆盖异常场景
- 正确清理测试状态

---

## 🚨 关键Bug修复经验

### 1. 参数透明化（2024-12-20）
**问题**：LLM参数默认值误导用户
```typescript
// ❌ 错误：自动设置默认值
if (!config.temperature) config.temperature = 0.7;

// ✅ 正确：只使用用户配置的参数
const requestConfig = {
  model: modelConfig.defaultModel,
  messages: formattedMessages,
  ...userLlmParams // 只传递用户明确配置的参数
};
```

### 2. 数据导入安全验证
```typescript
// 白名单验证 + 类型检查
for (const [key, value] of Object.entries(importData)) {
  if (!ALLOWED_KEYS.includes(key)) {
    console.warn(`跳过未知配置: ${key}`);
    continue;
  }
  if (typeof value !== 'string') {
    console.warn(`跳过无效类型 ${key}: ${typeof value}`);
    continue;
  }
  await storage.setItem(key, value);
}
```

### 3. Flex 约束链断裂修复
**典型错误**：
```html
<!-- ❌ 父容器不是 flex，子元素 flex-1 失效 -->
<div class="h-full relative">
  <TextDiff class="flex-1 min-h-0" />
</div>

<!-- ✅ 正确：父容器必须是 flex -->
<div class="h-full flex flex-col">
  <TextDiff class="flex-1 min-h-0" />
</div>
```

### 4. UI状态同步与响应式数据流最佳实践（2024-12-21）

**典型问题**：在复杂的Vue组件交互中，子组件内部状态的变更未能正确反映到其他兄弟组件，导致UI显示与底层数据不一致。例如，用户在A组件中编辑内容后，B组件（如测试面板）获取到的仍然是编辑前的数据。

**根因分析**：该问题的核心在于 **单向数据流** 与 **组件本地状态** 之间的同步间隙。当一个子组件（如`OutputDisplay`）的内部状态（`editingContent`）发生变化时，它通过`emit`事件通知父组件更新顶层状态。然而，依赖同一顶层状态的其他兄弟组件（如`TestPanel`）接收到的`props`是静态的，不会自动响应由`emit`触发的间接状态变更，从而导致数据不同步。

```mermaid
graph TD
    subgraph App.vue (顶层状态)
        A[state: optimizedPrompt]
    end

    subgraph "子/兄弟组件"
        B(OutputDisplay)
        C(TestPanel)
    end

    A -- "Props (v-model)" --> B
    A -- "Props (静态传递)" --> C

    B -- "1. 用户编辑触发内部状态变更" --> B_InternalState(Local state: editingContent)
    B_InternalState -- "2. emit('update:content')" --> A
    A -- "3. 顶层状态更新" --> A
    
    C -- "4. 用户操作触发" --> C_InternalState(props.optimizedPrompt 仍为旧值)
    
    subgraph "问题"
        D{C组件数据未同步}
    end

    C_InternalState -- "使用旧数据执行操作" --> D
```

---

#### 解决方案：构建可靠的响应式数据流架构

**核心目标**：确保任何源于用户交互的状态变更，都能**立即、单向地**同步回单一数据源（Single Source of Truth），并使所有依赖该数据源的组件都能自动响应更新。

**实施模式**:

1.  **模式一：实时状态提升 (Real-time State Hoisting)**

    子组件不应持有临时的、未同步的"草稿"状态。任何可编辑的状态都应在变更的瞬间通过`emit`事件向上同步，而不是等待某个特定动作（如"保存"或"失焦"）触发。

    ```typescript
    // 子组件：OutputDisplayCore.vue
    // 通过 watch 实时将内部编辑内容同步到父级
    watch(editingContent, (newContent) => {
      if (isEditing.value) {
        emit('update:content', newContent);
      }
    }, { immediate: false });
    ```

2.  **模式二：时序与竞态控制 (Timing and Race Condition Control)**

    对于需要清空或重置状态的异步操作（如开始流式加载），必须确保状态变更操作（如退出编辑、清空内容）在异步任务启动前完成。`nextTick` 是解决此类DOM更新与状态变更竞态问题的关键。

    ```typescript
    // 状态管理方：usePromptOptimizer.ts
    async function handleOptimize() {
        isOptimizing.value = true;
        optimizedPrompt.value = ''; // 1. 同步清空状态
        await nextTick();          // 2. 等待DOM和状态更新完成
        
        // 3. 启动异步服务
        await promptService.value.optimizePromptStream(...);
    }
    ```
   
3.  **模式三：外部事件驱动的状态重置**

    当一个动作（如优化）需要影响兄弟组件的状态（如强制退出编辑）时，应通过顶层组件的监听与方法调用（`ref.method()`）来实现，而不是让组件间直接通信。

    ```typescript
    // 父组件：PromptPanel.vue
    // 监听顶层状态变化，调用子组件方法
    watch(() => props.isOptimizing, (newVal) => {
      if (newVal) {
        outputDisplayRef.value?.forceExitEditing();
      }
    });
    ```

#### 核心设计原则
- **单一数据源 (Single Source of Truth)**：任何共享状态都必须由唯一的、高阶的组件或状态管理器拥有。子组件只能通过`props`接收和通过`emit`请求变更。
- **响应式数据流闭环**：确保"用户输入 -> `emit` -> 更新顶层状态 -> `props` -> 更新所有相关子组件"这个数据流是完整且自动响应的。
- **系统化调试策略**：当遇到状态不同步问题时，从数据源头（顶层状态）到消费端（子组件Props）逐级添加临时日志，是快速定位数据流"断点"的最有效方法。

---

## ⚡ 快速问题排查

### 布局问题
1. 检查 Flex 约束链是否完整
2. 确认 `min-h-0` 是否添加
3. 验证父容器是否为 `display: flex`

### 滚动问题
1. 检查是否有中间层错误的 `overflow` 属性
2. 确认高度约束是否从顶层正确传递
3. 验证滚动容器是否有正确的 `overflow-y: auto`

### API调用问题
1. 检查环境变量是否正确设置（`VITE_` 前缀）
2. 确认参数是否过度设置默认值
3. 验证错误处理是否用户友好

### 测试失败
1. 检查测试ID是否唯一
2. 确认测试后是否正确清理状态
3. 验证LLM参数测试是否独立

---

## 🔄 版本管理

### 版本同步
```json
// package.json
{
  "scripts": {
    "version": "pnpm run version:sync && git add -A"
  }
}
```
**关键**：使用 `version` 钩子而非 `postversion`，确保同步文件包含在版本提交中。

### 模板管理
- **内置模板**：不可修改，不可导出
- **用户模板**：可修改，导入时生成新ID
- **导入规则**：跳过与内置模板ID重复的模板

### 4. 数组内容深度比较修复（2025-01-27）
**问题**：BugBot 发现模板内容比较使用引用比较而非深度比较
```typescript
// ❌ 错误：数组引用比较
if (updatedTemplate.content !== currentTemplate.content) {
  // 数组内容相同但引用不同时会触发不必要更新
}

// ✅ 正确：深度比较函数
const deepCompareTemplateContent = (content1, content2) => {
  if (typeof content1 !== typeof content2) return false;
  
  if (typeof content1 === 'string') return content1 === content2;
  
  if (Array.isArray(content1) && Array.isArray(content2)) {
    if (content1.length !== content2.length) return false;
    return content1.every((item1, index) => {
      const item2 = content2[index];
      return item1.role === item2.role && item1.content === item2.content;
    });
  }
  
  return JSON.stringify(content1) === JSON.stringify(content2);
};

// 使用深度比较
if (!deepCompareTemplateContent(updatedTemplate.content, currentTemplate.content)) {
  // 只有内容真正改变时才更新
}
```

**关键**：Template 接口的 content 可以是 `string | Array<{role: string; content: string}>`，必须支持两种类型的正确比较。

### 5. 模板类型过滤器验证修复（2025-01-27）
**问题**：BugBot 发现 refreshTemplates 函数可能选择不匹配类型过滤器的模板
```typescript
// ❌ 问题：更新模板后直接返回，未验证类型匹配
if (updatedTemplate && contentChanged) {
  emit('update:modelValue', updatedTemplate)
  return // 跳过了类型验证
}

// ✅ 修复：添加类型验证
if (updatedTemplate && contentChanged) {
  // 验证更新后的模板是否还匹配当前类型过滤器
  if (updatedTemplate.metadata.templateType === props.type) {
    emit('update:modelValue', updatedTemplate)
    return
  }
  // 类型不匹配时继续执行后续逻辑
}
```
**修复效果**：确保模板选择器只选择匹配当前类型的模板，避免类型不一致的问题。

---

## 📝 文档更新规范

遇到新问题或找到更好解决方案时，应及时更新此文档：
1. 在对应章节添加新经验
2. 更新代码示例
3. 记录修复时间和问题背景
4. 保持文档简洁性，避免过度详细的过程描述

---

**记住**：好的经验文档应该能让团队成员快速找到解决方案，而不是重新踩坑。
