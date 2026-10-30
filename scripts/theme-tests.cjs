const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
    return dependencies[id];
  } });
  return exports;
}
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v,16)/255)
    .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
function contrast(a,b) { const [hi,lo]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05); }
test('Both brand palettes preserve readable body text, muted text and primary actions', () => {
  const {lightColors,darkColors}=load('apps/mobile/src/theme/colors.ts');
  for(const palette of [lightColors,darkColors]) {
    for(const surface of ['background','card','backgroundSecondary'])
      for(const text of ['foreground','foregroundMuted'])
        assert.ok(contrast(palette[text],palette[surface])>=4.5,`${text} on ${surface}`);
    assert.ok(contrast(palette.onPrimary,palette.primary500)>=4.5);
    assert.ok(contrast(palette.onPrimary,palette.gradientTo)>=4.5);
  }
});
function appearance(storage) {
  return load('apps/mobile/src/theme/appearance.ts', {
    react: {},
    '@react-native-async-storage/async-storage': {default:storage},
    zustand: {create: initializer=> {
      let state; const set=update=>{state={...state,...update};};
      state=initializer(set);return {getState:()=>state};
    }},
  }).useAppearance;
}
test('Restores the saved mode and tolerates unavailable storage',async()=>{
  const saved=appearance({getItem:async()=> 'dark'});await saved.getState().hydrate();assert.equal(saved.getState().mode,'dark');
  const failed=appearance({getItem:async()=>{throw Error('unavailable');}});await failed.getState().hydrate();assert.equal(failed.getState().mode,'light');
});
test('A user selection wins over delayed hydration and rapid selections persist in order',async()=>{
  let resolveRead;const writes=[];
  const store=appearance({getItem:()=>new Promise(resolve=>{resolveRead=resolve;}),setItem:async(key,value)=>{writes.push(value);}});
  const hydrate=store.getState().hydrate();store.getState().setMode('dark');store.getState().setMode('light');resolveRead('dark');await hydrate;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(store.getState().mode,'light');assert.deepEqual(writes,['dark','light']);
});
