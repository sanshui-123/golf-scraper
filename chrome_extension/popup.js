document.getElementById('scrapeBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'scrapeURLs' }, (response) => {
    if (response && response.urls) {
      displayResults(response.urls);
      // 保存到storage
      chrome.storage.local.set({ 'mygolfspy_urls': response.urls });
    }
  });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  chrome.storage.local.get(['mygolfspy_urls'], (result) => {
    if (result.mygolfspy_urls) {
      downloadJSON(result.mygolfspy_urls, 'mygolfspy_urls.json');
    }
  });
});

document.getElementById('saveBtn').addEventListener('click', () => {
  chrome.storage.local.get(['mygolfspy_urls'], (result) => {
    if (result.mygolfspy_urls) {
      // 格式化为处理队列格式
      const urlList = result.mygolfspy_urls.map(item => item.url).join('\n');
      
      // 创建处理队列文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `mygolfspy_queue_${timestamp}.txt`;
      
      downloadText(urlList, filename);
      
      // 显示保存成功消息
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = `<div style="color: green; font-weight: bold;">已保存 ${result.mygolfspy_urls.length} 个URL到处理队列文件: ${filename}</div>`;
    }
  });
});

function displayResults(urls) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<div class="count">找到 ${urls.length} 个链接:</div>`;
  
  urls.forEach((url, index) => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';
    urlItem.innerHTML = `
      <div class="url-title">${index + 1}. ${url.title}</div>
      <div class="url-link">${url.url}</div>
      <div class="url-link">分类: ${url.category}</div>
    `;
    resultsDiv.appendChild(urlItem);
  });
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 页面加载时显示之前保存的结果
chrome.storage.local.get(['mygolfspy_urls'], (result) => {
  if (result.mygolfspy_urls) {
    displayResults(result.mygolfspy_urls);
  }
});