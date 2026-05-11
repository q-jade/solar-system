const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/js/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
  ],
  devServer: {
    static: './dist',
    open: true,
    hot: true,
    proxy: [
      {
        context: ['/texture-proxy'],
        target: 'https://www.solarsystemscope.com',
        pathRewrite: { '^/texture-proxy': '/textures/download' },
        changeOrigin: true,
        onProxyRes(proxyRes) {
          // CDN returns text/html for images; fix it
          const url = proxyRes.req.path;
          if (url.endsWith('.jpg') || url.endsWith('.jpeg')) {
            proxyRes.headers['content-type'] = 'image/jpeg';
          } else if (url.endsWith('.png')) {
            proxyRes.headers['content-type'] = 'image/png';
          }
        },
      },
    ],
  },
  performance: {
    hints: false,
  },
};