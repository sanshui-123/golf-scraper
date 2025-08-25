# Claude进程卡住处理方案

## 问题现象
- Claude改写命令长时间不返回结果
- 进程占用高CPU但无输出
- 多个claude进程同时存在

## 立即处理步骤

### 1. 检查进程状态
```bash
ps aux | grep claude | grep -v grep
```

### 2. 终止卡住的进程
```bash
# 方法1: 使用pkill
pkill -f claude

# 方法2: 如果还存在，强制终止
pkill -9 -f claude

# 方法3: 使用具体PID
kill -9 <PID>
```

### 3. 重新处理文章

#### 方案A: 使用安全运行器（推荐）
```bash
# 静默版本（不输出调试信息）
node claude_safe_runner_quiet.js <临时文件路径> > <输出文件路径>

# 调试版本（输出运行状态）
node claude_safe_runner.js <临时文件路径> > <输出文件路径>
```

#### 方案B: 直接重新运行claude
```bash
claude --dangerously-skip-permissions < <临时文件路径> > <输出文件路径>
```

## 预防措施

### 使用ClaudeSafeRunner类
```javascript
const ClaudeSafeRunner = require('./claude_safe_runner_quiet.js');

// 创建实例
const runner = new ClaudeSafeRunner({
    timeout: 120000,      // 2分钟超时
    maxRetries: 2,        // 最多重试2次
    verbose: false        // 不输出调试信息
});

// 处理文件
runner.run('temp_prompt.txt')
    .then(result => {
        console.log('处理成功');
        // 保存结果
    })
    .catch(err => {
        console.error('处理失败:', err.message);
    });
```

## 安全运行器特性

1. **自动清理旧进程** - 运行前检查并清理
2. **超时控制** - 默认2分钟自动终止
3. **自动重试** - 失败后自动重试（最多2次）
4. **静默模式** - 不输出调试信息到结果

## 注意事项

1. **不要修改封装好的程序** - 保持原有逻辑不变
2. **临时文件检查** - 确保临时文件内容完整
3. **输出清理** - 如果包含调试信息，需要手动清理

## 常见问题

### Q: 为什么会有多个claude进程？
A: 之前的进程没有正常退出，可能因为：
- 内容触发某种限制
- CLI需要交互确认
- 进程异常卡住

### Q: 安全运行器vs直接运行？
A: 安全运行器优势：
- 自动处理进程管理
- 避免重复卡住
- 提供超时保护
- 支持自动重试

### Q: 如何判断是否卡住？
A: 观察以下指标：
- 运行时间超过2分钟
- CPU占用持续很高
- 没有输出产生