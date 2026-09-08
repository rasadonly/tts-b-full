/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node', 'phonemizer', '@huggingface/transformers'],
    outputFileTracingIncludes: {
      '/api/tts': ['./models/**/*'],
    },
    outputFileTracingExcludes: {
      '/api/tts': [
        './node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*',
        './node_modules/onnxruntime-node/bin/napi-v6/win32/**/*',
      ],
    },
  },
};

module.exports = nextConfig;
