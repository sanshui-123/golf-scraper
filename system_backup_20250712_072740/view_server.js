const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const server = http.createServer((req, res) => {
    console.log('请求路径:', req.url);
    
    if (req.url === '/') {
        // 生成首页，只显示日期列表，点击展开文章
        const golfContentDir = path.join(__dirname, 'golf_content');
        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>高尔夫文章管理系统</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 0;
            background: #f5f5f5; 
        }
        .header {
            background: #2c5aa0;
            color: white;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .container { 
            max-width: 1200px; 
            margin: 20px auto; 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .stats {
            margin: 20px 0;
            padding: 15px;
            background: #e8f4f8;
            border-radius: 5px;
            text-align: center;
        }
        .date-item {
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
        }
        .date-header {
            padding: 15px;
            background: #f9f9f9;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s;
        }
        .date-header:hover {
            background: #e8f4f8;
        }
        .date-info {
            font-size: 18px;
            font-weight: bold;
            color: #2c5aa0;
        }
        .article-count {
            background: #2c5aa0;
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 14px;
        }
        .toggle-icon {
            font-size: 20px;
            color: #666;
            transition: transform 0.3s;
        }
        .date-header.expanded .toggle-icon {
            transform: rotate(90deg);
        }
        .article-list {
            display: none;
            padding: 10px 20px 20px;
            background: #fafafa;
            border-top: 1px solid #eee;
        }
        .article-item {
            margin: 10px 0;
            padding: 10px 15px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.3s;
        }
        .article-item:hover {
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            transform: translateY(-1px);
        }
        .article-info {
            flex: 1;
        }
        .article-title {
            font-size: 16px;
            color: #333;
            margin-bottom: 5px;
        }
        .article-meta {
            font-size: 12px;
            color: #999;
        }
        .article-actions {
            display: flex;
            gap: 10px;
        }
        .article-link {
            text-decoration: none;
            color: white;
            padding: 6px 12px;
            border-radius: 3px;
            font-size: 14px;
            transition: all 0.3s;
        }
        .link-md {
            background: #2c5aa0;
        }
        .link-md:hover {
            background: #1e3d6f;
        }
        .link-wechat {
            background: #07c160;
        }
        .link-wechat:hover {
            background: #06b053;
        }
        .link-original {
            background: #6c757d;
        }
        .link-original:hover {
            background: #5a6268;
        }
        .delete-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }
        .delete-btn:hover {
            background: #c82333;
        }
        .search-box {
            margin: 20px 0;
            text-align: center;
        }
        .search-box input {
            padding: 10px 15px;
            width: 400px;
            border: 1px solid #ddd;
            border-radius: 25px;
            font-size: 16px;
            outline: none;
        }
        .search-box input:focus {
            border-color: #2c5aa0;
            box-shadow: 0 0 0 2px rgba(44, 90, 160, 0.2);
        }
        .empty-message {
            text-align: center;
            color: #999;
            padding: 40px;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 高尔夫文章管理系统</h1>
        <p>点击日期查看文章列表</p>
    </div>
    <div class="container">
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="搜索文章标题或内容..." onkeyup="filterArticles()">
        </div>
        <div class="stats" id="stats">
            正在加载统计信息...
        </div>`;
        
        try {
            const dates = fs.readdirSync(golfContentDir)
                .filter(d => d.match(/^\d{4}-\d{2}-\d{2}$/))
                .sort()
                .reverse();
            
            let totalArticles = 0;
            let dateCount = 0;
            
            dates.forEach(date => {
                const articlesDir = path.join(golfContentDir, date, 'articles');
                const wechatHtmlDir = path.join(golfContentDir, date, 'wechat_html');
                const articleUrlsPath = path.join(golfContentDir, date, 'article_urls.json');
                
                if (fs.existsSync(articlesDir)) {
                    const articles = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
                    
                    if (articles.length > 0) {
                        dateCount++;
                        totalArticles += articles.length;
                        
                        html += `
                        <div class="date-item" data-date="${date}">
                            <div class="date-header" onclick="toggleDate('${date}')">
                                <div class="date-info">
                                    <span class="toggle-icon">▶</span>
                                    <span style="margin-left: 10px;">📅 ${date}</span>
                                </div>
                                <span class="article-count">${articles.length} 篇文章</span>
                            </div>
                            <div class="article-list" id="list-${date}">`;
                        
                        // 读取原文链接信息
                        let articleUrls = {};
                        if (fs.existsSync(articleUrlsPath)) {
                            try {
                                articleUrls = JSON.parse(fs.readFileSync(articleUrlsPath, 'utf8'));
                            } catch (e) {}
                        }
                        
                        articles.forEach(article => {
                            const articleName = article.replace('.md', '');
                            const mdPath = `/view/${date}/md/${article}`;
                            const htmlFile = article.replace('.md', '.html');
                            const wechatPath = `/view/${date}/wechat/${htmlFile.replace('article_', 'wechat_article_')}`;
                            
                            // 读取文章标题
                            let title = articleName;
                            let originalUrl = articleUrls[articleName] || '';
                            
                            try {
                                const content = fs.readFileSync(path.join(articlesDir, article), 'utf8');
                                const titleMatch = content.match(/^# (.+)$/m);
                                if (titleMatch) {
                                    title = titleMatch[1];
                                }
                            } catch (e) {}
                            
                            html += `
                            <div class="article-item" data-article="${article}" data-title="${title.toLowerCase()}">
                                <div class="article-info">
                                    <div class="article-title">${title}</div>
                                    <div class="article-meta">文件: ${article}</div>
                                </div>
                                <div class="article-actions">
                                    <a href="${mdPath}" class="article-link link-md">查看文章</a>
                                    ${fs.existsSync(path.join(wechatHtmlDir, htmlFile.replace('article_', 'wechat_article_'))) ? 
                                        `<a href="${wechatPath}" class="article-link link-wechat">微信版</a>` : ''}
                                    ${originalUrl ? 
                                        `<a href="${originalUrl}" class="article-link link-original" target="_blank">原文</a>` : ''}
                                    <button class="delete-btn" onclick="deleteArticle('${date}', '${article}', event)">删除</button>
                                </div>
                            </div>`;
                        });
                        
                        html += `</div></div>`;
                    }
                }
            });
            
            // 更新统计信息
            html = html.replace(
                '<div class="stats" id="stats">正在加载统计信息...</div>',
                `<div class="stats" id="stats">
                    <strong>统计信息：</strong> 
                    共 ${dateCount} 个日期，${totalArticles} 篇文章
                </div>`
            );
            
            if (dateCount === 0) {
                html += '<div class="empty-message">暂无文章数据</div>';
            }
        } catch (e) {
            html += '<div class="empty-message">错误：无法读取文章目录</div>';
        }
        
        html += `
    </div>
    <script>
        function toggleDate(date) {
            const list = document.getElementById('list-' + date);
            const header = list.previousElementSibling;
            
            if (list.style.display === 'block') {
                list.style.display = 'none';
                header.classList.remove('expanded');
            } else {
                list.style.display = 'block';
                header.classList.add('expanded');
            }
        }
        
        function filterArticles() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const dateItems = document.querySelectorAll('.date-item');
            
            dateItems.forEach(dateItem => {
                const articles = dateItem.querySelectorAll('.article-item');
                let hasVisible = false;
                
                articles.forEach(article => {
                    const title = article.getAttribute('data-title');
                    if (title.includes(searchTerm)) {
                        article.style.display = 'flex';
                        hasVisible = true;
                    } else {
                        article.style.display = 'none';
                    }
                });
                
                if (hasVisible && searchTerm) {
                    // 如果有匹配的文章且正在搜索，自动展开
                    const date = dateItem.getAttribute('data-date');
                    const list = document.getElementById('list-' + date);
                    const header = list.previousElementSibling;
                    list.style.display = 'block';
                    header.classList.add('expanded');
                }
                
                dateItem.style.display = hasVisible || !searchTerm ? 'block' : 'none';
            });
        }
        
        function deleteArticle(date, articleFile, event) {
            event.stopPropagation();
            
            if (!confirm('确定要删除这篇文章吗？此操作不可恢复！')) {
                return;
            }
            
            fetch('/delete/' + date + '/' + articleFile, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    alert('文章已成功删除');
                    location.reload();
                } else {
                    alert('删除失败: ' + result.error);
                }
            })
            .catch(error => {
                alert('删除失败: ' + error);
            });
        }
        
        // 支持URL参数自动展开特定日期
        const urlParams = new URLSearchParams(window.location.search);
        const expandDate = urlParams.get('date');
        if (expandDate) {
            setTimeout(() => {
                const list = document.getElementById('list-' + expandDate);
                if (list) {
                    list.style.display = 'block';
                    list.previousElementSibling.classList.add('expanded');
                    list.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }
    </script>
</body>
</html>`;
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        
    } else if (req.url.startsWith('/view/')) {
        // 处理文章查看请求
        const parts = req.url.split('/');
        const date = parts[2];
        const type = parts[3];
        const filename = parts.slice(4).join('/');
        
        let filePath;
        if (type === 'md') {
            filePath = path.join(__dirname, 'golf_content', date, 'articles', filename);
        } else if (type === 'wechat') {
            filePath = path.join(__dirname, 'golf_content', date, 'wechat_html', filename);
        }
        
        if (filePath && fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (type === 'md') {
                // 简单的Markdown渲染
                let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>文章查看</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            line-height: 1.6;
            background: #f5f5f5;
        }
        .content-wrapper {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        img { max-width: 100%; height: auto; margin: 20px 0; display: block; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 4px; }
        a { color: #2c5aa0; }
        .back-link { 
            margin-bottom: 20px; 
            display: inline-block;
            background: #2c5aa0;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 4px;
        }
        .back-link:hover {
            background: #1e3d6f;
        }
    </style>
</head>
<body>
    <a href="/?date=${date}" class="back-link">← 返回文章列表</a>
    <div class="content-wrapper">`;
                
                // 基本的Markdown转HTML
                const htmlContent = content
                    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/^(?!<h|<p)(.+)$/gm, '<p>$1</p>');
                
                html += htmlContent + '</div></body></html>';
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
            } else {
                // 处理微信版HTML
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
            }
        } else {
            res.writeHead(404);
            res.end('文件未找到');
        }
        
    } else if (req.url.startsWith('/delete/')) {
        // 处理删除请求
        const parts = req.url.split('/');
        const date = parts[2];
        const articleFile = parts[3];
        
        const articlesDir = path.join(__dirname, 'golf_content', date, 'articles');
        const articlePath = path.join(articlesDir, articleFile);
        const wechatHtmlDir = path.join(__dirname, 'golf_content', date, 'wechat_html');
        const wechatReadyDir = path.join(__dirname, 'golf_content', date, 'wechat_ready');
        const imagesDir = path.join(__dirname, 'golf_content', date, 'images');
        
        try {
            // 删除markdown文件
            if (fs.existsSync(articlePath)) {
                fs.unlinkSync(articlePath);
            }
            
            // 删除对应的wechat_html文件
            const wechatHtmlFile = articleFile.replace('.md', '.html').replace('article_', 'wechat_article_');
            const wechatHtmlPath = path.join(wechatHtmlDir, wechatHtmlFile);
            if (fs.existsSync(wechatHtmlPath)) {
                fs.unlinkSync(wechatHtmlPath);
            }
            
            // 删除对应的wechat_ready文件
            const wechatReadyFile = articleFile.replace('article_', 'wechat_article_');
            const wechatReadyPath = path.join(wechatReadyDir, wechatReadyFile);
            if (fs.existsSync(wechatReadyPath)) {
                fs.unlinkSync(wechatReadyPath);
            }
            
            // 删除相关的图片文件
            const articleNumber = articleFile.match(/\d+/)?.[0];
            if (articleNumber && fs.existsSync(imagesDir)) {
                const images = fs.readdirSync(imagesDir);
                images.forEach(img => {
                    if (img.includes(`article_${articleNumber}_img_`)) {
                        fs.unlinkSync(path.join(imagesDir, img));
                    }
                });
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        
    } else if (req.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
        // 处理图片请求
        const imagePath = path.join(__dirname, req.url.substring(1));
        if (fs.existsSync(imagePath)) {
            const ext = path.extname(imagePath).toLowerCase();
            const contentType = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif'
            }[ext];
            
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(imagePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('图片未找到');
        }
    } else {
        res.writeHead(404);
        res.end('页面未找到');
    }
});

server.listen(PORT, () => {
    console.log(`
🎉 高尔夫文章管理系统已启动！
📱 请在浏览器中访问: http://localhost:${PORT}
🔍 支持搜索、查看、删除功能
📌 按 Ctrl+C 停止服务器
    `);
});