// 最简单的直接测试
module.exports = (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>直接测试</title>
</head>
<body>
    <h1>这是来自Vercel函数的直接响应！</h1>
    <p>时间: ${new Date().toISOString()}</p>
    <p>请求路径: ${req.url}</p>
</body>
</html>
    `);
};