/**
 * 生成包含完整功能的HTML文件
 * 包括：复制全文、仅复制文字、图片点击复制等功能
 */

function generateCompleteHTML(title, content) {
    // 处理Markdown内容转换为HTML
    let htmlContent = content
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$2</h2>')
        .replace(/^### (.+)$/gm, '<h3>$3</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^/, '<p>').replace(/$/, '</p>');
    
    // 处理图片，添加点击复制功能
    let imageCounter = 1;
    htmlContent = htmlContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        const caption = alt || `图片${imageCounter}`;
        imageCounter++;
        return `<div class="image-container">
                    <img src="${src}" alt="${caption}" class="article-image" onclick="copyImage(this)">
                    <p class="image-caption">${caption}</p>
                </div>`;
    });
    
    // 完整的HTML模板
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.8;
            background: white;
            color: #333;
        }
        
        h1 {
            font-size: 1.8rem;
            font-weight: bold;
            margin: 0 0 30px 0;
            color: #333;
            text-align: center;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 20px;
        }
        
        h2 {
            font-size: 1.3rem;
            color: #444;
            margin: 30px 0 15px 0;
            font-weight: 600;
        }
        
        h3 {
            font-size: 1.1rem;
            color: #555;
            margin: 25px 0 10px 0;
            font-weight: 600;
        }
        
        p {
            margin: 15px 0;
            font-size: 16px;
            line-height: 1.8;
        }
        
        strong {
            color: #d32f2f;
            font-weight: 600;
        }
        
        .image-container {
            margin: 30px 0;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .image-container:hover {
            transform: translateY(-2px);
        }
        
        .article-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        
        .article-image:hover {
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .image-caption {
            margin: 15px 0 0 0;
            font-size: 14px;
            color: #666;
            font-style: italic;
            text-align: center;
        }
        
        .toolbar {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        
        .btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin: 0 5px;
            transition: background 0.3s ease;
        }
        
        .btn:hover {
            background: #1565c0;
        }
        
        .copy-success {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4caf50;
            color: white;
            padding: 12px 24px;
            border-radius: 5px;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1001;
            font-weight: bold;
        }
        
        .copy-success.show {
            opacity: 1;
        }
        
        @media (max-width: 600px) {
            body {
                padding: 15px;
                font-size: 15px;
            }
            
            h1 {
                font-size: 1.5rem;
            }
            
            .toolbar {
                position: relative;
                top: auto;
                right: auto;
                margin-bottom: 20px;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button class="btn" onclick="copyAllContent()">📋 复制全文</button>
        <button class="btn" onclick="copyOnlyText()">📝 仅复制文字</button>
    </div>
    
    ${htmlContent}
    
    <div class="copy-success" id="copySuccess">✅ 已复制到剪贴板！</div>
    
    <script>
        // 复制图片功能
        async function copyImage(img) {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showCopySuccess('图片已复制！');
                    } catch (err) {
                        fallbackCopyImage(img);
                    }
                }, 'image/png');
                
            } catch (err) {
                fallbackCopyImage(img);
            }
        }
        
        // 备用复制方法
        function fallbackCopyImage(img) {
            const range = document.createRange();
            range.selectNode(img);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            
            try {
                document.execCommand('copy');
                showCopySuccess('图片已复制！');
            } catch (err) {
                alert('复制失败，请右键选择"复制图像"');
            }
            
            window.getSelection().removeAllRanges();
        }
        
        // 复制全部内容（包含图片）
        function copyAllContent() {
            const bodyContent = document.body.innerHTML;
            const textContent = document.body.innerText;
            
            // 尝试复制富文本
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([bodyContent], { type: 'text/html' }),
                    'text/plain': new Blob([textContent], { type: 'text/plain' })
                });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess('全文已复制！（包含格式）');
                });
            } catch (err) {
                // 备用方法：复制纯文本
                copyOnlyText();
            }
        }
        
        // 复制纯文字内容
        function copyOnlyText() {
            let textContent = document.body.innerText;
            
            // 清理文本内容
            textContent = textContent
                .replace(/📋 复制全文\\s*📝 仅复制文字/g, '')
                .replace(/✅ 已复制到剪贴板！/g, '')
                .replace(/\\n{3,}/g, '\\n\\n')
                .trim();
            
            navigator.clipboard.writeText(textContent).then(() => {
                showCopySuccess('文字内容已复制！');
            }).catch(() => {
                // 备用方法
                const textarea = document.createElement('textarea');
                textarea.value = textContent;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showCopySuccess('文字内容已复制！');
            });
        }
        
        // 显示复制成功提示
        function showCopySuccess(message) {
            const successDiv = document.getElementById('copySuccess');
            successDiv.textContent = message;
            successDiv.classList.add('show');
            
            setTimeout(() => {
                successDiv.classList.remove('show');
            }, 2000);
        }
        
        // 图片加载错误处理
        document.querySelectorAll('.article-image').forEach(img => {
            img.onerror = function() {
                this.style.display = 'none';
                this.parentElement.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">图片加载失败</p>';
            };
        });
    </script>
</body>
</html>`;
}

// 导出函数
module.exports = generateCompleteHTML;

// 如果直接运行此文件，可以测试
if (require.main === module) {
    const testTitle = "测试文章标题";
    const testContent = `# 测试文章标题

这是第一段内容，包含**加粗文字**。

![测试图片1](../images/test1.jpg)

## 第二个标题

这是第二段内容。

![测试图片2](../images/test2.jpg)

### 第三级标题

最后一段内容。`;

    const html = generateCompleteHTML(testTitle, testContent);
    console.log(html);
}