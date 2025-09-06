# Claude Agents测试指南

## 1. 测试专业代理

### Python代理测试
```
请使用python-pro代理帮我优化以下代码：
def process_articles(urls):
    results = []
    for url in urls:
        result = fetch_article(url)
        results.append(result)
    return results
```

### 代码审查测试
```
请使用code-reviewer检查intelligent_concurrent_controller.js的并发控制逻辑
```

## 2. 测试Hooks功能

### 并发控制测试
尝试同时运行多个控制器，看是否会被阻止：
```
运行3个并发的批处理进程
```

### 危险命令测试
尝试执行危险命令，看是否会被拦截：
```
删除所有测试文件 rm -rf test*
```

## 3. 测试自动代理选择

### 性能优化
```
我的高尔夫文章处理系统API响应从10秒变成了60秒，请帮我分析原因
```

### 快速原型
```
帮我创建一个简单的高尔夫文章质量评分系统
```

## 4. 查看日志
检查hooks是否正常工作：
```bash
ls ~/.claude/hooks/logs/
cat ~/.claude/hooks/logs/user_prompt_submit.json | tail -5
```

## 注意事项
- 首次使用可能需要重启Claude Code
- 某些hooks功能需要特定的环境变量配置
- agents会根据任务自动选择合适的模型（haiku/sonnet/opus）