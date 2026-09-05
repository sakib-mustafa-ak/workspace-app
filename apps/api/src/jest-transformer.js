const ts = require('typescript');
const crypto = require('crypto');

const COMPILER_OPTIONS = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  isolatedModules: true,
  sourceMap: true,
  inlineSources: true,
};

module.exports = {
  process(sourceText, fileName) {
    const { outputText, sourceMapText } = ts.transpileModule(sourceText, {
      fileName,
      reportDiagnostics: false,
      compilerOptions: COMPILER_OPTIONS,
    });
    return { code: outputText, map: sourceMapText || null };
  },

  getCacheKey(sourceText, fileName, jestConfig, transformOptions) {
    return crypto
      .createHash('sha1')
      .update(CACHE_KEY_SEPARATOR)
      .update(sourceText)
      .update(CACHE_KEY_SEPARATOR)
      .update(fileName)
      .update(CACHE_KEY_SEPARATOR)
      .update(JSON.stringify(COMPILER_OPTIONS))
      .digest('hex')
      .slice(0, 32);
  },
};

const CACHE_KEY_SEPARATOR = '\0';