const http = require('http');

// 测试服务器响应
const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/health',
    method: 'GET',
    timeout: 5000
};

const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('响应内容:', data);
    });
});

req.on('error', (error) => {
    console.error('请求错误:', error);
});

req.on('timeout', () => {
    console.error('请求超时');
    req.destroy();
});

req.end();