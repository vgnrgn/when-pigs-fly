const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    
    return {
        mode: isProduction ? 'production' : 'development',
        entry: './src/index.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: '[name].[contenthash].js',
            clean: true, // Clean the output directory before emit
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env']
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.(png|jpg|jpeg|gif|svg)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'images/[hash][ext][query]'
                    }
                },
                {
                    test: /\.(glb|gltf)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'models/[hash][ext][query]'
                    }
                },
                {
                    test: /\.(mp3|wav|ogg)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'sounds/[hash][ext][query]'
                    }
                }
            ]
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './src/index.html',
                minify: isProduction ? {
                    removeComments: true,
                    collapseWhitespace: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    keepClosingSlash: true,
                    minifyJS: true,
                    minifyCSS: true,
                    minifyURLs: true,
                } : false
            }),
            new CopyWebpackPlugin({
                patterns: [
                    { 
                        from: 'public', 
                        to: '',
                        globOptions: {
                            ignore: ['**/index.html']
                        }
                    }
                ]
            })
        ],
        resolve: {
            extensions: ['.js'],
            fallback: {
                "fs": false,
                "path": require.resolve("path-browserify"),
                "crypto": false,
                "stream": false,
                "buffer": false
            }
        },
        optimization: {
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        format: {
                            comments: false,
                        },
                        compress: {
                            drop_console: isProduction,
                        },
                    },
                    extractComments: false,
                }),
            ],
            splitChunks: false
        },
        devServer: {
            static: {
                directory: path.join(__dirname, 'public'),
            },
            compress: true,
            port: 3001,
            hot: true,
            open: true,
            historyApiFallback: true
        },
        devtool: isProduction ? false : 'source-map',
        performance: {
            hints: isProduction ? 'warning' : false,
            maxEntrypointSize: 512000,
            maxAssetSize: 512000
        }
    };
}; 