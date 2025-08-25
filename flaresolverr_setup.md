# FlareSolverr设置指南

## 1. 安装FlareSolverr（使用Docker）
```bash
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest
```

## 2. 创建MyGolfSpy专用抓取器
创建文件 `mygolfspy_flaresolverr.js`：

```javascript
const axios = require('axios');

async function scrapeWithFlareSolverr(url) {
    try {
        const response = await axios.post('http://localhost:8191/v1', {
            cmd: 'request.get',
            url: url,
            maxTimeout: 60000
        });
        
        if (response.data.status === 'ok') {
            return response.data.solution.response;
        }
        throw new Error('FlareSolverr request failed');
    } catch (error) {
        console.error('FlareSolverr error:', error.message);
        throw error;
    }
}

module.exports = { scrapeWithFlareSolverr };
```

## 3. 集成到现有系统
在 `batch_process_articles.js` 中添加FlareSolverr支持：

```javascript
// 对于MyGolfSpy，使用FlareSolverr
if (url.includes('mygolfspy.com')) {
    const { scrapeWithFlareSolverr } = require('./mygolfspy_flaresolverr');
    const htmlContent = await scrapeWithFlareSolverr(url);
    // 处理获取到的HTML内容
}
```