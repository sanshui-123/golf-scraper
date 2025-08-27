/**
 * Vercel Serverless Function
 * 高尔夫文章管理系统 API
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// 创建Express应用
const app = express();

// 解析 JSON 请求体
app.use(express.json());

// CORS设置
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 静态文件服务
app.use('/golf_content', express.static(path.join(process.cwd(), 'golf_content')));

// HTML模板生成器
const htmlTemplate = {
    page: (title, content, extraStyles = '', extraScripts = '') => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: rgba(255,255,255,0.95);
            padding: 1.5rem;
            border-radius: 15px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .article-card {
            background: white;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-radius: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        .article-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .article-title {
            font-size: 1.2rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 0.5rem;
        }
        .article-meta {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 0.5rem;
        }
        .button {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #4a5568;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background 0.2s;
        }
        .button:hover {
            background: #2d3748;
        }
        .button.primary {
            background: #667eea;
        }
        .button.primary:hover {
            background: #5a67d8;
        }
        ${extraStyles}
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
    ${extraScripts}
</body>
</html>`
};

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Golf article management system is running' });
});

// 主页
app.get('/', async (req, res) => {
    const content = `
        <div class="header">
            <h1>⛳ 高尔夫文章管理系统</h1>
            <p style="margin-top: 0.5rem; color: #666;">Vercel部署版本</p>
        </div>
        <div style="background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="margin-bottom: 1.5rem;">系统功能</h2>
            <div style="display: grid; gap: 1rem;">
                <a href="/articles/today" class="button primary">📖 查看今日文章</a>
                <a href="/monitor" class="button">📊 系统监控面板</a>
                <a href="/api/system-status" class="button">🔍 查看系统状态</a>
            </div>
        </div>
    `;
    res.send(htmlTemplate.page('高尔夫文章管理系统', content));
});

// 查看文章列表
app.get('/articles/:date', async (req, res) => {
    try {
        const date = req.params.date === 'today' ? 
            new Date().toISOString().split('T')[0] : 
            req.params.date;
        
        const articlesPath = path.join(process.cwd(), 'golf_content', date, 'wechat_ready');
        
        // 检查目录是否存在
        try {
            await fs.access(articlesPath);
        } catch {
            return res.send(htmlTemplate.page('文章列表', 
                `<div class="header">
                    <h1>📅 ${date} 的文章</h1>
                    <a href="/" class="button">返回首页</a>
                </div>
                <div style="background: white; padding: 2rem; border-radius: 10px; text-align: center;">
                    <p>该日期没有文章</p>
                </div>`
            ));
        }
        
        const files = await fs.readdir(articlesPath);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        
        let articlesHtml = '';
        for (const file of mdFiles) {
            const filePath = path.join(articlesPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const title = content.split('\n')[0].replace('#', '').trim();
            const size = (fsSync.statSync(filePath).size / 1024).toFixed(2);
            
            articlesHtml += `
                <div class="article-card">
                    <div class="article-title">${title}</div>
                    <div class="article-meta">
                        文件名: ${file} | 大小: ${size} KB
                    </div>
                    <a href="/golf_content/${date}/wechat_ready/${file}" class="button" style="margin-right: 0.5rem;">查看</a>
                </div>
            `;
        }
        
        const content = `
            <div class="header">
                <h1>📅 ${date} 的文章 (${mdFiles.length} 篇)</h1>
                <a href="/" class="button">返回首页</a>
            </div>
            <div>${articlesHtml || '<p style="text-align: center;">暂无文章</p>'}</div>
        `;
        
        res.send(htmlTemplate.page(`${date} 文章列表`, content));
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(htmlTemplate.page('错误', 
            `<div class="header">
                <h1>❌ 错误</h1>
                <p>${error.message}</p>
                <a href="/" class="button">返回首页</a>
            </div>`
        ));
    }
});

// 系统状态API
app.get('/api/system-status', async (req, res) => {
    try {
        const contentDir = path.join(process.cwd(), 'golf_content');
        const today = new Date().toISOString().split('T')[0];
        const todayPath = path.join(contentDir, today, 'wechat_ready');
        
        let todayArticles = 0;
        try {
            const files = await fs.readdir(todayPath);
            todayArticles = files.filter(f => f.endsWith('.md')).length;
        } catch {}
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            statistics: {
                todayArticles,
                date: today
            },
            deployment: {
                platform: 'Vercel',
                region: process.env.VERCEL_REGION || 'unknown'
            }
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// 简单的监控面板
app.get('/monitor', async (req, res) => {
    const content = `
        <div class="header">
            <h1>📊 系统监控面板</h1>
            <a href="/" class="button">返回首页</a>
        </div>
        <div style="background: white; padding: 2rem; border-radius: 15px; margin-bottom: 1rem;">
            <h2>系统状态</h2>
            <div id="status-container">
                <p>加载中...</p>
            </div>
        </div>
        <script>
            async function loadStatus() {
                try {
                    const response = await fetch('/api/system-status');
                    const data = await response.json();
                    
                    document.getElementById('status-container').innerHTML = \`
                        <div style="display: grid; gap: 1rem;">
                            <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                                <strong>状态:</strong> \${data.status === 'ok' ? '✅ 正常' : '❌ 异常'}
                            </div>
                            <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                                <strong>今日文章数:</strong> \${data.statistics.todayArticles} 篇
                            </div>
                            <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                                <strong>部署平台:</strong> \${data.deployment.platform}
                            </div>
                            <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                                <strong>更新时间:</strong> \${new Date(data.timestamp).toLocaleString('zh-CN')}
                            </div>
                        </div>
                    \`;
                } catch (error) {
                    document.getElementById('status-container').innerHTML = 
                        '<p style="color: red;">加载失败: ' + error.message + '</p>';
                }
            }
            
            loadStatus();
            setInterval(loadStatus, 5000);
        </script>
    `;
    
    res.send(htmlTemplate.page('系统监控', content));
});

// 404处理
app.use((req, res) => {
    res.status(404).send(htmlTemplate.page('404', 
        `<div class="header">
            <h1>❌ 404 - 页面未找到</h1>
            <p>请求的页面不存在</p>
            <a href="/" class="button">返回首页</a>
        </div>`
    ));
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send(htmlTemplate.page('错误', 
        `<div class="header">
            <h1>❌ 服务器错误</h1>
            <p>${err.message}</p>
            <a href="/" class="button">返回首页</a>
        </div>`
    ));
});

// 导出应用
module.exports = app;