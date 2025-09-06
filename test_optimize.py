# 需要优化的Python代码示例
import time
import requests

def process_golf_articles(urls):
    """处理高尔夫文章URL列表"""
    results = []
    for url in urls:
        try:
            # 逐个请求URL
            response = requests.get(url)
            if response.status_code == 200:
                content = response.text
                # 简单处理
                title = extract_title(content)
                body = extract_body(content)
                results.append({
                    'url': url,
                    'title': title,
                    'body': body,
                    'success': True
                })
            else:
                results.append({
                    'url': url,
                    'success': False,
                    'error': f'Status code: {response.status_code}'
                })
        except Exception as e:
            results.append({
                'url': url,
                'success': False,
                'error': str(e)
            })
        time.sleep(1)  # 避免过快请求
    return results

def extract_title(html):
    # 简单的标题提取
    start = html.find('<title>')
    end = html.find('</title>')
    if start != -1 and end != -1:
        return html[start+7:end]
    return 'No title'

def extract_body(html):
    # 简单的正文提取
    start = html.find('<body>')
    end = html.find('</body>')
    if start != -1 and end != -1:
        return html[start+6:end][:500]  # 只取前500字符
    return 'No body'

# 使用示例
if __name__ == '__main__':
    test_urls = [
        'https://golf.com/news/article1',
        'https://golf.com/news/article2',
        'https://golf.com/news/article3'
    ]
    results = process_golf_articles(test_urls)
    print(f"处理了 {len(results)} 篇文章")