# 安全包装器 V2 使用指南

## 🆕 新功能：文件名自动修复

### 主要改进
1. **自动修复文件名** - 确保文件编号与预期一致
2. **备份冲突文件** - 防止覆盖重要数据
3. **智能重命名** - 处理图片映射文件

## 使用方法

### 基本使用（和之前一样）
```bash
node article_processor_safe_wrapper_v2.js <URL>
```

### 示例
```bash
node article_processor_safe_wrapper_v2.js "https://www.golfmonthly.com/news/example"
```

## 工作流程

```
1. 获取安全编号（如：8）
   ↓
2. 备份可能冲突的文件
   ↓
3. 调用原处理器（可能保存为错误编号）
   ↓
4. 🆕 自动修复文件名（如：03 → 08）
   ↓
5. 保存URL映射
   ↓
6. 验证结果
```

## 文件名修复示例

### 场景
- 预期编号：8
- 原程序保存为：wechat_article_03.md
- V2自动修复为：wechat_article_08.md

### 日志输出
```
🔧 检查并修复文件名...
⚠️  发现文件编号不匹配: 3 → 8
  ✓ 文件重命名: wechat_article_03.md → wechat_article_08.md
  ✓ 图片映射重命名: image_map_3.json → image_map_8.json
✅ 文件名修复完成
```

## 配置选项

```javascript
{
    enableBackup: true,        // 备份冲突文件
    enableUrlTracking: true,   // 保存原文链接
    enableSafeNumbering: true, // 智能编号分配
    enableFileNameFix: true    // 🆕 文件名自动修复
}
```

## 优势

### 相比 V1
- ✅ 自动修复文件名bug
- ✅ 不需要手动干预
- ✅ 保持向后兼容

### 相比原程序
- ✅ 防止图片覆盖
- ✅ 保存原文链接
- ✅ 修复文件名bug
- ✅ 数据备份保护

## 迁移指南

### 从 V1 迁移
```bash
# 之前
node article_processor_safe_wrapper.js <URL>

# 现在
node article_processor_safe_wrapper_v2.js <URL>
```

### 从原程序迁移
```bash
# 之前（不要用）
node process_single_article_final.js <URL>

# 现在（推荐）
node article_processor_safe_wrapper_v2.js <URL>
```

## 注意事项

1. **自动化** - 所有修复都是自动的
2. **备份** - 冲突文件会自动备份
3. **日志** - 详细的处理日志
4. **验证** - 自动验证处理结果

## 总结

V2版本在保持原有功能的基础上，增加了文件名自动修复功能，彻底解决了文件编号错误的问题。使用方式保持不变，但功能更加完善。