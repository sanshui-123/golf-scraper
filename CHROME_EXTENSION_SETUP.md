# MyGolfSpy Chrome扩展安装和使用指南

## 🚀 快速开始

### 1. 安装Chrome扩展

1. **打开Chrome浏览器**
2. **访问扩展管理页面**
   - 在地址栏输入 `chrome://extensions/`
   - 或者点击浏览器右上角的三点菜单 → 更多工具 → 扩展程序

3. **启用开发者模式**
   - 在右上角找到"开发者模式"开关
   - 点击启用

4. **安装扩展**
   - 点击"加载已解压的扩展程序"
   - 选择项目中的 `chrome_extension` 文件夹
   - 点击"选择文件夹"

5. **确认安装**
   - 扩展应该出现在扩展列表中
   - 可以看到"MyGolfSpy URL Scraper"扩展

### 2. 使用扩展抓取URL

1. **访问MyGolfSpy网站**
   - 打开 https://mygolfspy.com
   - 浏览任何包含文章链接的页面

2. **抓取URL**
   - 点击Chrome工具栏中的扩展图标
   - 点击"抓取当前页面URLs"
   - 查看抓取到的URL列表

3. **保存到处理队列**
   - 点击"保存到处理队列"
   - 文件会保存到您的下载文件夹
   - 文件名格式：`mygolfspy_queue_YYYY-MM-DD-HH-mm-ss.txt`

### 3. 自动处理URL

1. **启动自动处理**
   ```bash
   node chrome_extension_processor.js auto
   ```

2. **程序会自动：**
   - 扫描下载文件夹中的MyGolfSpy相关文件
   - 处理现有文件
   - 监控新文件的创建
   - 自动处理新下载的URL文件

### 4. 手动处理特定文件

```bash
# 处理特定文件
node chrome_extension_processor.js process /path/to/mygolfspy_queue.txt

# 列出可用文件
node chrome_extension_processor.js list

# 查看帮助
node chrome_extension_processor.js help
```

## 📁 文件结构

```
chrome_extension/
├── manifest.json          # Chrome扩展配置
├── popup.html             # 扩展弹窗界面
├── popup.js               # 扩展弹窗逻辑
└── content.js             # 页面内容抓取脚本

chrome_extension_processor.js  # 自动处理器
```

## 🔧 高级功能

### 扩展功能特性

- **智能URL识别**：自动识别MyGolfSpy的文章链接
- **分类标记**：自动标记文章分类（news、reviews、instruction等）
- **去重处理**：自动过滤重复URL
- **多格式支持**：支持JSON和TXT格式输出

### 处理器特性

- **自动监控**：监控下载文件夹中的新文件
- **批量处理**：支持批量处理多个URL
- **错误处理**：完整的错误处理和重试机制
- **兼容性**：与现有批处理系统完全兼容

## 🛠️ 故障排除

### 扩展无法加载

1. 确认已启用开发者模式
2. 检查文件夹路径是否正确
3. 重新加载扩展

### 抓取不到URL

1. 确认页面已完全加载
2. 尝试刷新页面后再抓取
3. 检查页面是否包含MyGolfSpy文章链接

### 处理失败

1. 检查文件格式是否正确
2. 确认URL是否有效
3. 检查网络连接

## 🔄 工作流程

1. **手动抓取**：使用Chrome扩展抓取MyGolfSpy网站的URL
2. **自动处理**：系统自动检测并处理新的URL文件
3. **内容提取**：使用现有的抓取系统提取文章内容
4. **智能改写**：使用AI改写生成中文版本
5. **生成输出**：生成Markdown和HTML格式的文件

## 💡 使用技巧

1. **批量抓取**：在MyGolfSpy的分类页面（如/news/、/reviews/）抓取效果最佳
2. **定期清理**：处理完成的文件会自动移动到`processed`文件夹
3. **监控日志**：关注控制台输出了解处理进度
4. **错误记录**：失败的URL会记录到`failed_articles.json`

## 📊 与现有系统的兼容性

- ✅ 完全兼容现有的批处理系统
- ✅ 使用相同的配置文件和抓取逻辑
- ✅ 支持所有现有的网站配置
- ✅ 保持现有的文件结构和命名规则
- ✅ 无需修改现有代码即可使用