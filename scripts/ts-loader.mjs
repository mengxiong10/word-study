import ts from 'typescript';
import { readFile, access } from 'node:fs/promises';
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const u = new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
      if (!u.pathname.endsWith('.json'))
        try {
          const target = new URL(u.href + suffix);
          if (/\.tsx?$/.test(target.pathname)) {
            await access(target);
            return { url: target.href, shortCircuit: true };
          }
        } catch {
          // 当前候选路径不存在，继续尝试下一个扩展名。
        }
    }
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (/\.tsx?$/.test(url))
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(await readFile(new URL(url), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  if (url.endsWith('.json'))
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${await readFile(new URL(url), 'utf8')};`,
    };
  return nextLoad(url, context);
}
