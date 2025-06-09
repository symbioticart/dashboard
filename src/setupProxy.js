const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/v2',
    createProxyMiddleware({
      target: 'https://api.ouraring.com/v2',
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        console.log('Sending Request to Target:', proxyReq.method, proxyReq.path);
        // console.log('Request Headers:', proxyReq.getHeaders()); // Можно раскомментировать для детального логирования заголовков
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Received Response from Target:', proxyRes.statusCode, proxyRes.statusMessage);
        // console.log('Response Headers:', proxyRes.headers); // Можно раскомментировать для детального логирования заголовков
      },
    })
  );
}; 