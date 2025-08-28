// 测试API端点，确认Vercel函数是否正常工作
module.exports = (req, res) => {
    res.json({
        message: "API正在工作！",
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        headers: req.headers
    });
};