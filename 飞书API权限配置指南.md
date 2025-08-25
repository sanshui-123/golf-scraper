# 飞书API权限配置指南

## 🎯 目标
为您的飞书应用添加必要的API权限，实现：
- ✅ 直接通过API创建文档（无需浏览器自动化）
- ✅ 同步数据到多维表格
- ✅ 完全自动化的内容管理

## 🔧 当前权限问题

### 1. 文档权限缺失
```
❌ 错误: Access denied. One of the following scopes is required: [docx:document, docx:document:create]
```

### 2. 多维表格权限缺失
```
❌ 错误: Forbidden (91403) - 应用缺少必要权限
```

## 📋 权限配置步骤

### 步骤1: 访问飞书开放平台
1. 打开浏览器，访问：https://open.feishu.cn/app
2. 使用您的飞书账号登录
3. 找到您的应用：`cli_a8ba91e518665013`

### 步骤2: 配置文档权限
在应用管理页面：
1. 点击"权限管理"标签
2. 搜索"文档"或"docx"
3. 添加以下权限：
   - ✅ `docx:document` - 获取文档信息
   - ✅ `docx:document:create` - 创建文档
   - ✅ `docx:document:read` - 读取文档内容
   - ✅ `docx:document:write` - 编辑文档内容

### 步骤3: 配置多维表格权限
继续在权限管理页面：
1. 搜索"多维表格"或"bitable"
2. 添加以下权限：
   - ✅ `bitable:app` - 获取多维表格信息
   - ✅ `bitable:app:readonly` - 只读多维表格
   - ✅ `bitable:record` - 管理多维表格记录
   - ✅ `bitable:record:readonly` - 只读表格记录
   - ✅ `bitable:record:write` - 写入表格记录

### 步骤4: 快速权限申请（推荐）
系统已为您生成快速申请链接：
```
https://open.feishu.cn/app/cli_a8ba91e518665013/auth?q=docx:document,docx:document:create&op_from=openapi&token_type=tenant
```

点击此链接可直接申请文档权限。

### 步骤5: 保存并等待生效
1. 点击"保存"按钮
2. 权限通常在5-10分钟内生效
3. 等待期间可以准备其他配置

## 🔗 完整权限清单

为了确保所有功能正常工作，建议添加以下完整权限：

### 基础权限
- `auth:user.id:read` - 获取用户ID
- `tenant_access_token:internal` - 获取应用访问令牌

### 文档权限
- `docx:document` - 文档基础权限
- `docx:document:create` - 创建文档
- `docx:document:read` - 读取文档
- `docx:document:write` - 编辑文档

### 多维表格权限
- `bitable:app` - 表格应用权限
- `bitable:app:readonly` - 只读表格应用
- `bitable:record` - 表格记录权限
- `bitable:record:readonly` - 只读表格记录
- `bitable:record:write` - 写入表格记录

### 云文档权限（可选）
- `drive:drive` - 云盘权限
- `drive:file` - 文件管理权限

## ⚡ 验证权限配置

权限配置完成后，运行以下命令验证：

### 验证文档权限
```bash
npm run feishu-docs-api
```

### 验证多维表格权限
```bash
npm run feishu-api-fixed
```

### 运行权限检查工具
```bash
npm run feishu-check
```

## 🎉 配置成功后的效果

权限配置成功后，您将能够：

1. **自动创建文档**
   - 无需手动操作浏览器
   - 直接通过API创建格式化文档
   - 自动写入高尔夫资讯内容

2. **同步到多维表格**
   - 自动整理文章数据
   - 批量插入到表格
   - 智能分类和标记

3. **完全自动化工作流**
   - 一键完成内容提取→处理→同步
   - 无需人工干预
   - 高效稳定的数据管理

## 🆘 常见问题

### Q: 权限申请后多久生效？
A: 通常5-10分钟内生效，最长不超过30分钟。

### Q: 如何确认权限是否生效？
A: 运行 `npm run feishu-check` 进行权限验证。

### Q: 权限申请失败怎么办？
A: 检查应用状态是否正常，确保有管理员权限。

### Q: 可以只申请部分权限吗？
A: 可以，但建议申请完整权限以确保所有功能正常。

## 📞 技术支持

如果遇到权限配置问题，可以：
1. 查看飞书开放平台文档
2. 联系飞书技术支持
3. 检查应用配置是否正确

---

**配置完成后，请运行 `npm run feishu-docs-api` 测试文档创建功能！** 