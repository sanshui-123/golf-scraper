# AI检测系统快速使用指南

## 一键启动
```bash
# 完整流程：生成URL → AI检测 → 自动重写
./smart_restart.sh
```

## 核心功能

### 1. 自动AI检测
- 所有文章在处理时自动进行AI检测
- AI率超过**40%**时自动重写（最多3次）
- 检测结果保存在MD文件开头

### 2. 查看检测结果
```bash
# Web界面查看
http://localhost:8080

# 统计AI检测情况
grep "AI检测" golf_content/$(date +%Y-%m-%d)/wechat_ready/*.md | awk -F': ' '{print $2}' | sort | uniq -c
```

### 3. 手动检测
```bash
# 检测单个文件
node ai_content_detector_enhanced.js --file article.md

# 批量检测
node ai_content_detector_enhanced.js --batch golf_content/2025-08-16/
```

## 系统状态
- ✅ BitBrowser依赖已完全移除
- ✅ AI检测阈值优化至40%
- ✅ 使用智能代理池进行检测
- ✅ 所有文章都有AI检测数据

---
更新时间：2025-08-16