// enhanced_html_template.js - 增强版HTML模板（包含Base64图片转换和微信优化）

function generateEnhancedHTML(title, htmlContent) {
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
            font-size: 15px;
        }
        
        h1 {
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
            color: #333;
            text-align: center;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 20px;
        }
        
        h2 {
            font-size: 18px;
            color: #444;
            margin: 20px 0 15px 0;
            font-weight: bold;
        }
        
        h3 {
            font-size: 16px;
            color: #555;
            margin: 18px 0 10px 0;
            font-weight: bold;
        }
        
        p {
            margin: 15px 0;
            font-size: 15px;
            line-height: 1.8;
        }
        
        strong {
            color: #d32f2f;
            font-weight: 600;
        }
        
        .image-container {
            margin: 30px 0;
            text-align: center;
        }
        
        .article-image {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .article-image:hover {
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            transform: translateY(-2px);
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
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 180px;
        }
        
        .btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 13px;
            margin-bottom: 8px;
            transition: all 0.3s ease;
            display: block;
            width: 100%;
            text-align: center;
        }
        
        .btn:hover {
            background: #1565c0;
            transform: translateY(-1px);
        }
        
        .btn.wechat {
            background: #07c160;
            font-weight: bold;
        }
        
        .btn.wechat:hover {
            background: #06ad56;
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
            }
            
            .toolbar {
                position: relative;
                top: auto;
                right: auto;
                margin-bottom: 20px;
                min-width: auto;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button class="btn wechat" onclick="copyForWechat()">🚀 复制到微信公众号</button>
    </div>
    
    ${htmlContent}
    
    <div class="copy-success" id="copySuccess">✅ 已复制到剪贴板！</div>
    
    <script>
        // Base64转换函数
        async function convertImageToBase64(img) {
            return new Promise((resolve) => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const image = new Image();
                    
                    image.crossOrigin = 'anonymous';
                    
                    image.onload = function() {
                        try {
                            // 计算优化后的尺寸
                            let width = this.naturalWidth;
                            let height = this.naturalHeight;
                            const maxWidth = 800;
                            
                            if (width > maxWidth) {
                                const ratio = height / width;
                                width = maxWidth;
                                height = Math.round(width * ratio);
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(this, 0, 0, width, height);
                            
                            // 转换为JPEG格式，质量0.8
                            const base64 = canvas.toDataURL('image/jpeg', 0.8);
                            console.log('图片转换成功，Base64大小: ' + Math.round(base64.length / 1024) + 'KB');
                            resolve(base64);
                        } catch (e) {
                            console.log('Canvas转换失败:', e);
                            resolve(null);
                        }
                    };
                    
                    image.onerror = function(e) {
                        console.log('图片加载失败:', e);
                        resolve(null);
                    };
                    
                    // 处理图片路径
                    let imageSrc = img.src;
                    if (imageSrc.startsWith('/')) {
                        imageSrc = window.location.origin + imageSrc;
                    }
                    
                    image.src = imageSrc;
                    
                    // 设置超时
                    setTimeout(() => {
                        if (image.complete === false) {
                            console.log('图片加载超时');
                            resolve(null);
                        }
                    }, 5000); // 5秒超时
                    
                } catch (error) {
                    console.log('Base64转换初始化错误:', error);
                    resolve(null);
                }
            });
        }
        
        // 专为微信公众号优化的复制功能（包含Base64图片内嵌）
        async function copyForWechat() {
            const tempDiv = document.createElement('div');
            tempDiv.style.fontSize = '15px';
            tempDiv.style.lineHeight = '1.8';
            tempDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
            
            // 克隆内容并移除工具栏
            const contentElements = document.body.cloneNode(true);
            const toolbar = contentElements.querySelector('.toolbar');
            if (toolbar) toolbar.remove();
            const copySuccess = contentElements.querySelector('.copy-success');
            if (copySuccess) copySuccess.remove();
            
            // 移除质量评分卡片
            // 查找并删除包含"文章质量评分"的div容器
            const qualityScoreCard = contentElements.querySelector('div[style*="background: #f5f5f5"][style*="border-radius: 8px"]');
            if (qualityScoreCard && qualityScoreCard.innerHTML.includes('文章质量评分')) {
                qualityScoreCard.remove();
            }
            
            // 备用方案：通过文本内容查找
            contentElements.querySelectorAll('div').forEach(div => {
                if (div.textContent.includes('文章质量评分：') && 
                    div.textContent.includes('文章长度') && 
                    div.textContent.includes('图片数量') &&
                    div.textContent.includes('文章结构')) {
                    div.remove();
                }
            });
            
            // 设置微信公众号专用样式
            contentElements.querySelectorAll('p').forEach(p => {
                p.style.fontSize = '15px';
                p.style.lineHeight = '1.8';
                p.style.margin = '15px 0';
            });
            
            contentElements.querySelectorAll('h1').forEach(h => {
                h.style.fontSize = '20px';
                h.style.fontWeight = 'bold';
                h.style.textAlign = 'center';
                h.style.margin = '20px 0';
            });
            
            contentElements.querySelectorAll('h2').forEach(h => {
                h.style.fontSize = '18px';
                h.style.fontWeight = 'bold';
                h.style.margin = '20px 0 15px 0';
            });
            
            // 转换所有图片为Base64
            const images = contentElements.querySelectorAll('img');
            console.log('检测到 ' + images.length + ' 张图片，开始转换为Base64...');
            
            let convertedCount = 0;
            for (const img of images) {
                if (!img.closest('.toolbar')) {
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.margin = '20px auto';
                    
                    try {
                        const base64Data = await convertImageToBase64(img);
                        if (base64Data) {
                            img.src = base64Data;
                            convertedCount++;
                            console.log('✅ 第 ' + convertedCount + ' 张图片Base64转换成功');
                        } else {
                            console.log('⚠️ 图片Base64转换失败，移除该图片');
                            // 如果转换失败，完全移除图片元素
                            const container = img.closest('.image-container');
                            if (container) {
                                container.remove();
                            } else {
                                img.remove();
                            }
                        }
                    } catch (error) {
                        console.log('❌ 图片处理出错:', error);
                        // 出错时也移除图片
                        const container = img.closest('.image-container');
                        if (container) {
                            container.remove();
                        } else {
                            img.remove();
                        }
                    }
                }
            }
            
            tempDiv.innerHTML = contentElements.innerHTML;
            
            // 额外的图片验证 - 确保没有损坏的图片
            tempDiv.querySelectorAll('img').forEach(img => {
                // 移除所有非Base64且非完整HTTP路径的图片
                if (img.src && !img.src.startsWith('data:image') && !img.src.includes('://')) {
                    const container = img.closest('.image-container');
                    if (container) {
                        container.remove();
                    } else {
                        img.remove();
                    }
                }
            });
            
            // 移除空的图片容器
            tempDiv.querySelectorAll('.image-container').forEach(container => {
                if (!container.querySelector('img')) {
                    container.remove();
                }
            });
            
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([tempDiv.innerHTML], { type: 'text/html' }),
                    'text/plain': new Blob([tempDiv.innerText], { type: 'text/plain' })
                });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess('✅ 已复制！' + (convertedCount > 0 ? '已内嵌' + convertedCount + '张Base64图片，' : '') + '可直接粘贴到微信公众号');
                });
            } catch (err) {
                // 备用方案：复制纯文本
                let textContent = document.body.innerText;
                textContent = textContent
                    .replace(/🚀 复制到微信公众号/g, '')
                    .replace(/✅ 已复制到剪贴板！/g, '')
                    .replace(/\\n{3,}/g, '\\n\\n')
                    .trim();
                
                navigator.clipboard.writeText(textContent).then(() => {
                    showCopySuccess('已复制文字内容！');
                }).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = textContent;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showCopySuccess('已复制文字内容！');
                });
            }
        }
        
        
        
        function copyImage(img) {
            // 图片复制功能保持原有逻辑
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
        
        function showCopySuccess(message) {
            const successDiv = document.getElementById('copySuccess');
            successDiv.textContent = message;
            successDiv.classList.add('show');
            
            setTimeout(() => {
                successDiv.classList.remove('show');
            }, 3000);
        }
    </script>
</body>
</html>`;
}

module.exports = generateEnhancedHTML;