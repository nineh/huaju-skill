/* 排版引擎 Worker：在浏览器里运行 Python 排版代码，文件不离开本机 */
let pyodide = null;
const ROOT = '/home/pyodide/app';

function post(type, data) { self.postMessage(Object.assign({ type }, data || {})); }

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function init(base, bundleUrl, pkgBundleUrl) {
  post('progress', { text: '正在加载运行环境…', pct: 10 });
  importScripts(base + 'pyodide.js');
  if (pkgBundleUrl) {
    // 运行库打包在一个 JSON 里（用于不能直接提供 .zip/.whl 文件的托管环境）
    const pk = await (await fetch(pkgBundleUrl)).json();
    post('progress', { text: '正在启动运行环境…', pct: 40 });
    const stdLibURL = URL.createObjectURL(new Blob([b64ToBytes(pk.stdlib)]));
    pyodide = await loadPyodide({ indexURL: base, stdLibURL: stdLibURL });
    post('progress', { text: '正在加载文档组件…', pct: 60 });
    const site = pyodide.runPython('import site; site.getsitepackages()[0]');
    for (const whl of pk.wheels) pyodide.unpackArchive(b64ToBytes(whl), 'zip', { extractDir: site });
    pyodide.runPython('import importlib; importlib.invalidate_caches()');
  } else {
    pyodide = await loadPyodide({ indexURL: base });
    post('progress', { text: '正在加载文档组件…', pct: 55 });
    await pyodide.loadPackage(['lxml', 'typing-extensions']);
  }
  post('progress', { text: '正在加载排版引擎…', pct: 80 });
  const res = await fetch(bundleUrl);
  if (!res.ok) throw new Error('排版引擎文件加载失败');
  const bundle = await res.json();
  const FS = pyodide.FS;
  for (const [path, item] of Object.entries(bundle)) {
    const full = ROOT + '/' + path;
    FS.mkdirTree(full.slice(0, full.lastIndexOf('/')));
    if ('t' in item) FS.writeFile(full, item.t, { encoding: 'utf8' });
    else FS.writeFile(full, b64ToBytes(item.b));
  }
  pyodide.runPython(`import sys\nsys.path.insert(0, ${JSON.stringify(ROOT)})\nfrom scripts import webapi`);
  post('ready');
}

function writeIn(name, buf) {
  pyodide.FS.writeFile('/tmp/' + name, new Uint8Array(buf));
  return '/tmp/' + name;
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.cmd === 'init') {
      await init(m.base, m.bundleUrl, m.pkgBundleUrl);
      return;
    }
    const webapi = pyodide.globals.get('webapi');
    if (m.cmd === 'inspect') {
      const p = writeIn('ref.docx', m.reference);
      post('inspected', { id: m.id, summary: webapi.inspect_reference(p) });
    } else if (m.cmd === 'preset') {
      post('preset', { id: m.id, preset: webapi.preset_json(m.name) });
    } else if (m.cmd === 'refpreset') {
      const p = writeIn('ref.docx', m.reference);
      post('preset', { id: m.id, preset: webapi.reference_preset(p) });
    } else if (m.cmd === 'analyze') {
      const p = writeIn('in.docx', m.input);
      post('analyzed', { id: m.id, report: webapi.analyze(p) });
    } else if (m.cmd === 'run') {
      const inPath = writeIn('in.docx', m.input);
      const opts = Object.assign({}, m.opts);
      if (m.reference) opts.reference_path = writeIn('ref.docx', m.reference);
      const out = '/tmp/out.docx';
      const result = JSON.parse(webapi.run(m.mode, inPath, out, JSON.stringify(opts)));
      const bytes = pyodide.FS.readFile(out);
      post('done', { id: m.id, result, file: bytes.buffer }, );
    }
  } catch (err) {
    let msg = String(err && err.message || err);
    const last = msg.trim().split('\n').pop();
    post('error', { id: m.id, message: last || msg });
  }
};
