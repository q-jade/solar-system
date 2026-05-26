const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
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
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/textures'),
          to: path.resolve(__dirname, 'dist/textures'),
          noErrorOnMissing: true,
        },
        {
          from: path.resolve(__dirname, 'src/favicon.svg'),
          to: path.resolve(__dirname, 'dist/favicon.svg'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  devServer: {
    static: [
      './dist',
      { directory: path.resolve(__dirname, 'src/textures'), publicPath: '/textures', serveIndex: false },
    ],
    open: true,
    hot: true,
  },
  performance: {
    hints: false,
  },
};