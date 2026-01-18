// include: shell.js
// include: minimum_runtime_check.js
(function () {
  // "30.0.0" -> 300000
  function humanReadableVersionToPacked (str) {
    str = str.split('-')[0] // Remove any trailing part from e.g. "12.53.3-alpha"
    let vers = str.split('.').slice(0, 3)
    while (vers.length < 3) vers.push('00')
    vers = vers.map((n, i, arr) => n.padStart(2, '0'))
    return vers.join('')
  }
  // 300000 -> "30.0.0"
  const packedVersionToHumanReadable = (n) =>
    [(n / 10000) | 0, ((n / 100) | 0) % 100, n % 100].join('.')

  const TARGET_NOT_SUPPORTED = 2147483647

  // Note: We use a typeof check here instead of optional chaining using
  // globalThis because older browsers might not have globalThis defined.
  const currentNodeVersion =
    typeof process !== 'undefined' && process.versions?.node
      ? humanReadableVersionToPacked(process.versions.node)
      : TARGET_NOT_SUPPORTED
  if (currentNodeVersion < 160000) {
    throw new Error(
      `This emscripten-generated code requires node v${packedVersionToHumanReadable(160000)} (detected v${packedVersionToHumanReadable(currentNodeVersion)})`
    )
  }

  const userAgent = typeof navigator !== 'undefined' && navigator.userAgent
  if (!userAgent) {
    return
  }

  const currentSafariVersion =
    userAgent.includes('Safari/') &&
    !userAgent.includes('Chrome/') &&
    userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/)
      ? humanReadableVersionToPacked(
        userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/)[1]
      )
      : TARGET_NOT_SUPPORTED
  if (currentSafariVersion < 150000) {
    throw new Error(
      `This emscripten-generated code requires Safari v${packedVersionToHumanReadable(150000)} (detected v${currentSafariVersion})`
    )
  }

  const currentFirefoxVersion = userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/)
    ? parseFloat(userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/)[1])
    : TARGET_NOT_SUPPORTED
  if (currentFirefoxVersion < 79) {
    throw new Error(
      `This emscripten-generated code requires Firefox v79 (detected v${currentFirefoxVersion})`
    )
  }

  const currentChromeVersion = userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/)
    ? parseFloat(userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/)[1])
    : TARGET_NOT_SUPPORTED
  if (currentChromeVersion < 85) {
    throw new Error(
      `This emscripten-generated code requires Chrome v85 (detected v${currentChromeVersion})`
    )
  }
})()

// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {}

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
const ENVIRONMENT_IS_WEB = !!globalThis.window
const ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
const ENVIRONMENT_IS_NODE =
  globalThis.process?.versions?.node && globalThis.process?.type != 'renderer'
const ENVIRONMENT_IS_SHELL =
  !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)

let arguments_ = []
let thisProgram = './this.program'
let quit_ = (status, toThrow) => {
  throw toThrow
}

// In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
let _scriptName = globalThis.document?.currentScript?.src

if (typeof __filename !== 'undefined') {
  // Node
  _scriptName = __filename
} else if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href
}

// `/` should be present at the end if `scriptDirectory` is not empty
let scriptDirectory = ''
function locateFile (path) {
  if (Module.locateFile) {
    return Module.locateFile(path, scriptDirectory)
  }
  return scriptDirectory + path
}

// Hooks that are implemented differently in different runtime environments.
let readAsync, readBinary

if (ENVIRONMENT_IS_NODE) {
  const isNode =
    globalThis.process?.versions?.node &&
    globalThis.process?.type != 'renderer'
  if (!isNode) {
    throw new Error(
      'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
    )
  }

  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  const fs = require('fs')

  scriptDirectory = __dirname + '/'

  // include: node_shell_read.js
  readBinary = (filename) => {
    // We need to re-wrap `file://` strings to URLs.
    filename = isFileURI(filename) ? new URL(filename) : filename
    const ret = fs.readFileSync(filename)
    assert(Buffer.isBuffer(ret))
    return ret
  }

  readAsync = async (filename, binary = true) => {
    // See the comment in the `readBinary` function.
    filename = isFileURI(filename) ? new URL(filename) : filename
    const ret = fs.readFileSync(filename, binary ? undefined : 'utf8')
    assert(binary ? Buffer.isBuffer(ret) : typeof ret === 'string')
    return ret
  }
  // end include: node_shell_read.js
  if (process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, '/')
  }

  arguments_ = process.argv.slice(2)

  // MODULARIZE will export the module in the proper place outside, we don't need to export here
  if (typeof module !== 'undefined') {
    module.exports = Module
  }

  quit_ = (status, toThrow) => {
    process.exitCode = status
    throw toThrow
  }
} else if (ENVIRONMENT_IS_SHELL) {
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  // Note that this includes Node.js workers when relevant (pthreads is enabled).
  // Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
  // ENVIRONMENT_IS_NODE.
  try {
    scriptDirectory = new URL('.', _scriptName).href // includes trailing slash
  } catch {
    // Must be a `blob:` or `data:` URL (e.g. `blob:http://site.com/etc/etc`), we cannot
    // infer anything from them.
  }

  if (!(globalThis.window || globalThis.WorkerGlobalScope)) {
    throw new Error(
      'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
    )
  }

  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = (url) => {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', url, false)
        xhr.responseType = 'arraybuffer'
        xhr.send(null)
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response))
      }
    }

    readAsync = async (url) => {
      // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
      // See https://github.com/github/fetch/pull/92#issuecomment-140665932
      // Cordova or Electron apps are typically loaded from a file:// url.
      // So use XHR on webview if URL is a file URL.
      if (isFileURI(url)) {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('GET', url, true)
          xhr.responseType = 'arraybuffer'
          xhr.onload = () => {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              // file URLs can return 0
              resolve(xhr.response)
              return
            }
            reject(xhr.status)
          }
          xhr.onerror = reject
          xhr.send(null)
        })
      }
      const response = await fetch(url, { credentials: 'same-origin' })
      if (response.ok) {
        return response.arrayBuffer()
      }
      throw new Error(response.status + ' : ' + response.url)
    }
    // end include: web_or_worker_shell_read.js
  }
} else {
  throw new Error('environment detection error')
}

let out = console.log.bind(console)
let err = console.error.bind(console)

const IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js'
const PROXYFS =
  'PROXYFS is no longer included by default; build with -lproxyfs.js'
const WORKERFS =
  'WORKERFS is no longer included by default; build with -lworkerfs.js'
const FETCHFS =
  'FETCHFS is no longer included by default; build with -lfetchfs.js'
const ICASEFS =
  'ICASEFS is no longer included by default; build with -licasefs.js'
const JSFILEFS =
  'JSFILEFS is no longer included by default; build with -ljsfilefs.js'
const OPFS = 'OPFS is no longer included by default; build with -lopfs.js'

const NODEFS =
  'NODEFS is no longer included by default; build with -lnodefs.js'

// perform assertions in shell.js after we set up out() and err(), as otherwise
// if an assertion fails it cannot print the message

assert(
  !ENVIRONMENT_IS_SHELL,
  'shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable.'
)

// end include: shell.js

// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

let wasmBinary

if (!globalThis.WebAssembly) {
  err('no native wasm support detected')
}

// Wasm globals

//= =======================================
// Runtime essentials
//= =======================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
let ABORT = false

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code in shell environments
// but only when noExitRuntime is false.
let EXITSTATUS

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */
function assert (condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''))
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.
function _free () {
  // Show a helpful error since we used to include free by default in the past.
  abort(
    'free() called but not included in the build - add `_free` to EXPORTED_FUNCTIONS'
  )
}

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://')

// include: runtime_common.js
// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie () {
  let max = _emscripten_stack_get_end()
  assert((max & 3) == 0)
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[max >> 2] = 0x02135467
  HEAPU32[(max + 4) >> 2] = 0x89bacdfe
  // Also test the global address 0 for integrity.
  HEAPU32[0 >> 2] = 1668509029
}

function checkStackCookie () {
  if (ABORT) return
  let max = _emscripten_stack_get_end()
  // See writeStackCookie().
  if (max == 0) {
    max += 4
  }
  const cookie1 = HEAPU32[max >> 2]
  const cookie2 = HEAPU32[(max + 4) >> 2]
  if (cookie1 != 0x02135467 || cookie2 != 0x89bacdfe) {
    abort(
      `Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`
    )
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[0 >> 2] != 0x63736d65 /* 'emsc' */) {
    abort(
      'Runtime error: The application has corrupted its heap memory area (address zero)!'
    )
  }
}
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
const runtimeDebug = true // Switch to false at runtime to disable logging at the right times

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg (...args) {
  if (!runtimeDebug && typeof runtimeDebug !== 'undefined') return
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args)
}

// Endianness check
(() => {
  const h16 = new Int16Array(1)
  const h8 = new Int8Array(h16.buffer)
  h16[0] = 0x6373
  if (h8[0] !== 0x73 || h8[1] !== 0x63) {
    abort(
      'Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)'
    )
  }
})()

function consumedModuleProp (prop) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      set () {
        abort(
          `Attempt to set \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`
        )
      }
    })
  }
}

function makeInvalidEarlyAccess (name) {
  return () =>
    assert(
      false,
      `call to '${name}' via reference taken before Wasm module initialization`
    )
}

function ignoredModuleProp (prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(
      `\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`
    )
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem (name) {
  return (
    name === 'FS_createPath' ||
    name === 'FS_createDataFile' ||
    name === 'FS_createPreloadedFile' ||
    name === 'FS_preloadFile' ||
    name === 'FS_unlink' ||
    name === 'addRunDependency' ||
    // The old FS has some functionality that WasmFS lacks.
    name === 'FS_createLazyFile' ||
    name === 'FS_createDevice' ||
    name === 'removeRunDependency'
  )
}

/**
 * Intercept access to a symbols in the global symbol.  This enables us to give
 * informative warnings/errors when folks attempt to use symbols they did not
 * include in their build, or no symbols that no longer exist.
 *
 * We don't define this in MODULARIZE mode since in that mode emscripten symbols
 * are never placed in the global scope.
 */
function hookGlobalSymbolAccess (sym, func) {
  if (!Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get () {
        func()
        return undefined
      }
    })
  }
}

function missingGlobal (sym, msg) {
  hookGlobalSymbolAccess(sym, () => {
    warnOnce(`\`${sym}\` is no longer defined by emscripten. ${msg}`)
  })
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer')
missingGlobal('asm', 'Please use wasmExports instead')

function missingLibrarySymbol (sym) {
  hookGlobalSymbolAccess(sym, () => {
    // Can't `abort()` here because it would break code that does runtime
    // checks.  e.g. `if (typeof SDL === 'undefined')`.
    let msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`
    // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
    // library.js, which means $name for a JS name with no prefix, or name
    // for a JS name like _name.
    let librarySymbol = sym
    if (!librarySymbol.startsWith('_')) {
      librarySymbol = '$' + sym
    }
    msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`
    if (isExportedByForceFilesystem(sym)) {
      msg +=
        '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you'
    }
    warnOnce(msg)
  })

  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym)
}

function unexportedRuntimeSymbol (sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get () {
        let msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`
        if (isExportedByForceFilesystem(sym)) {
          msg +=
            '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you'
        }
        abort(msg)
      }
    })
  }
}

// end include: runtime_debug.js
// Memory management
let /** @type {!Int8Array} */
  HEAP8,
  /** @type {!Uint8Array} */
  HEAPU8,
  /** @type {!Int16Array} */
  HEAP16,
  /** @type {!Uint16Array} */
  HEAPU16,
  /** @type {!Int32Array} */
  HEAP32,
  /** @type {!Uint32Array} */
  HEAPU32,
  /** @type {!Float32Array} */
  HEAPF32,
  /** @type {!Float64Array} */
  HEAPF64

// BigInt64Array type is not correctly defined in closure
let /** not-@type {!BigInt64Array} */
  HEAP64,
  /* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */
  HEAPU64

let runtimeInitialized = false

function updateMemoryViews () {
  const b = wasmMemory.buffer
  HEAP8 = new Int8Array(b)
  HEAP16 = new Int16Array(b)
  HEAPU8 = new Uint8Array(b)
  HEAPU16 = new Uint16Array(b)
  HEAP32 = new Int32Array(b)
  HEAPU32 = new Uint32Array(b)
  HEAPF32 = new Float32Array(b)
  HEAPF64 = new Float64Array(b)
  HEAP64 = new BigInt64Array(b)
  HEAPU64 = new BigUint64Array(b)
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
assert(
  globalThis.Int32Array &&
    globalThis.Float64Array &&
    Int32Array.prototype.subarray &&
    Int32Array.prototype.set,
  'JS engine does not provide full typed array support'
)

function preRun () {
  if (Module.preRun) {
    if (typeof Module.preRun === 'function') {
      Module.preRun = [Module.preRun]
    }
    while (Module.preRun.length) {
      addOnPreRun(Module.preRun.shift())
    }
  }
  consumedModuleProp('preRun')
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns)
  // End ATPRERUNS hooks
}

function initRuntime () {
  assert(!runtimeInitialized)
  runtimeInitialized = true

  checkStackCookie()

  // No ATINITS hooks

  wasmExports.__wasm_call_ctors()

  // No ATPOSTCTORS hooks
}

function preMain () {
  checkStackCookie()
  // No ATMAINS hooks
}

function postRun () {
  checkStackCookie()
  // PThreads reuse the runtime from the main thread.

  if (Module.postRun) {
    if (typeof Module.postRun === 'function') {
      Module.postRun = [Module.postRun]
    }
    while (Module.postRun.length) {
      addOnPostRun(Module.postRun.shift())
    }
  }
  consumedModuleProp('postRun')

  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns)
  // End ATPOSTRUNS hooks
}

/** @param {string|number=} what */
function abort (what) {
  Module.onAbort?.(what)

  what = 'Aborted(' + what + ')'
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what)

  ABORT = true

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  const e = new WebAssembly.RuntimeError(what)

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e
}

// show errors on likely calls to FS when it was not included
var FS = {
  error () {
    abort(
      'Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM'
    )
  },
  init () {
    FS.error()
  },
  createDataFile () {
    FS.error()
  },
  createPreloadedFile () {
    FS.error()
  },
  createLazyFile () {
    FS.error()
  },
  open () {
    FS.error()
  },
  mkdev () {
    FS.error()
  },
  registerDevice () {
    FS.error()
  },
  analyzePath () {
    FS.error()
  },

  ErrnoError () {
    FS.error()
  }
}

function createExportWrapper (name, nargs) {
  return (...args) => {
    assert(
      runtimeInitialized,
      `native function \`${name}\` called before runtime initialization`
    )
    const f = wasmExports[name]
    assert(f, `exported native function \`${name}\` not found`)
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(
      args.length <= nargs,
      `native function \`${name}\` called with ${args.length} args but expects ${nargs}`
    )
    return f(...args)
  }
}

let wasmBinaryFile

function findWasmBinary () {
  return locateFile('a.out.wasm')
}

function getBinarySync (file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary)
  }
  if (readBinary) {
    return readBinary(file)
  }
  // Throwing a plain string here, even though it not normally advisable since
  // this gets turning into an `abort` in instantiateArrayBuffer.
  throw 'both async and sync fetching of the wasm failed'
}

async function getWasmBinary (binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      const response = await readAsync(binaryFile)
      return new Uint8Array(response)
    } catch {
      // Fall back to getBinarySync below;
    }
  }

  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile)
}

async function instantiateArrayBuffer (binaryFile, imports) {
  try {
    const binary = await getWasmBinary(binaryFile)
    const instance = await WebAssembly.instantiate(binary, imports)
    return instance
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`)

    // Warn on some common problems.
    if (isFileURI(binaryFile)) {
      err(
        `warning: Loading from a file URI (${binaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`
      )
    }
    abort(reason)
  }
}

async function instantiateAsync (binary, binaryFile, imports) {
  if (
    !binary &&
    // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
    !isFileURI(binaryFile) &&
    // Avoid instantiateStreaming() on Node.js environment for now, as while
    // Node.js v18.1.0 implements it, it does not have a full fetch()
    // implementation yet.
    //
    // Reference:
    //   https://github.com/emscripten-core/emscripten/pull/16917
    !ENVIRONMENT_IS_NODE
  ) {
    try {
      const response = fetch(binaryFile, { credentials: 'same-origin' })
      const instantiationResult = await WebAssembly.instantiateStreaming(
        response,
        imports
      )
      return instantiationResult
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`)
      err('falling back to ArrayBuffer instantiation')
      // fall back of instantiateArrayBuffer below
    }
  }
  return instantiateArrayBuffer(binaryFile, imports)
}

function getWasmImports () {
  // prepare imports
  const imports = {
    env: wasmImports,
    wasi_snapshot_preview1: wasmImports
  }
  return imports
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm () {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module */
  function receiveInstance (instance, module) {
    wasmExports = instance.exports

    assignWasmExports(wasmExports)

    updateMemoryViews()

    removeRunDependency('wasm-instantiate')
    return wasmExports
  }
  addRunDependency('wasm-instantiate')

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  let trueModule = Module
  function receiveInstantiationResult (result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(
      Module === trueModule,
      'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?'
    )
    trueModule = null
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    return receiveInstance(result.instance)
  }

  const info = getWasmImports()

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module.instantiateWasm) {
    return new Promise((resolve, reject) => {
      try {
        Module.instantiateWasm(info, (inst, mod) => {
          resolve(receiveInstance(inst, mod))
        })
      } catch (e) {
        err(`Module.instantiateWasm callback failed with error: ${e}`)
        reject(e)
      }
    })
  }

  wasmBinaryFile ??= findWasmBinary()
  const result = await instantiateAsync(wasmBinary, wasmBinaryFile, info)
  const exports = receiveInstantiationResult(result)
  return exports
}

// end include: preamble.js

// Begin JS library code

class ExitStatus {
  name = 'ExitStatus'
  constructor (status) {
    this.message = `Program terminated with exit(${status})`
    this.status = status
  }
}

var callRuntimeCallbacks = (callbacks) => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module)
  }
}
var onPostRuns = []
var addOnPostRun = (cb) => onPostRuns.push(cb)

var onPreRuns = []
var addOnPreRun = (cb) => onPreRuns.push(cb)

let runDependencies = 0

let dependenciesFulfilled = null

const runDependencyTracking = {}

let runDependencyWatcher = null
var removeRunDependency = (id) => {
  runDependencies--

  Module.monitorRunDependencies?.(runDependencies)

  assert(id, 'removeRunDependency requires an ID')
  assert(runDependencyTracking[id])
  delete runDependencyTracking[id]
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher)
      runDependencyWatcher = null
    }
    if (dependenciesFulfilled) {
      const callback = dependenciesFulfilled
      dependenciesFulfilled = null
      callback() // can add another dependenciesFulfilled
    }
  }
}

var addRunDependency = (id) => {
  runDependencies++

  Module.monitorRunDependencies?.(runDependencies)

  assert(id, 'addRunDependency requires an ID')
  assert(!runDependencyTracking[id])
  runDependencyTracking[id] = 1
  if (runDependencyWatcher === null && globalThis.setInterval) {
    // Check for missing dependencies every few seconds
    runDependencyWatcher = setInterval(() => {
      if (ABORT) {
        clearInterval(runDependencyWatcher)
        runDependencyWatcher = null
        return
      }
      let shown = false
      for (const dep in runDependencyTracking) {
        if (!shown) {
          shown = true
          err('still waiting on run dependencies:')
        }
        err(`dependency: ${dep}`)
      }
      if (shown) {
        err('(end of list)')
      }
    }, 10000)
    // Prevent this timer from keeping the runtime alive if nothing
    // else is.
    runDependencyWatcher.unref?.()
  }
}

/**
 * @param {number} ptr
 * @param {string} type
 */
function getValue (ptr, type = 'i8') {
  if (type.endsWith('*')) type = '*'
  switch (type) {
    case 'i1':
      return HEAP8[ptr]
    case 'i8':
      return HEAP8[ptr]
    case 'i16':
      return HEAP16[ptr >> 1]
    case 'i32':
      return HEAP32[ptr >> 2]
    case 'i64':
      return HEAP64[ptr >> 3]
    case 'float':
      return HEAPF32[ptr >> 2]
    case 'double':
      return HEAPF64[ptr >> 3]
    case '*':
      return HEAPU32[ptr >> 2]
    default:
      abort(`invalid type for getValue: ${type}`)
  }
}

let noExitRuntime = true

var ptrToString = (ptr) => {
  assert(
    typeof ptr === 'number',
    `ptrToString expects a number, got ${typeof ptr}`
  )
  // Convert to 32-bit unsigned value
  ptr >>>= 0
  return '0x' + ptr.toString(16).padStart(8, '0')
}

/**
 * @param {number} ptr
 * @param {number} value
 * @param {string} type
 */
function setValue (ptr, value, type = 'i8') {
  if (type.endsWith('*')) type = '*'
  switch (type) {
    case 'i1':
      HEAP8[ptr] = value
      break
    case 'i8':
      HEAP8[ptr] = value
      break
    case 'i16':
      HEAP16[ptr >> 1] = value
      break
    case 'i32':
      HEAP32[ptr >> 2] = value
      break
    case 'i64':
      HEAP64[ptr >> 3] = BigInt(value)
      break
    case 'float':
      HEAPF32[ptr >> 2] = value
      break
    case 'double':
      HEAPF64[ptr >> 3] = value
      break
    case '*':
      HEAPU32[ptr >> 2] = value
      break
    default:
      abort(`invalid type for setValue: ${type}`)
  }
}

const stackRestore = (val) => __emscripten_stack_restore(val)

const stackSave = () => _emscripten_stack_get_current()

var warnOnce = (text) => {
  warnOnce.shown ||= {}
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1
    if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text
    err(text)
  }
}

const __abort_js = () => abort('native code called abort()')

const _emscripten_get_now = () => performance.now()

const _emscripten_date_now = () => Date.now()

const nowIsMonotonic = 1

const checkWasiClock = (clock_id) => clock_id >= 0 && clock_id <= 3

const INT53_MAX = 9007199254740992

const INT53_MIN = -9007199254740992
const bigintToI53Checked = (num) =>
  num < INT53_MIN || num > INT53_MAX ? NaN : Number(num)
function _clock_time_get (clk_id, ignored_precision, ptime) {
  ignored_precision = bigintToI53Checked(ignored_precision)

  if (!checkWasiClock(clk_id)) {
    return 28
  }
  let now
  // all wasi clocks but realtime are monotonic
  if (clk_id === 0) {
    now = _emscripten_date_now()
  } else if (nowIsMonotonic) {
    now = _emscripten_get_now()
  } else {
    return 52
  }
  // "now" is in ms, and wasi times are in ns.
  const nsec = Math.round(now * 1000 * 1000)
  HEAP64[ptime >> 3] = BigInt(nsec)
  return 0
}

const _emscripten_set_main_loop_timing = (mode, value) => {
  MainLoop.timingMode = mode
  MainLoop.timingValue = value

  if (!MainLoop.func) {
    err(
      'emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.'
    )
    return 1 // Return non-zero on failure, can't set timing mode when there is no main loop.
  }

  if (!MainLoop.running) {
    MainLoop.running = true
  }
  if (mode == 0) {
    MainLoop.scheduler = function MainLoop_scheduler_setTimeout () {
      const timeUntilNextTick =
        Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now()) | 0
      setTimeout(MainLoop.runner, timeUntilNextTick) // doing this each time means that on exception, we stop
    }
    MainLoop.method = 'timeout'
  } else if (mode == 1) {
    MainLoop.scheduler = function MainLoop_scheduler_rAF () {
      MainLoop.requestAnimationFrame(MainLoop.runner)
    }
    MainLoop.method = 'rAF'
  } else if (mode == 2) {
    if (!MainLoop.setImmediate) {
      if (globalThis.setImmediate) {
        MainLoop.setImmediate = setImmediate
      } else {
        // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
        const setImmediates = []
        const emscriptenMainLoopMessageId = 'setimmediate'
        /** @param {Event} event */
        const MainLoop_setImmediate_messageHandler = (event) => {
          // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
          // so check for both cases.
          if (
            event.data === emscriptenMainLoopMessageId ||
            event.data.target === emscriptenMainLoopMessageId
          ) {
            event.stopPropagation()
            setImmediates.shift()()
          }
        }
        addEventListener('message', MainLoop_setImmediate_messageHandler, true)
        MainLoop.setImmediate =
          /** @type{function(function(): ?, ...?): number} */
          (func) => {
            setImmediates.push(func)
            if (ENVIRONMENT_IS_WORKER) {
              Module.setImmediates ??= []
              Module.setImmediates.push(func)
              postMessage({ target: emscriptenMainLoopMessageId }) // In --proxy-to-worker, route the message via proxyClient.js
            } else postMessage(emscriptenMainLoopMessageId, '*') // On the main thread, can just send the message to itself.
          }
      }
    }
    MainLoop.scheduler = function MainLoop_scheduler_setImmediate () {
      MainLoop.setImmediate(MainLoop.runner)
    }
    MainLoop.method = 'immediate'
  }
  return 0
}

const runtimeKeepaliveCounter = 0
const keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0
const _proc_exit = (code) => {
  EXITSTATUS = code
  if (!keepRuntimeAlive()) {
    Module.onExit?.(code)
    ABORT = true
  }
  quit_(code, new ExitStatus(code))
}

/** @param {boolean|number=} implicit */
const exitJS = (status, implicit) => {
  EXITSTATUS = status

  checkUnflushedContent()

  // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
  if (keepRuntimeAlive() && !implicit) {
    const msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`
    err(msg)
  }

  _proc_exit(status)
}
const _exit = exitJS

const handleException = (e) => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == 'unwind') {
    return EXITSTATUS
  }
  checkStackCookie()
  if (e instanceof WebAssembly.RuntimeError) {
    if (_emscripten_stack_get_current() <= 0) {
      err(
        'Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 536870912)'
      )
    }
  }
  quit_(1, e)
}

const maybeExit = () => {
  if (!keepRuntimeAlive()) {
    try {
      _exit(EXITSTATUS)
    } catch (e) {
      handleException(e)
    }
  }
}

/**
 * @param {number=} arg
 * @param {boolean=} noSetTiming
 */
const setMainLoop = (iterFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
  assert(
    !MainLoop.func,
    'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.'
  )
  MainLoop.func = iterFunc
  MainLoop.arg = arg

  const thisMainLoopId = MainLoop.currentlyRunningMainloop
  function checkIsRunning () {
    if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
      maybeExit()
      return false
    }
    return true
  }

  // We create the loop runner here but it is not actually running until
  // _emscripten_set_main_loop_timing is called (which might happen at a
  // later time).  This member signifies that the current runner has not
  // yet been started so that we can call runtimeKeepalivePush when it
  // gets its timing set for the first time.
  MainLoop.running = false
  MainLoop.runner = function MainLoop_runner () {
    if (ABORT) return
    if (MainLoop.queue.length > 0) {
      const start = Date.now()
      const blocker = MainLoop.queue.shift()
      blocker.func(blocker.arg)
      if (MainLoop.remainingBlockers) {
        const remaining = MainLoop.remainingBlockers
        let next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining)
        if (blocker.counted) {
          MainLoop.remainingBlockers = next
        } else {
          // not counted, but move the progress along a tiny bit
          next = next + 0.5 // do not steal all the next one's progress
          MainLoop.remainingBlockers = (8 * remaining + next) / 9
        }
      }
      MainLoop.updateStatus()

      // catches pause/resume main loop from blocker execution
      if (!checkIsRunning()) return

      setTimeout(MainLoop.runner, 0)
      return
    }

    // catch pauses from non-main loop sources
    if (!checkIsRunning()) return

    // Implement very basic swap interval control
    MainLoop.currentFrameNumber = (MainLoop.currentFrameNumber + 1) | 0
    if (
      MainLoop.timingMode == 1 &&
      MainLoop.timingValue > 1 &&
      MainLoop.currentFrameNumber % MainLoop.timingValue != 0
    ) {
      // Not the scheduled time to render this frame - skip.
      MainLoop.scheduler()
      return
    } else if (MainLoop.timingMode == 0) {
      MainLoop.tickStartTime = _emscripten_get_now()
    }

    if (MainLoop.method === 'timeout' && Module.ctx) {
      warnOnce(
        'Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!'
      )
      MainLoop.method = '' // just warn once per call to set main loop
    }

    MainLoop.runIter(iterFunc)

    // catch pauses from the main loop itself
    if (!checkIsRunning()) return

    MainLoop.scheduler()
  }

  if (!noSetTiming) {
    if (fps > 0) {
      _emscripten_set_main_loop_timing(0, 1000.0 / fps)
    } else {
      // Do rAF by rendering each frame (no decimating)
      _emscripten_set_main_loop_timing(1, 1)
    }

    MainLoop.scheduler()
  }

  if (simulateInfiniteLoop) {
    throw 'unwind'
  }
}

const callUserCallback = (func) => {
  if (ABORT) {
    err(
      'user callback triggered after runtime exited or application aborted.  Ignoring.'
    )
    return
  }
  try {
    func()
    maybeExit()
  } catch (e) {
    handleException(e)
  }
}

var MainLoop = {
  running: false,
  scheduler: null,
  method: '',
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  preMainLoop: [],
  postMainLoop: [],
  pause () {
    MainLoop.scheduler = null
    // Incrementing this signals the previous main loop that it's now become old, and it must return.
    MainLoop.currentlyRunningMainloop++
  },
  resume () {
    MainLoop.currentlyRunningMainloop++
    const timingMode = MainLoop.timingMode
    const timingValue = MainLoop.timingValue
    const func = MainLoop.func
    MainLoop.func = null
    // do not set timing and call scheduler, we will do it on the next lines
    setMainLoop(func, 0, false, MainLoop.arg, true)
    _emscripten_set_main_loop_timing(timingMode, timingValue)
    MainLoop.scheduler()
  },
  updateStatus () {
    if (Module.setStatus) {
      const message = Module.statusMessage || 'Please wait...'
      const remaining = MainLoop.remainingBlockers ?? 0
      const expected = MainLoop.expectedBlockers ?? 0
      if (remaining) {
        if (remaining < expected) {
          Module.setStatus('{message} ({expected - remaining}/{expected})')
        } else {
          Module.setStatus(message)
        }
      } else {
        Module.setStatus('')
      }
    }
  },
  init () {
    Module.preMainLoop && MainLoop.preMainLoop.push(Module.preMainLoop)
    Module.postMainLoop && MainLoop.postMainLoop.push(Module.postMainLoop)
  },
  runIter (func) {
    if (ABORT) return
    for (const pre of MainLoop.preMainLoop) {
      if (pre() === false) {
        return // |return false| skips a frame
      }
    }
    callUserCallback(func)
    for (const post of MainLoop.postMainLoop) {
      post()
    }
    checkStackCookie()
  },
  nextRAF: 0,
  fakeRequestAnimationFrame (func) {
    // try to keep 60fps between calls to here
    const now = Date.now()
    if (MainLoop.nextRAF === 0) {
      MainLoop.nextRAF = now + 1000 / 60
    } else {
      while (now + 2 >= MainLoop.nextRAF) {
        // fudge a little, to avoid timer jitter causing us to do lots of delay:0
        MainLoop.nextRAF += 1000 / 60
      }
    }
    const delay = Math.max(MainLoop.nextRAF - now, 0)
    setTimeout(func, delay)
  },
  requestAnimationFrame (func) {
    if (globalThis.requestAnimationFrame) {
      requestAnimationFrame(func)
    } else {
      MainLoop.fakeRequestAnimationFrame(func)
    }
  }
}
const _emscripten_cancel_main_loop = () => {
  MainLoop.pause()
  MainLoop.func = null
}

const onExits = []
const addOnExit = (cb) => onExits.push(cb)
var JSEvents = {
  removeAllEventListeners () {
    while (JSEvents.eventHandlers.length) {
      JSEvents._removeHandler(JSEvents.eventHandlers.length - 1)
    }
    JSEvents.deferredCalls = []
  },
  inEventHandler: 0,
  deferredCalls: [],
  deferCall (targetFunction, precedence, argsList) {
    function arraysHaveEqualContent (arrA, arrB) {
      if (arrA.length != arrB.length) return false

      for (const i in arrA) {
        if (arrA[i] != arrB[i]) return false
      }
      return true
    }
    // Test if the given call was already queued, and if so, don't add it again.
    for (const call of JSEvents.deferredCalls) {
      if (
        call.targetFunction == targetFunction &&
        arraysHaveEqualContent(call.argsList, argsList)
      ) {
        return
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction,
      precedence,
      argsList
    })

    JSEvents.deferredCalls.sort((x, y) => x.precedence < y.precedence)
  },
  removeDeferredCalls (targetFunction) {
    JSEvents.deferredCalls = JSEvents.deferredCalls.filter(
      (call) => call.targetFunction != targetFunction
    )
  },
  canPerformEventHandlerRequests () {
    if (navigator.userActivation) {
      // Verify against transient activation status from UserActivation API
      // whether it is possible to perform a request here without needing to defer. See
      // https://developer.mozilla.org/en-US/docs/Web/Security/User_activation#transient_activation
      // and https://caniuse.com/mdn-api_useractivation
      // At the time of writing, Firefox does not support this API: https://bugzil.la/1791079
      return navigator.userActivation.isActive
    }

    return (
      JSEvents.inEventHandler &&
      JSEvents.currentEventHandler.allowsDeferredCalls
    )
  },
  runDeferredCalls () {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return
    }
    const deferredCalls = JSEvents.deferredCalls
    JSEvents.deferredCalls = []
    for (const call of deferredCalls) {
      call.targetFunction(...call.argsList)
    }
  },
  eventHandlers: [],
  removeAllHandlersOnTarget: (target, eventTypeString) => {
    for (let i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (
        JSEvents.eventHandlers[i].target == target &&
        (!eventTypeString ||
          eventTypeString == JSEvents.eventHandlers[i].eventTypeString)
      ) {
        JSEvents._removeHandler(i--)
      }
    }
  },
  _removeHandler (i) {
    const h = JSEvents.eventHandlers[i]
    h.target.removeEventListener(
      h.eventTypeString,
      h.eventListenerFunc,
      h.useCapture
    )
    JSEvents.eventHandlers.splice(i, 1)
  },
  registerOrRemoveHandler (eventHandler) {
    if (!eventHandler.target) {
      err(
        'registerOrRemoveHandler: the target element for event handler registration does not exist, when processing the following event handler registration:'
      )
      console.dir(eventHandler)
      return -4
    }
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = function (event) {
        // Increment nesting count for the event handler.
        ++JSEvents.inEventHandler
        JSEvents.currentEventHandler = eventHandler
        // Process any old deferred calls the user has placed.
        JSEvents.runDeferredCalls()
        // Process the actual event, calls back to user C code handler.
        eventHandler.handlerFunc(event)
        // Process any new deferred calls that were placed right now from this event handler.
        JSEvents.runDeferredCalls()
        // Out of event handler - restore nesting count.
        --JSEvents.inEventHandler
      }

      eventHandler.target.addEventListener(
        eventHandler.eventTypeString,
        eventHandler.eventListenerFunc,
        eventHandler.useCapture
      )
      JSEvents.eventHandlers.push(eventHandler)
    } else {
      for (let i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (
          JSEvents.eventHandlers[i].target == eventHandler.target &&
          JSEvents.eventHandlers[i].eventTypeString ==
            eventHandler.eventTypeString
        ) {
          JSEvents._removeHandler(i--)
        }
      }
    }
    return 0
  },
  removeSingleHandler (eventHandler) {
    let success = false
    for (let i = 0; i < JSEvents.eventHandlers.length; ++i) {
      const handler = JSEvents.eventHandlers[i]
      if (
        handler.target === eventHandler.target &&
        handler.eventTypeId === eventHandler.eventTypeId &&
        handler.callbackfunc === eventHandler.callbackfunc &&
        handler.userData === eventHandler.userData
      ) {
        // in some very rare cases (ex: Safari / fullscreen events), there is more than 1 handler (eventTypeString is different)
        JSEvents._removeHandler(i--)
        success = true
      }
    }
    return success ? 0 : -5
  },
  getNodeNameForTarget (target) {
    if (!target) return ''
    if (target == window) return '#window'
    if (target == screen) return '#screen'
    return target?.nodeName || ''
  },
  fullscreenEnabled () {
    return (
      document.fullscreenEnabled ||
      // Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitFullscreenEnabled.
      // TODO: If Safari at some point ships with unprefixed version, update the version check above.
      document.webkitFullscreenEnabled
    )
  }
}

/** @type {Object} */
const specialHTMLTargets = [
  0,
  globalThis.document ?? 0,
  globalThis.window ?? 0
]

const UTF8Decoder = globalThis.TextDecoder && new TextDecoder()

const findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
  const maxIdx = idx + maxBytesToRead
  if (ignoreNul) return maxIdx
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.
  // As a tiny code save trick, compare idx against maxIdx using a negation,
  // so that maxBytesToRead=undefined/NaN means Infinity.
  while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx
  return idx
}

/**
 * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
 * array that contains uint8 values, returns a copy of that string as a
 * Javascript String object.
 * heapOrArray is either a regular array, or a JavaScript typed array view.
 * @param {number=} idx
 * @param {number=} maxBytesToRead
 * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
 * @return {string}
 */
const UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  const endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul)

  // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr))
  }
  let str = ''
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    let u0 = heapOrArray[idx++]
    if (!(u0 & 0x80)) {
      str += String.fromCharCode(u0)
      continue
    }
    const u1 = heapOrArray[idx++] & 63
    if ((u0 & 0xe0) == 0xc0) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1)
      continue
    }
    const u2 = heapOrArray[idx++] & 63
    if ((u0 & 0xf0) == 0xe0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2
    } else {
      if ((u0 & 0xf8) != 0xf0) {
        warnOnce(
          'Invalid UTF-8 leading byte ' +
            ptrToString(u0) +
            ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!'
        )
      }
      u0 =
        ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63)
    }

    if (u0 < 0x10000) {
      str += String.fromCharCode(u0)
    } else {
      const ch = u0 - 0x10000
      str += String.fromCharCode(0xd800 | (ch >> 10), 0xdc00 | (ch & 0x3ff))
    }
  }
  return str
}

/**
 * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
 * emscripten HEAP, returns a copy of that string as a Javascript String object.
 *
 * @param {number} ptr
 * @param {number=} maxBytesToRead - An optional length that specifies the
 *   maximum number of bytes to read. You can omit this parameter to scan the
 *   string until the first 0 byte. If maxBytesToRead is passed, and the string
 *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
 *   string will cut short at that byte index.
 * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
 * @return {string}
 */
const UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
  assert(
    typeof ptr === 'number',
    `UTF8ToString expects a number (got ${typeof ptr})`
  )
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : ''
}
const maybeCStringToJsString = (cString) => {
  // "cString > 2" checks if the input is a number, and isn't of the special
  // values we accept here, EMSCRIPTEN_EVENT_TARGET_* (which map to 0, 1, 2).
  // In other words, if cString > 2 then it's a pointer to a valid place in
  // memory, and points to a C string.
  return cString > 2 ? UTF8ToString(cString) : cString
}

const findEventTarget = (target) => {
  target = maybeCStringToJsString(target)
  const domElement =
    specialHTMLTargets[target] || globalThis.document?.querySelector(target)
  return domElement
}
const findCanvasEventTarget = findEventTarget
const _emscripten_get_canvas_element_size = (target, width, height) => {
  const canvas = findCanvasEventTarget(target)
  if (!canvas) return -4
  HEAP32[width >> 2] = canvas.width
  HEAP32[height >> 2] = canvas.height
}

const lengthBytesUTF8 = (str) => {
  let len = 0
  for (let i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    const c = str.charCodeAt(i) // possibly a lead surrogate
    if (c <= 0x7f) {
      len++
    } else if (c <= 0x7ff) {
      len += 2
    } else if (c >= 0xd800 && c <= 0xdfff) {
      len += 4
      ++i
    } else {
      len += 3
    }
  }
  return len
}

const stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  assert(
    typeof str === 'string',
    `stringToUTF8Array expects a string (got ${typeof str})`
  )
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0

  const startIdx = outIdx
  const endIdx = outIdx + maxBytesToWrite - 1 // -1 for string null terminator.
  for (let i = 0; i < str.length; ++i) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    const u = str.codePointAt(i)
    if (u <= 0x7f) {
      if (outIdx >= endIdx) break
      heap[outIdx++] = u
    } else if (u <= 0x7ff) {
      if (outIdx + 1 >= endIdx) break
      heap[outIdx++] = 0xc0 | (u >> 6)
      heap[outIdx++] = 0x80 | (u & 63)
    } else if (u <= 0xffff) {
      if (outIdx + 2 >= endIdx) break
      heap[outIdx++] = 0xe0 | (u >> 12)
      heap[outIdx++] = 0x80 | ((u >> 6) & 63)
      heap[outIdx++] = 0x80 | (u & 63)
    } else {
      if (outIdx + 3 >= endIdx) break
      if (u > 0x10ffff) {
        warnOnce(
          'Invalid Unicode code point ' +
            ptrToString(u) +
            ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).'
        )
      }
      heap[outIdx++] = 0xf0 | (u >> 18)
      heap[outIdx++] = 0x80 | ((u >> 12) & 63)
      heap[outIdx++] = 0x80 | ((u >> 6) & 63)
      heap[outIdx++] = 0x80 | (u & 63)
      // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
      // We need to manually skip over the second code unit for correct iteration.
      i++
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0
  return outIdx - startIdx
}
const stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
  assert(
    typeof maxBytesToWrite === 'number',
    'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  )
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}

const stackAlloc = (sz) => __emscripten_stack_alloc(sz)
const stringToUTF8OnStack = (str) => {
  const size = lengthBytesUTF8(str) + 1
  const ret = stackAlloc(size)
  stringToUTF8(str, ret, size)
  return ret
}
const getCanvasElementSize = (target) => {
  const sp = stackSave()
  const w = stackAlloc(8)
  const h = w + 4

  const targetInt = stringToUTF8OnStack(target.id)
  const ret = _emscripten_get_canvas_element_size(targetInt, w, h)
  const size = [HEAP32[w >> 2], HEAP32[h >> 2]]
  stackRestore(sp)
  return size
}

const _emscripten_set_canvas_element_size = (target, width, height) => {
  const canvas = findCanvasEventTarget(target)
  if (!canvas) return -4
  canvas.width = width
  canvas.height = height
  return 0
}

const setCanvasElementSize = (target, width, height) => {
  if (!target.controlTransferredOffscreen) {
    target.width = width
    target.height = height
  } else {
    // This function is being called from high-level JavaScript code instead of asm.js/Wasm,
    // and it needs to synchronously proxy over to another thread, so marshal the string onto the heap to do the call.
    const sp = stackSave()
    const targetInt = stringToUTF8OnStack(target.id)
    _emscripten_set_canvas_element_size(targetInt, width, height)
    stackRestore(sp)
  }
}

let currentFullscreenStrategy = {}

const wasmTableMirror = []

const getWasmTableEntry = (funcPtr) => {
  let func = wasmTableMirror[funcPtr]
  if (!func) {
    /** @suppress {checkTypes} */
    wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr)
  }
  /** @suppress {checkTypes} */
  assert(
    wasmTable.get(funcPtr) == func,
    'JavaScript-side Wasm function table mirror is out of date!'
  )
  return func
}
const registerRestoreOldStyle = (canvas) => {
  const canvasSize = getCanvasElementSize(canvas)
  const oldWidth = canvasSize[0]
  const oldHeight = canvasSize[1]
  const oldCssWidth = canvas.style.width
  const oldCssHeight = canvas.style.height
  const oldBackgroundColor = canvas.style.backgroundColor // Chrome reads color from here.
  const oldDocumentBackgroundColor = document.body.style.backgroundColor // IE11 reads color from here.
  // Firefox always has black background color.
  const oldPaddingLeft = canvas.style.paddingLeft // Chrome, FF, Safari
  const oldPaddingRight = canvas.style.paddingRight
  const oldPaddingTop = canvas.style.paddingTop
  const oldPaddingBottom = canvas.style.paddingBottom
  const oldMarginLeft = canvas.style.marginLeft // IE11
  const oldMarginRight = canvas.style.marginRight
  const oldMarginTop = canvas.style.marginTop
  const oldMarginBottom = canvas.style.marginBottom
  const oldDocumentBodyMargin = document.body.style.margin
  const oldDocumentOverflow = document.documentElement.style.overflow // Chrome, Firefox
  const oldDocumentScroll = document.body.scroll // IE
  const oldImageRendering = canvas.style.imageRendering

  function restoreOldStyle () {
    if (!getFullscreenElement()) {
      document.removeEventListener('fullscreenchange', restoreOldStyle)

      // As of Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitfullscreenchange. TODO: revisit this check once Safari ships unprefixed version.
      document.removeEventListener('webkitfullscreenchange', restoreOldStyle)

      setCanvasElementSize(canvas, oldWidth, oldHeight)

      canvas.style.width = oldCssWidth
      canvas.style.height = oldCssHeight
      canvas.style.backgroundColor = oldBackgroundColor // Chrome
      // IE11 hack: assigning 'undefined' or an empty string to document.body.style.backgroundColor has no effect, so first assign back the default color
      // before setting the undefined value. Setting undefined value is also important, or otherwise we would later treat that as something that the user
      // had explicitly set so subsequent fullscreen transitions would not set background color properly.
      if (!oldDocumentBackgroundColor) {
        document.body.style.backgroundColor = 'white'
      }
      document.body.style.backgroundColor = oldDocumentBackgroundColor // IE11
      canvas.style.paddingLeft = oldPaddingLeft // Chrome, FF, Safari
      canvas.style.paddingRight = oldPaddingRight
      canvas.style.paddingTop = oldPaddingTop
      canvas.style.paddingBottom = oldPaddingBottom
      canvas.style.marginLeft = oldMarginLeft // IE11
      canvas.style.marginRight = oldMarginRight
      canvas.style.marginTop = oldMarginTop
      canvas.style.marginBottom = oldMarginBottom
      document.body.style.margin = oldDocumentBodyMargin
      document.documentElement.style.overflow = oldDocumentOverflow // Chrome, Firefox
      document.body.scroll = oldDocumentScroll // IE
      canvas.style.imageRendering = oldImageRendering
      if (canvas.GLctxObject) {
        canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight)
      }

      if (currentFullscreenStrategy.canvasResizedCallback) {
        getWasmTableEntry(currentFullscreenStrategy.canvasResizedCallback)(
          37,
          0,
          currentFullscreenStrategy.canvasResizedCallbackUserData
        )
      }
    }
  }
  document.addEventListener('fullscreenchange', restoreOldStyle)
  // As of Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitfullscreenchange. TODO: revisit this check once Safari ships unprefixed version.
  document.addEventListener('webkitfullscreenchange', restoreOldStyle)
  return restoreOldStyle
}

const setLetterbox = (element, topBottom, leftRight) => {
  // Cannot use margin to specify letterboxes in FF or Chrome, since those ignore margins in fullscreen mode.
  element.style.paddingLeft = element.style.paddingRight = leftRight + 'px'
  element.style.paddingTop = element.style.paddingBottom = topBottom + 'px'
}

const getBoundingClientRect = (e) =>
  specialHTMLTargets.indexOf(e) < 0
    ? e.getBoundingClientRect()
    : { left: 0, top: 0 }
const JSEvents_resizeCanvasForFullscreen = (target, strategy) => {
  const restoreOldStyle = registerRestoreOldStyle(target)
  let cssWidth = strategy.softFullscreen ? innerWidth : screen.width
  let cssHeight = strategy.softFullscreen ? innerHeight : screen.height
  const rect = getBoundingClientRect(target)
  const windowedCssWidth = rect.width
  const windowedCssHeight = rect.height
  const canvasSize = getCanvasElementSize(target)
  const windowedRttWidth = canvasSize[0]
  const windowedRttHeight = canvasSize[1]

  if (strategy.scaleMode == 3) {
    setLetterbox(
      target,
      (cssHeight - windowedCssHeight) / 2,
      (cssWidth - windowedCssWidth) / 2
    )
    cssWidth = windowedCssWidth
    cssHeight = windowedCssHeight
  } else if (strategy.scaleMode == 2) {
    if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
      const desiredCssHeight =
        (windowedRttHeight * cssWidth) / windowedRttWidth
      setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0)
      cssHeight = desiredCssHeight
    } else {
      const desiredCssWidth =
        (windowedRttWidth * cssHeight) / windowedRttHeight
      setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2)
      cssWidth = desiredCssWidth
    }
  }

  // If we are adding padding, must choose a background color or otherwise Chrome will give the
  // padding a default white color. Do it only if user has not customized their own background color.
  target.style.backgroundColor ||= 'black'
  // IE11 does the same, but requires the color to be set in the document body.
  document.body.style.backgroundColor ||= 'black' // IE11
  // Firefox always shows black letterboxes independent of style color.

  target.style.width = cssWidth + 'px'
  target.style.height = cssHeight + 'px'

  if (strategy.filteringMode == 1) {
    target.style.imageRendering = 'optimizeSpeed'
    target.style.imageRendering = '-moz-crisp-edges'
    target.style.imageRendering = '-o-crisp-edges'
    target.style.imageRendering = '-webkit-optimize-contrast'
    target.style.imageRendering = 'optimize-contrast'
    target.style.imageRendering = 'crisp-edges'
    target.style.imageRendering = 'pixelated'
  }

  const dpiScale =
    strategy.canvasResolutionScaleMode == 2 ? devicePixelRatio : 1
  if (strategy.canvasResolutionScaleMode != 0) {
    const newWidth = (cssWidth * dpiScale) | 0
    const newHeight = (cssHeight * dpiScale) | 0
    setCanvasElementSize(target, newWidth, newHeight)
    if (target.GLctxObject) {
      target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight)
    }
  }
  return restoreOldStyle
}

const JSEvents_requestFullscreen = (target, strategy) => {
  // EMSCRIPTEN_FULLSCREEN_SCALE_DEFAULT + EMSCRIPTEN_FULLSCREEN_CANVAS_SCALE_NONE is a mode where no extra logic is performed to the DOM elements.
  if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
    JSEvents_resizeCanvasForFullscreen(target, strategy)
  }

  if (target.requestFullscreen) {
    target.requestFullscreen()
  } else if (target.webkitRequestFullscreen) {
    target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT)
  } else {
    return JSEvents.fullscreenEnabled() ? -3 : -1
  }

  currentFullscreenStrategy = strategy

  if (strategy.canvasResizedCallback) {
    getWasmTableEntry(strategy.canvasResizedCallback)(
      37,
      0,
      strategy.canvasResizedCallbackUserData
    )
  }

  return 0
}
const _emscripten_exit_fullscreen = () => {
  if (!JSEvents.fullscreenEnabled()) return -1
  // Make sure no queued up calls will fire after this.
  JSEvents.removeDeferredCalls(JSEvents_requestFullscreen)

  const d = specialHTMLTargets[1]
  if (d.exitFullscreen) {
    d.fullscreenElement && d.exitFullscreen()
  } else if (d.webkitExitFullscreen) {
    d.webkitFullscreenElement && d.webkitExitFullscreen()
  } else {
    return -1
  }

  return 0
}

const requestPointerLock = (target) => {
  if (target.requestPointerLock) {
    target.requestPointerLock()
  } else {
    // document.body is known to accept pointer lock, so use that to differentiate if the user passed a bad element,
    // or if the whole browser just doesn't support the feature.
    if (document.body.requestPointerLock) {
      return -3
    }
    return -1
  }
  return 0
}
const _emscripten_exit_pointerlock = () => {
  // Make sure no queued up calls will fire after this.
  JSEvents.removeDeferredCalls(requestPointerLock)
  if (!document.exitPointerLock) return -1
  document.exitPointerLock()
  return 0
}

const _emscripten_get_device_pixel_ratio = () => {
  return globalThis.devicePixelRatio ?? 1.0
}

const _emscripten_get_element_css_size = (target, width, height) => {
  target = findEventTarget(target)
  if (!target) return -4

  const rect = getBoundingClientRect(target)
  HEAPF64[width >> 3] = rect.width
  HEAPF64[height >> 3] = rect.height

  return 0
}

function getFullscreenElement () {
  return (
    document.fullscreenElement ||
    document.mozFullScreenElement ||
    document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement ||
    document.msFullscreenElement
  )
}
const fillFullscreenChangeEventData = (eventStruct) => {
  const fullscreenElement = getFullscreenElement()
  const isFullscreen = !!fullscreenElement
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */
  HEAP8[eventStruct] = isFullscreen
  HEAP8[eventStruct + 1] = JSEvents.fullscreenEnabled()
  // If transitioning to fullscreen, report info about the element that is now fullscreen.
  // If transitioning to windowed mode, report info about the element that just was fullscreen.
  const reportedElement = isFullscreen
    ? fullscreenElement
    : JSEvents.previousFullscreenElement
  const nodeName = JSEvents.getNodeNameForTarget(reportedElement)
  const id = reportedElement?.id || ''
  stringToUTF8(nodeName, eventStruct + 2, 128)
  stringToUTF8(id, eventStruct + 130, 128)
  HEAP32[(eventStruct + 260) >> 2] = reportedElement
    ? reportedElement.clientWidth
    : 0
  HEAP32[(eventStruct + 264) >> 2] = reportedElement
    ? reportedElement.clientHeight
    : 0
  HEAP32[(eventStruct + 268) >> 2] = screen.width
  HEAP32[(eventStruct + 272) >> 2] = screen.height
  if (isFullscreen) {
    JSEvents.previousFullscreenElement = fullscreenElement
  }
}
const _emscripten_get_fullscreen_status = (fullscreenStatus) => {
  if (!JSEvents.fullscreenEnabled()) return -1
  fillFullscreenChangeEventData(fullscreenStatus)
  return 0
}

const fillGamepadEventData = (eventStruct, e) => {
  HEAPF64[eventStruct >> 3] = e.timestamp
  for (var i = 0; i < e.axes.length; ++i) {
    HEAPF64[(eventStruct + i * 8 + 16) >> 3] = e.axes[i]
  }
  for (var i = 0; i < e.buttons.length; ++i) {
    if (typeof e.buttons[i] === 'object') {
      HEAPF64[(eventStruct + i * 8 + 528) >> 3] = e.buttons[i].value
    } else {
      HEAPF64[(eventStruct + i * 8 + 528) >> 3] = e.buttons[i]
    }
  }
  for (var i = 0; i < e.buttons.length; ++i) {
    if (typeof e.buttons[i] === 'object') {
      HEAP8[eventStruct + i + 1040] = e.buttons[i].pressed
    } else {
      // Assigning a boolean to HEAP32, that's ok, but Closure would like to warn about it:
      /** @suppress {checkTypes} */
      HEAP8[eventStruct + i + 1040] = e.buttons[i] == 1
    }
  }
  HEAP8[eventStruct + 1104] = e.connected
  HEAP32[(eventStruct + 1108) >> 2] = e.index
  HEAP32[(eventStruct + 8) >> 2] = e.axes.length
  HEAP32[(eventStruct + 12) >> 2] = e.buttons.length
  stringToUTF8(e.id, eventStruct + 1112, 64)
  stringToUTF8(e.mapping, eventStruct + 1176, 64)
}
const _emscripten_get_gamepad_status = (index, gamepadState) => {
  assert(
    JSEvents.lastGamepadState,
    'emscripten_get_gamepad_status() can only be called after having first called emscripten_sample_gamepad_data() and that function has returned EMSCRIPTEN_RESULT_SUCCESS!'
  )
  // INVALID_PARAM is returned on a Gamepad index that never was there.
  if (index < 0 || index >= JSEvents.lastGamepadState.length) return -5

  // NO_DATA is returned on a Gamepad index that was removed.
  // For previously disconnected gamepads there should be an empty slot (null/undefined/false) at the index.
  // This is because gamepads must keep their original position in the array.
  // For example, removing the first of two gamepads produces [null/undefined/false, gamepad].
  if (!JSEvents.lastGamepadState[index]) return -7

  fillGamepadEventData(gamepadState, JSEvents.lastGamepadState[index])
  return 0
}

const _emscripten_get_num_gamepads = () => {
  assert(
    JSEvents.lastGamepadState,
    'emscripten_get_num_gamepads() can only be called after having first called emscripten_sample_gamepad_data() and that function has returned EMSCRIPTEN_RESULT_SUCCESS!'
  )
  // N.B. Do not call emscripten_get_num_gamepads() unless having first called emscripten_sample_gamepad_data(), and that has returned EMSCRIPTEN_RESULT_SUCCESS.
  // Otherwise the following line will throw an exception.
  return JSEvents.lastGamepadState.length
}

const fillPointerlockChangeEventData = (eventStruct) => {
  const pointerLockElement = document.pointerLockElement
  const isPointerlocked = !!pointerLockElement
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */
  HEAP8[eventStruct] = isPointerlocked
  const nodeName = JSEvents.getNodeNameForTarget(pointerLockElement)
  const id = pointerLockElement?.id || ''
  stringToUTF8(nodeName, eventStruct + 1, 128)
  stringToUTF8(id, eventStruct + 129, 128)
}
const _emscripten_get_pointerlock_status = (pointerlockStatus) => {
  if (pointerlockStatus) fillPointerlockChangeEventData(pointerlockStatus)
  if (!document.body?.requestPointerLock) {
    return -1
  }
  return 0
}

let GLctx

const webgl_enable_ANGLE_instanced_arrays = (ctx) => {
  // Extension available in WebGL 1 from Firefox 26 and Google Chrome 30 onwards. Core feature in WebGL 2.
  const ext = ctx.getExtension('ANGLE_instanced_arrays')
  // Because this extension is a core function in WebGL 2, assign the extension entry points in place of
  // where the core functions will reside in WebGL 2. This way the calling code can call these without
  // having to dynamically branch depending if running against WebGL 1 or WebGL 2.
  if (ext) {
    ctx.vertexAttribDivisor = (index, divisor) =>
      ext.vertexAttribDivisorANGLE(index, divisor)
    ctx.drawArraysInstanced = (mode, first, count, primcount) =>
      ext.drawArraysInstancedANGLE(mode, first, count, primcount)
    ctx.drawElementsInstanced = (mode, count, type, indices, primcount) =>
      ext.drawElementsInstancedANGLE(mode, count, type, indices, primcount)
    return 1
  }
}

const webgl_enable_OES_vertex_array_object = (ctx) => {
  // Extension available in WebGL 1 from Firefox 25 and WebKit 536.28/desktop Safari 6.0.3 onwards. Core feature in WebGL 2.
  const ext = ctx.getExtension('OES_vertex_array_object')
  if (ext) {
    ctx.createVertexArray = () => ext.createVertexArrayOES()
    ctx.deleteVertexArray = (vao) => ext.deleteVertexArrayOES(vao)
    ctx.bindVertexArray = (vao) => ext.bindVertexArrayOES(vao)
    ctx.isVertexArray = (vao) => ext.isVertexArrayOES(vao)
    return 1
  }
}

const webgl_enable_WEBGL_draw_buffers = (ctx) => {
  // Extension available in WebGL 1 from Firefox 28 onwards. Core feature in WebGL 2.
  const ext = ctx.getExtension('WEBGL_draw_buffers')
  if (ext) {
    ctx.drawBuffers = (n, bufs) => ext.drawBuffersWEBGL(n, bufs)
    return 1
  }
}

const webgl_enable_EXT_polygon_offset_clamp = (ctx) =>
  !!(ctx.extPolygonOffsetClamp = ctx.getExtension('EXT_polygon_offset_clamp'))

const webgl_enable_EXT_clip_control = (ctx) =>
  !!(ctx.extClipControl = ctx.getExtension('EXT_clip_control'))

const webgl_enable_WEBGL_polygon_mode = (ctx) =>
  !!(ctx.webglPolygonMode = ctx.getExtension('WEBGL_polygon_mode'))

const webgl_enable_WEBGL_multi_draw = (ctx) =>
  // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
  !!(ctx.multiDrawWebgl = ctx.getExtension('WEBGL_multi_draw'))

const getEmscriptenSupportedExtensions = (ctx) => {
  // Restrict the list of advertised extensions to those that we actually
  // support.
  const supportedExtensions = [
    // WebGL 1 extensions
    'ANGLE_instanced_arrays',
    'EXT_blend_minmax',
    'EXT_disjoint_timer_query',
    'EXT_frag_depth',
    'EXT_shader_texture_lod',
    'EXT_sRGB',
    'OES_element_index_uint',
    'OES_fbo_render_mipmap',
    'OES_standard_derivatives',
    'OES_texture_float',
    'OES_texture_half_float',
    'OES_texture_half_float_linear',
    'OES_vertex_array_object',
    'WEBGL_color_buffer_float',
    'WEBGL_depth_texture',
    'WEBGL_draw_buffers',
    // WebGL 1 and WebGL 2 extensions
    'EXT_clip_control',
    'EXT_color_buffer_half_float',
    'EXT_depth_clamp',
    'EXT_float_blend',
    'EXT_polygon_offset_clamp',
    'EXT_texture_compression_bptc',
    'EXT_texture_compression_rgtc',
    'EXT_texture_filter_anisotropic',
    'KHR_parallel_shader_compile',
    'OES_texture_float_linear',
    'WEBGL_blend_func_extended',
    'WEBGL_compressed_texture_astc',
    'WEBGL_compressed_texture_etc',
    'WEBGL_compressed_texture_etc1',
    'WEBGL_compressed_texture_s3tc',
    'WEBGL_compressed_texture_s3tc_srgb',
    'WEBGL_debug_renderer_info',
    'WEBGL_debug_shaders',
    'WEBGL_lose_context',
    'WEBGL_multi_draw',
    'WEBGL_polygon_mode'
  ]
  // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
  return (ctx.getSupportedExtensions() || []).filter((ext) =>
    supportedExtensions.includes(ext)
  )
}

var GL = {
  counter: 1,
  buffers: [],
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  shaders: [],
  vaos: [],
  contexts: [],
  offscreenCanvases: {},
  queries: [],
  stringCache: {},
  unpackAlignment: 4,
  unpackRowLength: 0,
  recordError: (errorCode) => {
    if (!GL.lastError) {
      GL.lastError = errorCode
    }
  },
  getNewId: (table) => {
    const ret = GL.counter++
    for (let i = table.length; i < ret; i++) {
      table[i] = null
    }
    return ret
  },
  genObject: (n, buffers, createFunction, objectTable) => {
    for (let i = 0; i < n; i++) {
      const buffer = GLctx[createFunction]()
      const id = buffer && GL.getNewId(objectTable)
      if (buffer) {
        buffer.name = id
        objectTable[id] = buffer
      } else {
        GL.recordError(0x502 /* GL_INVALID_OPERATION */)
      }
      HEAP32[(buffers + i * 4) >> 2] = id
    }
  },
  getSource: (shader, count, string, length) => {
    let source = ''
    for (let i = 0; i < count; ++i) {
      const len = length ? HEAPU32[(length + i * 4) >> 2] : undefined
      source += UTF8ToString(HEAPU32[(string + i * 4) >> 2], len)
    }
    return source
  },
  createContext: (
    /** @type {HTMLCanvasElement} */ canvas,
    webGLContextAttributes
  ) => {
    // BUG: Workaround Safari WebGL issue: After successfully acquiring WebGL
    // context on a canvas, calling .getContext() will always return that
    // context independent of which 'webgl' or 'webgl2'
    // context version was passed. See:
    //   https://webkit.org/b/222758
    // and:
    //   https://github.com/emscripten-core/emscripten/issues/13295.
    // TODO: Once the bug is fixed and shipped in Safari, adjust the Safari
    // version field in above check.
    if (!canvas.getContextSafariWebGL2Fixed) {
      canvas.getContextSafariWebGL2Fixed = canvas.getContext
      /** @type {function(this:HTMLCanvasElement, string, (Object|null)=): (Object|null)} */
      function fixedGetContext (ver, attrs) {
        const gl = canvas.getContextSafariWebGL2Fixed(ver, attrs)
        return (ver == 'webgl') == gl instanceof WebGLRenderingContext
          ? gl
          : null
      }
      canvas.getContext = fixedGetContext
    }

    const ctx = canvas.getContext('webgl', webGLContextAttributes)

    if (!ctx) return 0

    const handle = GL.registerContext(ctx, webGLContextAttributes)

    return handle
  },
  registerContext: (ctx, webGLContextAttributes) => {
    // without pthreads a context is just an integer ID
    const handle = GL.getNewId(GL.contexts)

    const context = {
      handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    }

    // Store the created context object so that we can access the context
    // given a canvas without having to pass the parameters again.
    if (ctx.canvas) ctx.canvas.GLctxObject = context
    GL.contexts[handle] = context
    if (
      typeof webGLContextAttributes.enableExtensionsByDefault === 'undefined' ||
      webGLContextAttributes.enableExtensionsByDefault
    ) {
      GL.initExtensions(context)
    }

    return handle
  },
  makeContextCurrent: (contextHandle) => {
    // Active Emscripten GL layer context object.
    GL.currentContext = GL.contexts[contextHandle]
    // Active WebGL context object.
    Module.ctx = GLctx = GL.currentContext?.GLctx
    return !(contextHandle && !GLctx)
  },
  getContext: (contextHandle) => {
    return GL.contexts[contextHandle]
  },
  deleteContext: (contextHandle) => {
    if (GL.currentContext === GL.contexts[contextHandle]) {
      GL.currentContext = null
    }
    if (typeof JSEvents === 'object') {
      // Release all JS event handlers on the DOM element that the GL context is
      // associated with since the context is now deleted.
      JSEvents.removeAllHandlersOnTarget(
        GL.contexts[contextHandle].GLctx.canvas
      )
    }
    // Make sure the canvas object no longer refers to the context object so
    // there are no GC surprises.
    if (GL.contexts[contextHandle]?.GLctx.canvas) {
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined
    }
    GL.contexts[contextHandle] = null
  },
  initExtensions: (context) => {
    // If this function is called without a specific context object, init the
    // extensions of the currently active context.
    context ||= GL.currentContext

    if (context.initExtensionsDone) return
    context.initExtensionsDone = true

    const GLctx = context.GLctx

    // Detect the presence of a few extensions manually, since the GL interop
    // layer itself will need to know if they exist.

    // Extensions that are available in both WebGL 1 and WebGL 2
    webgl_enable_WEBGL_multi_draw(GLctx)
    webgl_enable_EXT_polygon_offset_clamp(GLctx)
    webgl_enable_EXT_clip_control(GLctx)
    webgl_enable_WEBGL_polygon_mode(GLctx)
    // Extensions that are only available in WebGL 1 (the calls will be no-ops
    // if called on a WebGL 2 context active)
    webgl_enable_ANGLE_instanced_arrays(GLctx)
    webgl_enable_OES_vertex_array_object(GLctx)
    webgl_enable_WEBGL_draw_buffers(GLctx)
    {
      GLctx.disjointTimerQueryExt = GLctx.getExtension(
        'EXT_disjoint_timer_query'
      )
    }

    for (const ext of getEmscriptenSupportedExtensions(GLctx)) {
      // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
      // are not enabled by default.
      if (!ext.includes('lose_context') && !ext.includes('debug')) {
        // Call .getExtension() to enable that extension permanently.
        GLctx.getExtension(ext)
      }
    }
  }
}
const _emscripten_is_webgl_context_lost = (contextHandle) =>
  !GL.contexts[contextHandle] ||
  GL.contexts[contextHandle].GLctx.isContextLost()

const doRequestFullscreen = (target, strategy) => {
  if (!JSEvents.fullscreenEnabled()) return -1
  target = findEventTarget(target)
  if (!target) return -4

  if (!target.requestFullscreen && !target.webkitRequestFullscreen) {
    return -3
  }

  // Queue this function call if we're not currently in an event handler and
  // the user saw it appropriate to do so.
  if (!JSEvents.canPerformEventHandlerRequests()) {
    if (strategy.deferUntilInEventHandler) {
      JSEvents.deferCall(
        JSEvents_requestFullscreen,
        1 /* priority over pointer lock */,
        [target, strategy]
      )
      return 1
    }
    return -2
  }

  return JSEvents_requestFullscreen(target, strategy)
}
const _emscripten_request_fullscreen_strategy = (
  target,
  deferUntilInEventHandler,
  fullscreenStrategy
) => {
  const strategy = {
    scaleMode: HEAP32[fullscreenStrategy >> 2],
    canvasResolutionScaleMode: HEAP32[(fullscreenStrategy + 4) >> 2],
    filteringMode: HEAP32[(fullscreenStrategy + 8) >> 2],
    deferUntilInEventHandler,
    canvasResizedCallback: HEAP32[(fullscreenStrategy + 12) >> 2],
    canvasResizedCallbackUserData: HEAP32[(fullscreenStrategy + 16) >> 2]
  }

  return doRequestFullscreen(target, strategy)
}

const _emscripten_request_pointerlock = (target, deferUntilInEventHandler) => {
  target = findEventTarget(target)
  if (!target) return -4
  if (!target.requestPointerLock) {
    return -1
  }

  // Queue this function call if we're not currently in an event handler and
  // the user saw it appropriate to do so.
  if (!JSEvents.canPerformEventHandlerRequests()) {
    if (deferUntilInEventHandler) {
      JSEvents.deferCall(
        requestPointerLock,
        2 /* priority below fullscreen */,
        [target]
      )
      return 1
    }
    return -2
  }

  return requestPointerLock(target)
}

const getHeapMax = () =>
  // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
  // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
  // for any code that deals with heap sizes, which would require special
  // casing all heap size related code to treat 0 specially.
  2147483648

const alignMemory = (size, alignment) => {
  assert(alignment, 'alignment argument is required')
  return Math.ceil(size / alignment) * alignment
}

const growMemory = (size) => {
  const oldHeapSize = wasmMemory.buffer.byteLength
  const pages = ((size - oldHeapSize + 65535) / 65536) | 0
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(pages) // .grow() takes a delta compared to the previous size
    updateMemoryViews()
    return 1 /* success */
  } catch (e) {
    err(
      `growMemory: Attempted to grow heap from ${oldHeapSize} bytes to ${size} bytes, but got error: ${e}`
    )
  }
  // implicit 0 return to save code size (caller will cast "undefined" into 0
  // anyhow)
}
const _emscripten_resize_heap = (requestedSize) => {
  const oldSize = HEAPU8.length
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  requestedSize >>>= 0
  // With multithreaded builds, races can happen (another thread might increase the size
  // in between), so return a failure, and let the caller retry.
  assert(requestedSize > oldSize)

  // Memory resize rules:
  // 1.  Always increase heap size to at least the requested size, rounded up
  //     to next page multiple.
  // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
  //     geometrically: increase the heap size according to
  //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
  //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
  // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
  //     linearly: increase the heap size by at least
  //     MEMORY_GROWTH_LINEAR_STEP bytes.
  // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
  //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
  // 4.  If we were unable to allocate as much memory, it may be due to
  //     over-eager decision to excessively reserve due to (3) above.
  //     Hence if an allocation fails, cut down on the amount of excess
  //     growth, in an attempt to succeed to perform a smaller allocation.

  // A limit is set for how much we can grow. We should not exceed that
  // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
  const maxHeapSize = getHeapMax()
  if (requestedSize > maxHeapSize) {
    err(
      `Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`
    )
    return false
  }

  // Loop through potential heap size increases. If we attempt a too eager
  // reservation that fails, cut down on the attempted size and reserve a
  // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
  for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
    let overGrownHeapSize = oldSize * (1 + 0.2 / cutDown) // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296)

    var newSize = Math.min(
      maxHeapSize,
      alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536)
    )

    const replacement = growMemory(newSize)
    if (replacement) {
      return true
    }
  }
  err(
    `Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`
  )
  return false
}

const _emscripten_resume_main_loop = () => MainLoop.resume()

/** @suppress {checkTypes} */
const _emscripten_sample_gamepad_data = () => {
  try {
    if (navigator.getGamepads) {
      return (JSEvents.lastGamepadState = navigator.getGamepads()) ? 0 : -1
    }
  } catch (e) {
    err(
      `navigator.getGamepads() exists, but failed to execute with exception ${e}. Disabling Gamepad access.`
    )
    navigator.getGamepads = null // Disable getGamepads() so that it won't be attempted to be used again.
  }
  return -1
}

const registerBeforeUnloadEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString
) => {
  const beforeUnloadEventHandlerFunc = (e) => {
    // Note: This is always called on the main browser thread, since it needs synchronously return a value!
    let confirmationMessage = getWasmTableEntry(callbackfunc)(
      eventTypeId,
      0,
      userData
    )

    if (confirmationMessage) {
      confirmationMessage = UTF8ToString(confirmationMessage)
    }
    if (confirmationMessage) {
      e.preventDefault()
      e.returnValue = confirmationMessage
      return confirmationMessage
    }
  }

  const eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: beforeUnloadEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}
const _emscripten_set_beforeunload_callback_on_thread = (
  userData,
  callbackfunc,
  targetThread
) => {
  if (typeof onbeforeunload === 'undefined') return -1
  // beforeunload callback can only be registered on the main browser thread, because the page will go away immediately after returning from the handler,
  // and there is no time to start proxying it anywhere.
  if (targetThread !== 1) return -5
  return registerBeforeUnloadEventCallback(
    2,
    userData,
    true,
    callbackfunc,
    28,
    'beforeunload'
  )
}

const registerFocusEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 256
  JSEvents.focusEvent ||= _malloc(eventSize)

  const focusEventHandlerFunc = (e) => {
    const nodeName = JSEvents.getNodeNameForTarget(e.target)
    const id = e.target.id ? e.target.id : ''

    const focusEvent = JSEvents.focusEvent
    stringToUTF8(nodeName, focusEvent + 0, 128)
    stringToUTF8(id, focusEvent + 128, 128)

    if (getWasmTableEntry(callbackfunc)(eventTypeId, focusEvent, userData)) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: focusEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}
const _emscripten_set_blur_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerFocusEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    12,
    'blur',
    targetThread
  )

const _emscripten_set_element_css_size = (target, width, height) => {
  target = findEventTarget(target)
  if (!target) return -4

  target.style.width = width + 'px'
  target.style.height = height + 'px'

  return 0
}

const _emscripten_set_focus_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerFocusEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    13,
    'focus',
    targetThread
  )

const registerFullscreenChangeEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 276
  JSEvents.fullscreenChangeEvent ||= _malloc(eventSize)

  const fullscreenChangeEventHandlerFunc = (e) => {
    const fullscreenChangeEvent = JSEvents.fullscreenChangeEvent
    fillFullscreenChangeEventData(fullscreenChangeEvent)

    if (
      getWasmTableEntry(callbackfunc)(
        eventTypeId,
        fullscreenChangeEvent,
        userData
      )
    ) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: fullscreenChangeEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}

const _emscripten_set_fullscreenchange_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) => {
  if (!JSEvents.fullscreenEnabled()) return -1
  target = findEventTarget(target)
  if (!target) return -4

  // As of Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitfullscreenchange. TODO: revisit this check once Safari ships unprefixed version.
  // TODO: When this block is removed, also change test/test_html5_remove_event_listener.c test expectation on emscripten_set_fullscreenchange_callback().
  registerFullscreenChangeEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    19,
    'webkitfullscreenchange',
    targetThread
  )

  return registerFullscreenChangeEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    19,
    'fullscreenchange',
    targetThread
  )
}

const registerKeyEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 160
  JSEvents.keyEvent ||= _malloc(eventSize)

  const keyEventHandlerFunc = (e) => {
    assert(e)

    const keyEventData = JSEvents.keyEvent
    HEAPF64[keyEventData >> 3] = e.timeStamp

    const idx = keyEventData >> 2

    HEAP32[idx + 2] = e.location
    HEAP8[keyEventData + 12] = e.ctrlKey
    HEAP8[keyEventData + 13] = e.shiftKey
    HEAP8[keyEventData + 14] = e.altKey
    HEAP8[keyEventData + 15] = e.metaKey
    HEAP8[keyEventData + 16] = e.repeat
    HEAP32[idx + 5] = e.charCode
    HEAP32[idx + 6] = e.keyCode
    HEAP32[idx + 7] = e.which
    stringToUTF8(e.key || '', keyEventData + 32, 32)
    stringToUTF8(e.code || '', keyEventData + 64, 32)
    stringToUTF8(e.char || '', keyEventData + 96, 32)
    stringToUTF8(e.locale || '', keyEventData + 128, 32)

    if (getWasmTableEntry(callbackfunc)(eventTypeId, keyEventData, userData)) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: keyEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}
const _emscripten_set_keydown_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerKeyEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    2,
    'keydown',
    targetThread
  )

const _emscripten_set_keypress_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerKeyEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    1,
    'keypress',
    targetThread
  )

const _emscripten_set_keyup_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerKeyEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    3,
    'keyup',
    targetThread
  )

const _emscripten_set_main_loop = (func, fps, simulateInfiniteLoop) => {
  const iterFunc = getWasmTableEntry(func)
  setMainLoop(iterFunc, fps, simulateInfiniteLoop)
}

const fillMouseEventData = (eventStruct, e, target) => {
  assert(eventStruct % 4 == 0)
  HEAPF64[eventStruct >> 3] = e.timeStamp
  const idx = eventStruct >> 2
  HEAP32[idx + 2] = e.screenX
  HEAP32[idx + 3] = e.screenY
  HEAP32[idx + 4] = e.clientX
  HEAP32[idx + 5] = e.clientY
  HEAP8[eventStruct + 24] = e.ctrlKey
  HEAP8[eventStruct + 25] = e.shiftKey
  HEAP8[eventStruct + 26] = e.altKey
  HEAP8[eventStruct + 27] = e.metaKey
  HEAP16[idx * 2 + 14] = e.button
  HEAP16[idx * 2 + 15] = e.buttons

  HEAP32[idx + 8] = e.movementX

  HEAP32[idx + 9] = e.movementY

  // Note: rect contains doubles (truncated to placate SAFE_HEAP, which is the same behaviour when writing to HEAP32 anyway)
  const rect = getBoundingClientRect(target)
  HEAP32[idx + 10] = e.clientX - (rect.left | 0)
  HEAP32[idx + 11] = e.clientY - (rect.top | 0)
}

const registerMouseEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 64
  JSEvents.mouseEvent ||= _malloc(eventSize)
  target = findEventTarget(target)

  const mouseEventHandlerFunc = (e) => {
    // TODO: Make this access thread safe, or this could update live while app is reading it.
    fillMouseEventData(JSEvents.mouseEvent, e, target)

    if (
      getWasmTableEntry(callbackfunc)(
        eventTypeId,
        JSEvents.mouseEvent,
        userData
      )
    ) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target,
    allowsDeferredCalls:
      eventTypeString != 'mousemove' &&
      eventTypeString != 'mouseenter' &&
      eventTypeString != 'mouseleave', // Mouse move events do not allow fullscreen/pointer lock requests to be handled in them!
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: mouseEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}
const _emscripten_set_mousedown_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    5,
    'mousedown',
    targetThread
  )

const _emscripten_set_mousemove_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    8,
    'mousemove',
    targetThread
  )

const _emscripten_set_mouseup_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerMouseEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    6,
    'mouseup',
    targetThread
  )

const registerUiEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 36
  JSEvents.uiEvent ||= _malloc(eventSize)

  target = findEventTarget(target)

  const uiEventHandlerFunc = (e) => {
    if (e.target != target) {
      // Never take ui events such as scroll via a 'bubbled' route, but always from the direct element that
      // was targeted. Otherwise e.g. if app logs a message in response to a page scroll, the Emscripten log
      // message box could cause to scroll, generating a new (bubbled) scroll message, causing a new log print,
      // causing a new scroll, etc..
      return
    }
    const b = document.body // Take document.body to a variable, Closure compiler does not outline access to it on its own.
    if (!b) {
      // During a page unload 'body' can be null, with "Cannot read property 'clientWidth' of null" being thrown
      return
    }
    const uiEvent = JSEvents.uiEvent
    HEAP32[uiEvent >> 2] = 0 // always zero for resize and scroll
    HEAP32[(uiEvent + 4) >> 2] = b.clientWidth
    HEAP32[(uiEvent + 8) >> 2] = b.clientHeight
    HEAP32[(uiEvent + 12) >> 2] = innerWidth
    HEAP32[(uiEvent + 16) >> 2] = innerHeight
    HEAP32[(uiEvent + 20) >> 2] = outerWidth
    HEAP32[(uiEvent + 24) >> 2] = outerHeight
    HEAP32[(uiEvent + 28) >> 2] = pageXOffset | 0 // scroll offsets are float
    HEAP32[(uiEvent + 32) >> 2] = pageYOffset | 0
    if (getWasmTableEntry(callbackfunc)(eventTypeId, uiEvent, userData)) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: uiEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}
const _emscripten_set_resize_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerUiEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    10,
    'resize',
    targetThread
  )

const registerTouchEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 1552
  JSEvents.touchEvent ||= _malloc(eventSize)

  target = findEventTarget(target)

  const touchEventHandlerFunc = (e) => {
    assert(e)
    let t
    const touches = {}
    const et = e.touches
    // To ease marshalling different kinds of touches that browser reports (all touches are listed in e.touches,
    // only changed touches in e.changedTouches, and touches on target at a.targetTouches), mark a boolean in
    // each Touch object so that we can later loop only once over all touches we see to marshall over to Wasm.

    for (const t of et) {
      // Browser might recycle the generated Touch objects between each frame (Firefox on Android), so reset any
      // changed/target states we may have set from previous frame.
      t.isChanged = t.onTarget = 0
      touches[t.identifier] = t
    }
    // Mark which touches are part of the changedTouches list.
    for (const t of e.changedTouches) {
      t.isChanged = 1
      touches[t.identifier] = t
    }
    // Mark which touches are part of the targetTouches list.
    for (const t of e.targetTouches) {
      touches[t.identifier].onTarget = 1
    }

    const touchEvent = JSEvents.touchEvent
    HEAPF64[touchEvent >> 3] = e.timeStamp
    HEAP8[touchEvent + 12] = e.ctrlKey
    HEAP8[touchEvent + 13] = e.shiftKey
    HEAP8[touchEvent + 14] = e.altKey
    HEAP8[touchEvent + 15] = e.metaKey
    let idx = touchEvent + 16
    const targetRect = getBoundingClientRect(target)
    let numTouches = 0
    for (const t of Object.values(touches)) {
      const idx32 = idx >> 2 // Pre-shift the ptr to index to HEAP32 to save code size
      HEAP32[idx32 + 0] = t.identifier
      HEAP32[idx32 + 1] = t.screenX
      HEAP32[idx32 + 2] = t.screenY
      HEAP32[idx32 + 3] = t.clientX
      HEAP32[idx32 + 4] = t.clientY
      HEAP32[idx32 + 5] = t.pageX
      HEAP32[idx32 + 6] = t.pageY
      HEAP8[idx + 28] = t.isChanged
      HEAP8[idx + 29] = t.onTarget
      HEAP32[idx32 + 8] = t.clientX - (targetRect.left | 0)
      HEAP32[idx32 + 9] = t.clientY - (targetRect.top | 0)

      idx += 48

      if (++numTouches > 31) {
        break
      }
    }
    HEAP32[(touchEvent + 8) >> 2] = numTouches

    if (getWasmTableEntry(callbackfunc)(eventTypeId, touchEvent, userData)) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target,
    allowsDeferredCalls:
      eventTypeString == 'touchstart' || eventTypeString == 'touchend',
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: touchEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}
const _emscripten_set_touchcancel_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerTouchEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    25,
    'touchcancel',
    targetThread
  )

const _emscripten_set_touchend_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerTouchEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    23,
    'touchend',
    targetThread
  )

const _emscripten_set_touchmove_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerTouchEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    24,
    'touchmove',
    targetThread
  )

const _emscripten_set_touchstart_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) =>
  registerTouchEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    22,
    'touchstart',
    targetThread
  )

const fillVisibilityChangeEventData = (eventStruct) => {
  const visibilityStates = ['hidden', 'visible', 'prerender', 'unloaded']
  const visibilityState = visibilityStates.indexOf(document.visibilityState)

  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */
  HEAP8[eventStruct] = document.hidden
  HEAP32[(eventStruct + 4) >> 2] = visibilityState
}

const registerVisibilityChangeEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 8
  JSEvents.visibilityChangeEvent ||= _malloc(eventSize)

  const visibilityChangeEventHandlerFunc = (e) => {
    const visibilityChangeEvent = JSEvents.visibilityChangeEvent
    fillVisibilityChangeEventData(visibilityChangeEvent)

    if (
      getWasmTableEntry(callbackfunc)(
        eventTypeId,
        visibilityChangeEvent,
        userData
      )
    ) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: visibilityChangeEventHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}

const _emscripten_set_visibilitychange_callback_on_thread = (
  userData,
  useCapture,
  callbackfunc,
  targetThread
) => {
  if (!specialHTMLTargets[1]) {
    return -4
  }
  return registerVisibilityChangeEventCallback(
    specialHTMLTargets[1],
    userData,
    useCapture,
    callbackfunc,
    21,
    'visibilitychange',
    targetThread
  )
}

const registerWebGlEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const webGlEventHandlerFunc = (e) => {
    if (getWasmTableEntry(callbackfunc)(eventTypeId, 0, userData)) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: webGlEventHandlerFunc,
    useCapture
  }
  JSEvents.registerOrRemoveHandler(eventHandler)
}

const _emscripten_set_webglcontextlost_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) => {
  registerWebGlEventCallback(
    target,
    userData,
    useCapture,
    callbackfunc,
    31,
    'webglcontextlost',
    targetThread
  )
  return 0
}

const registerWheelEventCallback = (
  target,
  userData,
  useCapture,
  callbackfunc,
  eventTypeId,
  eventTypeString,
  targetThread
) => {
  const eventSize = 96
  JSEvents.wheelEvent ||= _malloc(eventSize)

  // The DOM Level 3 events spec event 'wheel'
  const wheelHandlerFunc = (e) => {
    const wheelEvent = JSEvents.wheelEvent
    fillMouseEventData(wheelEvent, e, target)
    HEAPF64[(wheelEvent + 64) >> 3] = e.deltaX
    HEAPF64[(wheelEvent + 72) >> 3] = e.deltaY
    HEAPF64[(wheelEvent + 80) >> 3] = e.deltaZ
    HEAP32[(wheelEvent + 88) >> 2] = e.deltaMode
    if (getWasmTableEntry(callbackfunc)(eventTypeId, wheelEvent, userData)) {
      e.preventDefault()
    }
  }

  const eventHandler = {
    target,
    allowsDeferredCalls: true,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: wheelHandlerFunc,
    useCapture
  }
  return JSEvents.registerOrRemoveHandler(eventHandler)
}

const _emscripten_set_wheel_callback_on_thread = (
  target,
  userData,
  useCapture,
  callbackfunc,
  targetThread
) => {
  target = findEventTarget(target)
  if (!target) return -4
  if (typeof target.onwheel !== 'undefined') {
    return registerWheelEventCallback(
      target,
      userData,
      useCapture,
      callbackfunc,
      9,
      'wheel',
      targetThread
    )
  } else {
    return -1
  }
}

const webglPowerPreferences = ['default', 'low-power', 'high-performance']

const _emscripten_webgl_do_create_context = (target, attributes) => {
  assert(attributes)
  const attr32 = attributes >> 2
  const powerPreference = HEAP32[attr32 + (8 >> 2)]
  const contextAttributes = {
    alpha: !!HEAP8[attributes + 0],
    depth: !!HEAP8[attributes + 1],
    stencil: !!HEAP8[attributes + 2],
    antialias: !!HEAP8[attributes + 3],
    premultipliedAlpha: !!HEAP8[attributes + 4],
    preserveDrawingBuffer: !!HEAP8[attributes + 5],
    powerPreference: webglPowerPreferences[powerPreference],
    failIfMajorPerformanceCaveat: !!HEAP8[attributes + 12],
    // The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
    majorVersion: HEAP32[attr32 + (16 >> 2)],
    minorVersion: HEAP32[attr32 + (20 >> 2)],
    enableExtensionsByDefault: HEAP8[attributes + 24],
    explicitSwapControl: HEAP8[attributes + 25],
    proxyContextToMainThread: HEAP32[attr32 + (28 >> 2)],
    renderViaOffscreenBackBuffer: HEAP8[attributes + 32]
  }

  //  TODO: Make these into hard errors at some point in the future
  if (
    contextAttributes.majorVersion !== 1 &&
    contextAttributes.majorVersion !== 2
  ) {
    err(`Invalid WebGL version requested: ${contextAttributes.majorVersion}`)
  }
  if (contextAttributes.majorVersion !== 1) {
    err(
      'WebGL 2 requested but only WebGL 1 is supported (set -sMAX_WEBGL_VERSION=2 to fix the problem)'
    )
  }

  const canvas = findCanvasEventTarget(target)

  if (!canvas) {
    return 0
  }

  if (contextAttributes.explicitSwapControl) {
    return 0
  }

  const contextHandle = GL.createContext(canvas, contextAttributes)
  return contextHandle
}
const _emscripten_webgl_create_context = _emscripten_webgl_do_create_context

const _emscripten_webgl_destroy_context = (contextHandle) => {
  if (GL.currentContext == contextHandle) GL.currentContext = 0
  GL.deleteContext(contextHandle)
}

const _emscripten_webgl_make_context_current = (contextHandle) => {
  const success = GL.makeContextCurrent(contextHandle)
  return success ? 0 : -5
}

const SYSCALLS = {
  varargs: undefined,
  getStr (ptr) {
    const ret = UTF8ToString(ptr)
    return ret
  }
}
const _fd_close = (fd) => {
  abort('fd_close called without SYSCALLS_REQUIRE_FILESYSTEM')
}

function _fd_seek (fd, offset, whence, newOffset) {
  offset = bigintToI53Checked(offset)

  return 70
}

const printCharBuffers = [null, [], []]

const printChar = (stream, curr) => {
  const buffer = printCharBuffers[stream]
  assert(buffer)
  if (curr === 0 || curr === 10) {
    (stream === 1 ? out : err)(UTF8ArrayToString(buffer))
    buffer.length = 0
  } else {
    buffer.push(curr)
  }
}

const flush_NO_FILESYSTEM = () => {
  // flush anything remaining in the buffers during shutdown
  _fflush(0)
  if (printCharBuffers[1].length) printChar(1, 10)
  if (printCharBuffers[2].length) printChar(2, 10)
}

const _fd_write = (fd, iov, iovcnt, pnum) => {
  // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
  let num = 0
  for (let i = 0; i < iovcnt; i++) {
    const ptr = HEAPU32[iov >> 2]
    const len = HEAPU32[(iov + 4) >> 2]
    iov += 8
    for (let j = 0; j < len; j++) {
      printChar(fd, HEAPU8[ptr + j])
    }
    num += len
  }
  HEAPU32[pnum >> 2] = num
  return 0
}

const _emscripten_glAttachShader = (program, shader) => {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader])
}
const _glAttachShader = _emscripten_glAttachShader

const _emscripten_glBindAttribLocation = (program, index, name) => {
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name))
}
const _glBindAttribLocation = _emscripten_glBindAttribLocation

const _emscripten_glBindBuffer = (target, buffer) => {
  GLctx.bindBuffer(target, GL.buffers[buffer])
}
const _glBindBuffer = _emscripten_glBindBuffer

const _emscripten_glBindTexture = (target, texture) => {
  GLctx.bindTexture(target, GL.textures[texture])
}
const _glBindTexture = _emscripten_glBindTexture

const _emscripten_glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1)
const _glBlendFunc = _emscripten_glBlendFunc

const _emscripten_glBufferData = (target, size, data, usage) => {
  // N.b. here first form specifies a heap subarray, second form an integer
  // size, so the ?: code here is polymorphic. It is advised to avoid
  // randomly mixing both uses in calling code, to avoid any potential JS
  // engine JIT issues.
  GLctx.bufferData(
    target,
    data ? HEAPU8.subarray(data, data + size) : size,
    usage
  )
}
const _glBufferData = _emscripten_glBufferData

const _emscripten_glBufferSubData = (target, offset, size, data) => {
  GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size))
}
const _glBufferSubData = _emscripten_glBufferSubData

const _emscripten_glClear = (x0) => GLctx.clear(x0)
const _glClear = _emscripten_glClear

const _emscripten_glClearColor = (x0, x1, x2, x3) =>
  GLctx.clearColor(x0, x1, x2, x3)
const _glClearColor = _emscripten_glClearColor

const _emscripten_glColorMask = (red, green, blue, alpha) => {
  GLctx.colorMask(!!red, !!green, !!blue, !!alpha)
}
const _glColorMask = _emscripten_glColorMask

const _emscripten_glCompileShader = (shader) => {
  GLctx.compileShader(GL.shaders[shader])
}
const _glCompileShader = _emscripten_glCompileShader

const _emscripten_glCreateProgram = () => {
  const id = GL.getNewId(GL.programs)
  const program = GLctx.createProgram()
  // Store additional information needed for each shader program:
  program.name = id
  // Lazy cache results of
  // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
  program.maxUniformLength =
    program.maxAttributeLength =
    program.maxUniformBlockNameLength =
      0
  program.uniformIdCounter = 1
  GL.programs[id] = program
  return id
}
const _glCreateProgram = _emscripten_glCreateProgram

const _emscripten_glCreateShader = (shaderType) => {
  const id = GL.getNewId(GL.shaders)
  GL.shaders[id] = GLctx.createShader(shaderType)

  return id
}
const _glCreateShader = _emscripten_glCreateShader

const _emscripten_glDeleteBuffers = (n, buffers) => {
  for (let i = 0; i < n; i++) {
    const id = HEAP32[(buffers + i * 4) >> 2]
    const buffer = GL.buffers[id]

    // From spec: "glDeleteBuffers silently ignores 0's and names that do not
    // correspond to existing buffer objects."
    if (!buffer) continue

    GLctx.deleteBuffer(buffer)
    buffer.name = 0
    GL.buffers[id] = null
  }
}
const _glDeleteBuffers = _emscripten_glDeleteBuffers

const _emscripten_glDeleteProgram = (id) => {
  if (!id) return
  const program = GL.programs[id]
  if (!program) {
    // glDeleteProgram actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(0x501 /* GL_INVALID_VALUE */)
    return
  }
  GLctx.deleteProgram(program)
  program.name = 0
  GL.programs[id] = null
}
const _glDeleteProgram = _emscripten_glDeleteProgram

const _emscripten_glDeleteShader = (id) => {
  if (!id) return
  const shader = GL.shaders[id]
  if (!shader) {
    // glDeleteShader actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(0x501 /* GL_INVALID_VALUE */)
    return
  }
  GLctx.deleteShader(shader)
  GL.shaders[id] = null
}
const _glDeleteShader = _emscripten_glDeleteShader

const _emscripten_glDeleteTextures = (n, textures) => {
  for (let i = 0; i < n; i++) {
    const id = HEAP32[(textures + i * 4) >> 2]
    const texture = GL.textures[id]
    // GL spec: "glDeleteTextures silently ignores 0s and names that do not
    // correspond to existing textures".
    if (!texture) continue
    GLctx.deleteTexture(texture)
    texture.name = 0
    GL.textures[id] = null
  }
}
const _glDeleteTextures = _emscripten_glDeleteTextures

const _emscripten_glDepthFunc = (x0) => GLctx.depthFunc(x0)
const _glDepthFunc = _emscripten_glDepthFunc

const _emscripten_glDepthMask = (flag) => {
  GLctx.depthMask(!!flag)
}
const _glDepthMask = _emscripten_glDepthMask

const _emscripten_glDetachShader = (program, shader) => {
  GLctx.detachShader(GL.programs[program], GL.shaders[shader])
}
const _glDetachShader = _emscripten_glDetachShader

const _emscripten_glDisable = (x0) => GLctx.disable(x0)
const _glDisable = _emscripten_glDisable

const _emscripten_glDisableVertexAttribArray = (index) => {
  GLctx.disableVertexAttribArray(index)
}
const _glDisableVertexAttribArray = _emscripten_glDisableVertexAttribArray

const _emscripten_glDrawArrays = (mode, first, count) => {
  GLctx.drawArrays(mode, first, count)
}
const _glDrawArrays = _emscripten_glDrawArrays

const _emscripten_glDrawElements = (mode, count, type, indices) => {
  GLctx.drawElements(mode, count, type, indices)
}
const _glDrawElements = _emscripten_glDrawElements

const _emscripten_glEnable = (x0) => GLctx.enable(x0)
const _glEnable = _emscripten_glEnable

const _emscripten_glEnableVertexAttribArray = (index) => {
  GLctx.enableVertexAttribArray(index)
}
const _glEnableVertexAttribArray = _emscripten_glEnableVertexAttribArray

const _emscripten_glGenBuffers = (n, buffers) => {
  GL.genObject(n, buffers, 'createBuffer', GL.buffers)
}
const _glGenBuffers = _emscripten_glGenBuffers

const _emscripten_glGenTextures = (n, textures) => {
  GL.genObject(n, textures, 'createTexture', GL.textures)
}
const _glGenTextures = _emscripten_glGenTextures

const readI53FromI64 = (ptr) => {
  return HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296
}

const readI53FromU64 = (ptr) => {
  return HEAPU32[ptr >> 2] + HEAPU32[(ptr + 4) >> 2] * 4294967296
}
const writeI53ToI64 = (ptr, num) => {
  HEAPU32[ptr >> 2] = num
  const lower = HEAPU32[ptr >> 2]
  HEAPU32[(ptr + 4) >> 2] = (num - lower) / 4294967296
  const deserialized = num >= 0 ? readI53FromU64(ptr) : readI53FromI64(ptr)
  const offset = ptr >> 2
  if (deserialized != num) {
    warnOnce(
      `writeI53ToI64() out of range: serialized JS Number ${num} to Wasm heap as bytes lo=${ptrToString(HEAPU32[offset])}, hi=${ptrToString(HEAPU32[offset + 1])}, which deserializes back to ${deserialized} instead!`
    )
  }
}

const emscriptenWebGLGet = (name_, p, type) => {
  // Guard against user passing a null pointer.
  // Note that GLES2 spec does not say anything about how passing a null
  // pointer should be treated.  Testing on desktop core GL 3, the application
  // crashes on glGetIntegerv to a null pointer, but better to report an error
  // instead of doing anything random.
  if (!p) {
    GL.recordError(0x501 /* GL_INVALID_VALUE */)
    return
  }
  let ret
  switch (
    name_ // Handle a few trivial GLES values
  ) {
    case 0x8dfa: // GL_SHADER_COMPILER
      ret = 1
      break
    case 0x8df8: // GL_SHADER_BINARY_FORMATS
      if (type != 0 && type != 1) {
        GL.recordError(0x500) // GL_INVALID_ENUM
      }
      // Do not write anything to the out pointer, since no binary formats are
      // supported.
      return
    case 0x8df9: // GL_NUM_SHADER_BINARY_FORMATS
      ret = 0
      break
    case 0x86a2: // GL_NUM_COMPRESSED_TEXTURE_FORMATS
      // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
      // since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
      // queried for length), so implement it ourselves to allow C++ GLES2
      // code to get the length.
      var formats = GLctx.getParameter(
        0x86a3 /* GL_COMPRESSED_TEXTURE_FORMATS */
      )
      ret = formats ? formats.length : 0
      break
  }

  if (ret === undefined) {
    const result = GLctx.getParameter(name_)
    switch (typeof result) {
      case 'number':
        ret = result
        break
      case 'boolean':
        ret = result ? 1 : 0
        break
      case 'string':
        GL.recordError(0x500) // GL_INVALID_ENUM
        return
      case 'object':
        if (result === null) {
          // null is a valid result for some (e.g., which buffer is bound -
          // perhaps nothing is bound), but otherwise can mean an invalid
          // name_, which we need to report as an error
          switch (name_) {
            case 0x8894: // ARRAY_BUFFER_BINDING
            case 0x8b8d: // CURRENT_PROGRAM
            case 0x8895: // ELEMENT_ARRAY_BUFFER_BINDING
            case 0x8ca6: // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
            case 0x8ca7: // RENDERBUFFER_BINDING
            case 0x8069: // TEXTURE_BINDING_2D
            case 0x85b5: // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
            case 0x8514: {
              // TEXTURE_BINDING_CUBE_MAP
              ret = 0
              break
            }
            default: {
              GL.recordError(0x500) // GL_INVALID_ENUM
              return
            }
          }
        } else if (
          result instanceof Float32Array ||
          result instanceof Uint32Array ||
          result instanceof Int32Array ||
          result instanceof Array
        ) {
          for (let i = 0; i < result.length; ++i) {
            switch (type) {
              case 0:
                HEAP32[(p + i * 4) >> 2] = result[i]
                break
              case 2:
                HEAPF32[(p + i * 4) >> 2] = result[i]
                break
              case 4:
                HEAP8[p + i] = result[i] ? 1 : 0
                break
            }
          }
          return
        } else {
          try {
            ret = result.name | 0
          } catch (e) {
            GL.recordError(0x500) // GL_INVALID_ENUM
            err(
              `GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`
            )
            return
          }
        }
        break
      default:
        GL.recordError(0x500) // GL_INVALID_ENUM
        err(
          `GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof result}!`
        )
        return
    }
  }

  switch (type) {
    case 1:
      writeI53ToI64(p, ret)
      break
    case 0:
      HEAP32[p >> 2] = ret
      break
    case 2:
      HEAPF32[p >> 2] = ret
      break
    case 4:
      HEAP8[p] = ret ? 1 : 0
      break
  }
}

const _emscripten_glGetIntegerv = (name_, p) => emscriptenWebGLGet(name_, p, 0)
const _glGetIntegerv = _emscripten_glGetIntegerv

const _emscripten_glGetProgramInfoLog = (
  program,
  maxLength,
  length,
  infoLog
) => {
  let log = GLctx.getProgramInfoLog(GL.programs[program])
  if (log === null) log = '(unknown error)'
  const numBytesWrittenExclNull =
    maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull
}
const _glGetProgramInfoLog = _emscripten_glGetProgramInfoLog

const _emscripten_glGetProgramiv = (program, pname, p) => {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(0x501 /* GL_INVALID_VALUE */)
    return
  }

  if (program >= GL.counter) {
    GL.recordError(0x501 /* GL_INVALID_VALUE */)
    return
  }

  program = GL.programs[program]

  if (pname == 0x8b84) {
    // GL_INFO_LOG_LENGTH
    let log = GLctx.getProgramInfoLog(program)
    if (log === null) log = '(unknown error)'
    HEAP32[p >> 2] = log.length + 1
  } else if (pname == 0x8b87 /* GL_ACTIVE_UNIFORM_MAX_LENGTH */) {
    if (!program.maxUniformLength) {
      const numActiveUniforms = GLctx.getProgramParameter(
        program,
        0x8b86 /* GL_ACTIVE_UNIFORMS */
      )
      for (var i = 0; i < numActiveUniforms; ++i) {
        program.maxUniformLength = Math.max(
          program.maxUniformLength,
          GLctx.getActiveUniform(program, i).name.length + 1
        )
      }
    }
    HEAP32[p >> 2] = program.maxUniformLength
  } else if (pname == 0x8b8a /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */) {
    if (!program.maxAttributeLength) {
      const numActiveAttributes = GLctx.getProgramParameter(
        program,
        0x8b89 /* GL_ACTIVE_ATTRIBUTES */
      )
      for (var i = 0; i < numActiveAttributes; ++i) {
        program.maxAttributeLength = Math.max(
          program.maxAttributeLength,
          GLctx.getActiveAttrib(program, i).name.length + 1
        )
      }
    }
    HEAP32[p >> 2] = program.maxAttributeLength
  } else if (pname == 0x8a35 /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */) {
    if (!program.maxUniformBlockNameLength) {
      const numActiveUniformBlocks = GLctx.getProgramParameter(
        program,
        0x8a36 /* GL_ACTIVE_UNIFORM_BLOCKS */
      )
      for (var i = 0; i < numActiveUniformBlocks; ++i) {
        program.maxUniformBlockNameLength = Math.max(
          program.maxUniformBlockNameLength,
          GLctx.getActiveUniformBlockName(program, i).length + 1
        )
      }
    }
    HEAP32[p >> 2] = program.maxUniformBlockNameLength
  } else {
    HEAP32[p >> 2] = GLctx.getProgramParameter(program, pname)
  }
}
const _glGetProgramiv = _emscripten_glGetProgramiv

const _emscripten_glGetShaderInfoLog = (shader, maxLength, length, infoLog) => {
  let log = GLctx.getShaderInfoLog(GL.shaders[shader])
  if (log === null) log = '(unknown error)'
  const numBytesWrittenExclNull =
    maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull
}
const _glGetShaderInfoLog = _emscripten_glGetShaderInfoLog

const _emscripten_glGetShaderiv = (shader, pname, p) => {
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(0x501 /* GL_INVALID_VALUE */)
    return
  }
  if (pname == 0x8b84) {
    // GL_INFO_LOG_LENGTH
    let log = GLctx.getShaderInfoLog(GL.shaders[shader])
    if (log === null) log = '(unknown error)'
    // The GLES2 specification says that if the shader has an empty info log,
    // a value of 0 is returned. Otherwise the log has a null char appended.
    // (An empty string is falsey, so we can just check that instead of
    // looking at log.length.)
    const logLength = log ? log.length + 1 : 0
    HEAP32[p >> 2] = logLength
  } else if (pname == 0x8b88) {
    // GL_SHADER_SOURCE_LENGTH
    const source = GLctx.getShaderSource(GL.shaders[shader])
    // source may be a null, or the empty string, both of which are falsey
    // values that we report a 0 length for.
    const sourceLength = source ? source.length + 1 : 0
    HEAP32[p >> 2] = sourceLength
  } else {
    HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname)
  }
}
const _glGetShaderiv = _emscripten_glGetShaderiv

const stringToNewUTF8 = (str) => {
  const size = lengthBytesUTF8(str) + 1
  const ret = _malloc(size)
  if (ret) stringToUTF8(str, ret, size)
  return ret
}

const webglGetExtensions = () => {
  let exts = getEmscriptenSupportedExtensions(GLctx)
  exts = exts.concat(exts.map((e) => 'GL_' + e))
  return exts
}

const _emscripten_glGetString = (name_) => {
  let ret = GL.stringCache[name_]
  if (!ret) {
    switch (name_) {
      case 0x1f03 /* GL_EXTENSIONS */:
        ret = stringToNewUTF8(webglGetExtensions().join(' '))
        break
      case 0x1f00 /* GL_VENDOR */:
      case 0x1f01 /* GL_RENDERER */:
      case 0x9245 /* UNMASKED_VENDOR_WEBGL */:
      case 0x9246 /* UNMASKED_RENDERER_WEBGL */:
        var s = GLctx.getParameter(name_)
        if (!s) {
          GL.recordError(0x500 /* GL_INVALID_ENUM */)
        }
        ret = s ? stringToNewUTF8(s) : 0
        break

      case 0x1f02 /* GL_VERSION */:
        var webGLVersion = GLctx.getParameter(0x1f02 /* GL_VERSION */)
        // return GLES version string corresponding to the version of the WebGL context
        var glVersion = `OpenGL ES 2.0 (${webGLVersion})`
        ret = stringToNewUTF8(glVersion)
        break
      case 0x8b8c /* GL_SHADING_LANGUAGE_VERSION */:
        var glslVersion = GLctx.getParameter(
          0x8b8c /* GL_SHADING_LANGUAGE_VERSION */
        )
        // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
        var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/
        var ver_num = glslVersion.match(ver_re)
        if (ver_num !== null) {
          if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + '0' // ensure minor version has 2 digits
          glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`
        }
        ret = stringToNewUTF8(glslVersion)
        break
      default:
        GL.recordError(0x500 /* GL_INVALID_ENUM */)
      // fall through
    }
    GL.stringCache[name_] = ret
  }
  return ret
}
const _glGetString = _emscripten_glGetString

/** @suppress {checkTypes} */
const jstoi_q = (str) => parseInt(str)

/** @noinline */
const webglGetLeftBracePos = (name) =>
  name.slice(-1) == ']' && name.lastIndexOf('[')

const webglPrepareUniformLocationsBeforeFirstUse = (program) => {
  let uniformLocsById = program.uniformLocsById // Maps GLuint -> WebGLUniformLocation
  const uniformSizeAndIdsByName = program.uniformSizeAndIdsByName // Maps name -> [uniform array length, GLuint]
  let i
  let j

  // On the first time invocation of glGetUniformLocation on this shader program:
  // initialize cache data structures and discover which uniforms are arrays.
  if (!uniformLocsById) {
    // maps GLint integer locations to WebGLUniformLocations
    program.uniformLocsById = uniformLocsById = {}
    // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
    program.uniformArrayNamesById = {}

    const numActiveUniforms = GLctx.getProgramParameter(
      program,
      0x8b86 /* GL_ACTIVE_UNIFORMS */
    )
    for (i = 0; i < numActiveUniforms; ++i) {
      const u = GLctx.getActiveUniform(program, i)
      const nm = u.name
      const sz = u.size
      const lb = webglGetLeftBracePos(nm)
      const arrayName = lb > 0 ? nm.slice(0, lb) : nm

      // Assign a new location.
      let id = program.uniformIdCounter
      program.uniformIdCounter += sz
      // Eagerly get the location of the uniformArray[0] base element.
      // The remaining indices >0 will be left for lazy evaluation to
      // improve performance. Those may never be needed to fetch, if the
      // application fills arrays always in full starting from the first
      // element of the array.
      uniformSizeAndIdsByName[arrayName] = [sz, id]

      // Store placeholder integers in place that highlight that these
      // >0 index locations are array indices pending population.
      for (j = 0; j < sz; ++j) {
        uniformLocsById[id] = j
        program.uniformArrayNamesById[id++] = arrayName
      }
    }
  }
}

const _emscripten_glGetUniformLocation = (program, name) => {
  name = UTF8ToString(name)

  if ((program = GL.programs[program])) {
    webglPrepareUniformLocationsBeforeFirstUse(program)
    const uniformLocsById = program.uniformLocsById // Maps GLuint -> WebGLUniformLocation
    let arrayIndex = 0
    let uniformBaseName = name

    // Invariant: when populating integer IDs for uniform locations, we must
    // maintain the precondition that arrays reside in contiguous addresses,
    // i.e. for a 'vec4 colors[10];', colors[4] must be at location
    // colors[0]+4.  However, user might call glGetUniformLocation(program,
    // "colors") for an array, so we cannot discover based on the user input
    // arguments whether the uniform we are dealing with is an array. The only
    // way to discover which uniforms are arrays is to enumerate over all the
    // active uniforms in the program.
    const leftBrace = webglGetLeftBracePos(name)

    // If user passed an array accessor "[index]", parse the array index off the accessor.
    if (leftBrace > 0) {
      arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0 // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
      uniformBaseName = name.slice(0, leftBrace)
    }

    // Have we cached the location of this uniform before?
    // A pair [array length, GLint of the uniform location]
    const sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName]

    // If a uniform with this name exists, and if its index is within the
    // array limits (if it's even an array), query the WebGLlocation, or
    // return an existing cached location.
    if (sizeAndId && arrayIndex < sizeAndId[0]) {
      arrayIndex += sizeAndId[1] // Add the base location of the uniform to the array index offset.
      if (
        (uniformLocsById[arrayIndex] =
          uniformLocsById[arrayIndex] ||
          GLctx.getUniformLocation(program, name))
      ) {
        return arrayIndex
      }
    }
  } else {
    // N.b. we are currently unable to distinguish between GL program IDs that
    // never existed vs GL program IDs that have been deleted, so report
    // GL_INVALID_VALUE in both cases.
    GL.recordError(0x501 /* GL_INVALID_VALUE */)
  }
  return -1
}
const _glGetUniformLocation = _emscripten_glGetUniformLocation

const _emscripten_glLinkProgram = (program) => {
  program = GL.programs[program]
  GLctx.linkProgram(program)
  // Invalidate earlier computed uniform->ID mappings, those have now become stale
  program.uniformLocsById = 0 // Mark as null-like so that glGetUniformLocation() knows to populate this again.
  program.uniformSizeAndIdsByName = {}
}
const _glLinkProgram = _emscripten_glLinkProgram

const _emscripten_glShaderSource = (shader, count, string, length) => {
  const source = GL.getSource(shader, count, string, length)

  GLctx.shaderSource(GL.shaders[shader], source)
}
const _glShaderSource = _emscripten_glShaderSource

const computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
  function roundedToNextMultipleOf (x, y) {
    return (x + y - 1) & -y
  }
  const plainRowSize = (GL.unpackRowLength || width) * sizePerPixel
  const alignedRowSize = roundedToNextMultipleOf(
    plainRowSize,
    GL.unpackAlignment
  )
  return height * alignedRowSize
}

const colorChannelsInGlTextureFormat = (format) => {
  // Micro-optimizations for size: map format to size by subtracting smallest
  // enum value (0x1902) from all values first.  Also omit the most common
  // size value (1) from the list, which is assumed by formats not on the
  // list.
  const colorChannels = {
    // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
    // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
    5: 3,
    6: 4,
    // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
    8: 2,
    29502: 3,
    29504: 4
  }
  return colorChannels[format - 0x1902] || 1
}

const heapObjectForWebGLType = (type) => {
  // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
  // smaller values for the heap, for shorter generated code size.
  // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
  // (since most types are HEAPU16)
  type -= 0x1400

  if (type == 1) return HEAPU8

  if (type == 4) return HEAP32

  if (type == 6) return HEAPF32

  if (type == 5 || type == 28922) return HEAPU32

  return HEAPU16
}

const toTypedArrayIndex = (pointer, heap) =>
  pointer >>> (31 - Math.clz32(heap.BYTES_PER_ELEMENT))

const emscriptenWebGLGetTexPixelData = (
  type,
  format,
  width,
  height,
  pixels,
  internalFormat
) => {
  const heap = heapObjectForWebGLType(type)
  const sizePerPixel =
    colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT
  const bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel)
  return heap.subarray(
    toTypedArrayIndex(pixels, heap),
    toTypedArrayIndex(pixels + bytes, heap)
  )
}

const _emscripten_glTexImage2D = (
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  format,
  type,
  pixels
) => {
  const pixelData = pixels
    ? emscriptenWebGLGetTexPixelData(
      type,
      format,
      width,
      height,
      pixels,
      internalFormat
    )
    : null
  GLctx.texImage2D(
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    format,
    type,
    pixelData
  )
}
const _glTexImage2D = _emscripten_glTexImage2D

const _emscripten_glTexParameteri = (x0, x1, x2) =>
  GLctx.texParameteri(x0, x1, x2)
const _glTexParameteri = _emscripten_glTexParameteri

const _emscripten_glTexSubImage2D = (
  target,
  level,
  xoffset,
  yoffset,
  width,
  height,
  format,
  type,
  pixels
) => {
  const pixelData = pixels
    ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0)
    : null
  GLctx.texSubImage2D(
    target,
    level,
    xoffset,
    yoffset,
    width,
    height,
    format,
    type,
    pixelData
  )
}
const _glTexSubImage2D = _emscripten_glTexSubImage2D

const webglGetUniformLocation = (location) => {
  const p = GLctx.currentProgram

  if (p) {
    let webglLoc = p.uniformLocsById[location]
    // p.uniformLocsById[location] stores either an integer, or a
    // WebGLUniformLocation.
    // If an integer, we have not yet bound the location, so do it now. The
    // integer value specifies the array index we should bind to.
    if (typeof webglLoc === 'number') {
      p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(
        p,
        p.uniformArrayNamesById[location] +
          (webglLoc > 0 ? `[${webglLoc}]` : '')
      )
    }
    // Else an already cached WebGLUniformLocation, return it.
    return webglLoc
  } else {
    GL.recordError(0x502 /* GL_INVALID_OPERATION */)
  }
}

const _emscripten_glUniform1f = (location, v0) => {
  GLctx.uniform1f(webglGetUniformLocation(location), v0)
}
const _glUniform1f = _emscripten_glUniform1f

const _emscripten_glUniform2f = (location, v0, v1) => {
  GLctx.uniform2f(webglGetUniformLocation(location), v0, v1)
}
const _glUniform2f = _emscripten_glUniform2f

const _emscripten_glUniform3f = (location, v0, v1, v2) => {
  GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2)
}
const _glUniform3f = _emscripten_glUniform3f

const miniTempWebGLFloatBuffers = []

const _emscripten_glUniformMatrix4fv = (location, count, transpose, value) => {
  if (count <= 18) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[16 * count]
    // hoist the heap out of the loop for size and for pthreads+growth.
    const heap = HEAPF32
    value = value >> 2
    count *= 16
    for (let i = 0; i < count; i += 16) {
      const dst = value + i
      view[i] = heap[dst]
      view[i + 1] = heap[dst + 1]
      view[i + 2] = heap[dst + 2]
      view[i + 3] = heap[dst + 3]
      view[i + 4] = heap[dst + 4]
      view[i + 5] = heap[dst + 5]
      view[i + 6] = heap[dst + 6]
      view[i + 7] = heap[dst + 7]
      view[i + 8] = heap[dst + 8]
      view[i + 9] = heap[dst + 9]
      view[i + 10] = heap[dst + 10]
      view[i + 11] = heap[dst + 11]
      view[i + 12] = heap[dst + 12]
      view[i + 13] = heap[dst + 13]
      view[i + 14] = heap[dst + 14]
      view[i + 15] = heap[dst + 15]
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 64) >> 2)
  }
  GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, view)
}
const _glUniformMatrix4fv = _emscripten_glUniformMatrix4fv

const _emscripten_glUseProgram = (program) => {
  program = GL.programs[program]
  GLctx.useProgram(program)
  // Record the currently active program so that we can access the uniform
  // mapping table of that program.
  GLctx.currentProgram = program
}
const _glUseProgram = _emscripten_glUseProgram

const _emscripten_glVertexAttribPointer = (
  index,
  size,
  type,
  normalized,
  stride,
  ptr
) => {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr)
}
const _glVertexAttribPointer = _emscripten_glVertexAttribPointer

const _emscripten_glViewport = (x0, x1, x2, x3) =>
  GLctx.viewport(x0, x1, x2, x3)
const _glViewport = _emscripten_glViewport

function _interop_AddClipboardListeners () {
  // Copy text, but only if user isn't selecting something else on the webpage
  // (don't check window.clipboardData here, that's handled in interop_TrySetClipboardText instead)
  window.addEventListener('copy', function (e) {
    if (window.getSelection && window.getSelection().toString()) return
    _interop_callVoidFunc('Window_RequestClipboardText')
    if (!window.cc_copyText) return

    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', window.cc_copyText)
      e.preventDefault()
    }
    window.cc_copyText = null
  })

  // Paste text (window.clipboardData is handled in interop_TryGetClipboardText instead)
  window.addEventListener('paste', function (e) {
    if (e.clipboardData) {
      const contents = e.clipboardData.getData('text/plain')
      _interop_callStringFunc('Window_GotClipboardText', contents)
    }
  })
}

function _interop_AdjustXY (x, y) {
  const canvasRect = Module.canvas.getBoundingClientRect()
  HEAP32[x >> 2] = HEAP32[x >> 2] - canvasRect.left
  HEAP32[y >> 2] = HEAP32[y >> 2] - canvasRect.top
}

function _fetchTexturePackAsync (url, onload, onerror) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url)
  xhr.responseType = 'arraybuffer'
  xhr.onerror = onerror

  xhr.onload = function () {
    if (xhr.status == 200) {
      onload(xhr.response)
    } else {
      onerror()
    }
  }
  xhr.send()
}

function _interop_AsyncDownloadTexturePack (rawPath) {
  const path = UTF8ToString(rawPath)
  const url = '/static/default.zip'
  Module.setStatus('Downloading textures.. (1/2)')

  _fetchTexturePackAsync(
    url,
    function (buffer) {
      CCFS.writeFile(path, new Uint8Array(buffer))
      _interop_callVoidFunc('main_phase1')
    },
    function () {
      _interop_callVoidFunc('main_phase1')
    }
  )
}

function _IDBFS_getDB (callback) {
  let db = window.IDBFS_db
  if (db) return callback(null, db)

  IDBFS_DB_VERSION = 21
  IDBFS_DB_STORE_NAME = 'FILE_DATA'

  const idb =
    window.indexedDB ||
    window.mozIndexedDB ||
    window.webkitIndexedDB ||
    window.msIndexedDB
  if (!idb) return callback('IndexedDB unsupported')

  let req
  try {
    req = idb.open('/classicube', IDBFS_DB_VERSION)
  } catch (e) {
    return callback(e)
  }
  if (!req) return callback('Unable to connect to IndexedDB')

  req.onupgradeneeded = function (e) {
    const db = e.target.result
    const transaction = e.target.transaction
    let fileStore

    if (db.objectStoreNames.contains(IDBFS_DB_STORE_NAME)) {
      fileStore = transaction.objectStore(IDBFS_DB_STORE_NAME)
    } else {
      fileStore = db.createObjectStore(IDBFS_DB_STORE_NAME)
    }

    if (!fileStore.indexNames.contains('timestamp')) {
      fileStore.createIndex('timestamp', 'timestamp', { unique: false })
    }
  }
  req.onsuccess = function () {
    db = req.result
    window.IDBFS_db = db
    // browser will sometimes close IndexedDB connection behind the scenes
    db.onclose = function (ev) {
      console.log('IndexedDB connection closed unexpectedly!')
      window.IDBFS_db = null
    }
    callback(null, db)
  }
  req.onerror = function (e) {
    callback(this.error)
    e.preventDefault()
  }
}
function _IDBFS_getRemoteSet (callback) {
  const entries = {}

  _IDBFS_getDB(function (err, db) {
    if (err) return callback(err)

    try {
      const transaction = db.transaction([IDBFS_DB_STORE_NAME], 'readonly')
      transaction.onerror = function (e) {
        callback(this.error)
        e.preventDefault()
      }

      const store = transaction.objectStore(IDBFS_DB_STORE_NAME)
      const index = store.index('timestamp')

      index.openKeyCursor().onsuccess = function (event) {
        const cursor = event.target.result

        if (!cursor) {
          return callback(null, { type: 'remote', db, entries })
        }

        entries[cursor.primaryKey] = { timestamp: cursor.key }
        cursor.continue()
      }
    } catch (e) {
      return callback(e)
    }
  })
}

function _IDBFS_loadRemoteEntry (store, path, callback) {
  const req = store.get(path)
  req.onsuccess = function (event) {
    callback(null, event.target.result)
  }
  req.onerror = function (e) {
    callback(this.error)
    e.preventDefault()
  }
}

function _IDBFS_storeLocalEntry (path, entry, callback) {
  try {
    // ignore directories from IndexedDB created in older game versions
    if (CCFS.isFile(entry.mode)) {
      CCFS.writeFile(path, entry.contents)
      CCFS.utime(path, entry.timestamp)
    }
  } catch (e) {
    return callback(e)
  }

  callback(null)
}
function _IDBFS_reconcile (src, callback) {
  let total = 0
  const create = []

  Object.keys(src.entries).forEach(function (key) {
    create.push(key)
    total++
  })
  if (!total) return callback(null)

  const errored = false
  let completed = 0
  const transaction = src.db.transaction([IDBFS_DB_STORE_NAME], 'readwrite')
  const store = transaction.objectStore(IDBFS_DB_STORE_NAME)

  function done (err) {
    if (err) {
      if (!done.errored) {
        done.errored = true
        return callback(err)
      }
      return
    }
    if (++completed >= total) {
      return callback(null)
    }
  }

  transaction.onerror = function (e) {
    done(this.error)
    e.preventDefault()
  }

  // sort paths in ascending order so directory entries are created
  // before the files inside them
  create.sort().forEach(function (path) {
    _IDBFS_loadRemoteEntry(store, path, function (err, entry) {
      if (err) return done(err)
      _IDBFS_storeLocalEntry(path, entry, done)
    })
  })
}
function _IDBFS_loadFS (callback) {
  _IDBFS_getRemoteSet(function (err, remote) {
    if (err) return callback(err)
    _IDBFS_reconcile(remote, callback)
  })
}
function _interop_AsyncLoadIndexedDB () {
  Module.setStatus('Preloading filesystem.. (2/2)')

  _IDBFS_loadFS(function (err) {
    if (err) window.cc_idbErr = err
    Module.setStatus('')
    _interop_callVoidFunc('main_phase2')
  })
}

function _interop_AudioClose (ctxID) {
  const src = AUDIO.sources[(ctxID - 1) | 0]
  if (src.source) src.source.stop()
  AUDIO.sources[(ctxID - 1) | 0] = null
}

function _interop_AudioCreate () {
  const src = {
    source: null,
    gain: AUDIO.context.createGain(),
    playing: false
  }
  AUDIO.sources.push(src)
  return AUDIO.sources.length | 0
  // NOTE: 0 is used by Audio.c for "no source"
}

function _interop_AudioDescribe (errCode, buffer, bufferLen) {
  if (errCode > AUDIO.errors.length) return 0

  const str = AUDIO.errors[errCode - 1]
  return stringToUTF8(str, buffer, bufferLen)
}

function _interop_AudioDownload (name) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', '/static/sounds/' + name + '.wav', true)
  xhr.responseType = 'arraybuffer'

  xhr.onload = function () {
    const data = xhr.response
    AUDIO.context.decodeAudioData(data, function (buffer) {
      AUDIO.buffers[name] = buffer
    })
  }
  xhr.send()
}

function _interop_AudioPlay (ctxID, sndID, rate) {
  const src = AUDIO.sources[(ctxID - 1) | 0]
  const name = UTF8ToString(sndID)

  // do we need to download this file?
  if (!AUDIO.seen.hasOwnProperty(name)) {
    AUDIO.seen[name] = true
    _interop_AudioDownload(name)
    return 0
  }

  // still downloading or failed to download this file
  const buffer = AUDIO.buffers[name]
  if (!buffer) return 0

  try {
    // AudioBufferSourceNode only allows the buffer property
    //  to be assigned *ONCE* (throws InvalidStateError next time)
    // MDN says that these nodes are very inexpensive to create though
    //  https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
    src.source = AUDIO.context.createBufferSource()
    src.source.buffer = buffer
    src.source.playbackRate.value = rate / 100

    // source -> gain -> output
    src.source.connect(src.gain)
    src.gain.connect(AUDIO.context.destination)
    src.source.start()
    return 0
  } catch (err) {
    return _interop_AudioLog(err)
  }
}

function _interop_AudioPoll (ctxID, inUse) {
  const src = AUDIO.sources[(ctxID - 1) | 0]
  HEAP32[inUse >> 2] = src.playing // only 1 buffer
  return 0
}

function _interop_AudioVolume (ctxID, volume) {
  const src = AUDIO.sources[(ctxID - 1) | 0]
  src.gain.gain.value = volume / 100
}

function _interop_CanvasHeight () {
  return Module.canvas.height
}

function _interop_CanvasWidth () {
  return Module.canvas.width
}

function _interop_CloseKeyboard () {
  if (!window.cc_inputElem) return
  window.cc_container.removeChild(window.cc_divElem)
  window.cc_container.removeChild(window.cc_inputElem)
  window.cc_divElem = null
  window.cc_inputElem = null
}

function _interop_DirectoryIter (raw) {
  var path = UTF8ToString(raw)
  try {
    const entries = CCFS.readdir(path)
    for (let i = 0; i < entries.length; i++) {
      var path = entries[i]
      // absolute path to root relative path
      if (path.indexOf(CCFS.currentPath) === 0) {
        path = path.substring(CCFS.currentPath.length + 1)
      }
      _interop_callStringFunc('Directory_IterCallback', path)
    }
    return 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return -e.errno
  }
}

function _interop_DirectorySetWorking (raw) {
  const path = UTF8ToString(raw)
  CCFS.chdir(path)
}

function _interop_DownloadAsync (urlStr, method, reqID) {
  // onFinished = FUNC(data, len, status)
  // onProgress = FUNC(read, total)
  const url = UTF8ToString(urlStr)
  const reqMethod = method == 1 ? 'HEAD' : 'GET'
  const onFinished = Module._Http_OnFinishedAsync
  const onProgress = Module._Http_OnUpdateProgress

  const xhr = new XMLHttpRequest()
  try {
    xhr.open(reqMethod, url)
  } catch (e) {
    // DOMException gets thrown when invalid URL provided. Test cases:
    //   http://%7https://www.example.com/test.zip
    //   http://example:app/test.zip
    console.log(e)
    return 1
  }
  xhr.responseType = 'arraybuffer'

  const getContentLength = function (e) {
    if (e.total) return e.total

    try {
      const len = xhr.getResponseHeader('Content-Length')
      return parseInt(len, 10)
    } catch (ex) {
      return 0
    }
  }

  xhr.onload = function (e) {
    const src = new Uint8Array(xhr.response)
    const len = src.byteLength
    const data = _malloc(len)
    HEAPU8.set(src, data)
    onFinished(reqID, data, len || getContentLength(e), xhr.status)
  }
  xhr.onerror = function (e) {
    onFinished(reqID, 0, 0, xhr.status)
  }
  xhr.ontimeout = function (e) {
    onFinished(reqID, 0, 0, xhr.status)
  }
  xhr.onprogress = function (e) {
    onProgress(reqID, e.loaded, e.total)
  }

  try {
    xhr.send()
  } catch (e) {
    onFinished(reqID, 0, 0, 0)
  }
  return 0
}

function _interop_SaveBlob (blob, name) {
  if (window.navigator.msSaveBlob) {
    window.navigator.msSaveBlob(blob, name)
    return
  }
  const url = window.URL.createObjectURL(blob)
  const elem = document.createElement('a')

  elem.href = url
  elem.download = name
  elem.style.display = 'none'

  document.body.appendChild(elem)
  elem.click()
  document.body.removeChild(elem)
  window.URL.revokeObjectURL(url)
}

function _interop_ShowSaveDialog (filename, filters, titles) {
  // not supported by all browsers
  if (!window.showSaveFilePicker) return 0

  const fileTypes = []
  for (let i = 0; HEAP32[((filters >> 2) + i) | 0]; i++) {
    const filter = HEAP32[((filters >> 2) + i) | 0]
    const title = HEAP32[((titles >> 2) + i) | 0]

    const filetype = {
      description: UTF8ToString(title),
      accept: { 'application/octet-stream': [UTF8ToString(filter)] }
    }
    fileTypes.push(filetype)
  }

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
  // https://web.dev/file-system-access/
  let path = null
  const opts = {
    suggestedName: UTF8ToString(filename),
    types: fileTypes
  }
  window
    .showSaveFilePicker(opts)
    .then(function (fileHandle) {
      path = 'Downloads/' + fileHandle.name
      return fileHandle.createWritable()
    })
    .then(function (writable) {
      _interop_callStringFunc('Window_OnFileUploaded', path)

      const data = CCFS.readFile(path)
      writable.write(data)
      return writable.close()
    })
    .catch(function (error) {
      _interop_callStringFunc('Platform_LogError', '&cError downloading file')
      _interop_callStringFunc('Platform_LogError', '   &c' + error)
    })
    .finally(function (result) {
      if (path) CCFS.unlink(path)
    })
  return 1
}

function _interop_DownloadFile (filename, filters, titles) {
  try {
    if (_interop_ShowSaveDialog(filename, filters, titles)) return 0

    const name = UTF8ToString(filename)
    const path = 'Downloads/' + name
    _interop_callStringFunc('Window_OnFileUploaded', path)

    const data = CCFS.readFile(path)
    const blob = new Blob([data], { type: 'application/octet-stream' })
    _interop_SaveBlob(blob, UTF8ToString(filename))
    CCFS.unlink(path)
    return 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return e.errno
  }
}

function _interop_EnterFullscreen () {
  // emscripten sets css size to screen's base width/height,
  //  except that becomes wrong when device rotates.
  // Better to just set CSS width/height to always be 100%
  const canvas = Module.canvas
  canvas.style.width = '100%'
  canvas.style.height = '100%'

  // By default, pressing Escape will immediately exit fullscreen - which is
  //   quite annoying given that it is also the Menu key. Some browsers allow
  //   'locking' the Escape key, so that you have to hold down Escape to exit.
  // NOTE: This ONLY works when the webpage is a https:// one
  try {
    navigator.keyboard.lock(['Escape'])
  } catch (ex) {}
}

function _interop_FS_Init () {
  if (window.CCFS) return

  window.MEMFS = {
    createNode: function (path) {
      const node = CCFS.createNode(path)
      node.usedBytes = 0 // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
      // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
      // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
      // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
      node.contents = null
      node.timestamp = Date.now()
      return node
    },
    getFileDataAsTypedArray: function (node) {
      if (!node.contents) return new Uint8Array()
      if (node.contents.subarray) {
        return node.contents.subarray(0, node.usedBytes)
      } // Make sure to not return excess unused bytes.
      return new Uint8Array(node.contents)
    },
    expandFileStorage: function (node, newCapacity) {
      const prevCapacity = node.contents ? node.contents.length : 0
      if (prevCapacity >= newCapacity) return // No need to expand, the storage was already large enough.
      // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
      // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
      // avoid overshooting the allocation cap by a very large margin.
      const CAPACITY_DOUBLING_MAX = 1024 * 1024
      newCapacity = Math.max(
        newCapacity,
        (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) |
          0
      )
      if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256) // At minimum allocate 256b for each file when expanding.
      const oldContents = node.contents
      node.contents = new Uint8Array(newCapacity) // Allocate new storage.
      if (node.usedBytes > 0) {
        node.contents.set(oldContents.subarray(0, node.usedBytes), 0)
      } // Copy old data over to the new storage.
    },
    clearFileStorage: function (node) {
      node.contents = null // Fully decommit when requesting a resize to zero.
      node.usedBytes = 0
    },
    stream_read: function (stream, buffer, offset, length, position) {
      const contents = stream.node.contents
      if (position >= stream.node.usedBytes) return 0
      const size = Math.min(stream.node.usedBytes - position, length)
      assert(size >= 0)
      if (size > 8 && contents.subarray) {
        // non-trivial, and typed array
        buffer.set(contents.subarray(position, position + size), offset)
      } else {
        for (let i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i]
        }
      }
      return size
    },
    stream_write: function (stream, buffer, offset, length, position, canOwn) {
      if (!length) return 0
      const node = stream.node
      const chunk = buffer.subarray(offset, offset + length)
      node.timestamp = Date.now()

      if (canOwn) {
        // NOTE: buffer cannot be a part of the memory buffer (i.e. HEAP8)
        //  - don't want to hold on to references of the memory Buffer,
        //  as they may get invalidated.
        assert(
          position === 0,
          'canOwn must imply no weird position inside the file'
        )
        node.contents = chunk
        node.usedBytes = length
      } else if (node.usedBytes === 0 && position === 0) {
        // First write to an empty file, do a fast set since don't need to care about old data
        node.contents = new Uint8Array(chunk)
        node.usedBytes = length
      } else if (position + length <= node.usedBytes) {
        // Writing to an already allocated and used subrange of the file
        node.contents.set(chunk, position)
      } else {
        // Appending to an existing file and we need to reallocate
        MEMFS.expandFileStorage(node, position + length)
        node.contents.set(chunk, position)
        node.usedBytes = Math.max(node.usedBytes, position + length)
      }
      return length
    }
  }

  window.CCFS = {
    streams: [],
    entries: {},
    currentPath: '/',
    ErrnoError: null,
    resolvePath: function (path) {
      if (path.charAt(0) !== '/') {
        path = CCFS.currentPath + '/' + path
      }
      return path
    },
    lookupPath: function (path) {
      path = CCFS.resolvePath(path)
      const node = CCFS.entries[path]

      if (!node) throw new CCFS.ErrnoError(2)
      return { path, node }
    },
    createNode: function (path) {
      const node = { path }
      CCFS.entries[path] = node
      return node
    },
    MODE_TYPE_FILE: 32768,
    isFile: function (mode) {
      return (mode & 61440) === CCFS.MODE_TYPE_FILE
    },
    nextfd: function () {
      // max 4096 open files
      for (let fd = 0; fd <= 4096; fd++) {
        if (!CCFS.streams[fd]) return fd
      }
      throw new CCFS.ErrnoError(24)
    },
    getStream: function (fd) {
      return CCFS.streams[fd]
    },
    createStream: function (stream) {
      const fd = CCFS.nextfd()
      stream.fd = fd
      CCFS.streams[fd] = stream
      return stream
    },
    readdir: function (path) {
      path = CCFS.resolvePath(path) + '/'

      // all entries starting with given directory
      const entries = []
      for (const entry in CCFS.entries) {
        if (entry.indexOf(path) !== 0) continue
        entries.push(entry)
      }
      return entries
    },
    unlink: function (path) {
      const lookup = CCFS.lookupPath(path)
      delete CCFS.entries[lookup.path]
    },
    utime: function (path, mtime) {
      const lookup = CCFS.lookupPath(path)
      const node = lookup.node

      node.timestamp = mtime
    },
    open: function (path, flags) {
      path = CCFS.resolvePath(path)

      let node = CCFS.entries[path]
      // perhaps we need to create the node
      let created = false
      if (flags & 64) {
        if (node) {
          // if O_CREAT and O_EXCL are set, error out if the node already exists
          if (flags & 128) {
            throw new CCFS.ErrnoError(17)
          }
        } else {
          // node doesn't exist, try to create it
          node = MEMFS.createNode(path)
          created = true
        }
      }
      if (!node) {
        throw new CCFS.ErrnoError(2)
      }

      // do truncation if necessary
      if (flags & 512) {
        MEMFS.clearFileStorage(node)
        node.timestamp = Date.now()
      }

      // we've already handled these, don't pass down to the underlying vfs
      flags &= ~(128 | 512)

      // register the stream with the filesystem
      const stream = CCFS.createStream({
        node,
        path,
        flags,
        position: 0
      })
      return stream
    },
    close: function (stream) {
      if (CCFS.isClosed(stream)) {
        throw new CCFS.ErrnoError(9)
      }

      CCFS.streams[stream.fd] = null
      stream.fd = null
    },
    isClosed: function (stream) {
      return stream.fd === null
    },
    llseek: function (stream, offset, whence) {
      if (CCFS.isClosed(stream)) {
        throw new CCFS.ErrnoError(9)
      }

      let position = offset
      if (whence === 0) {
        // SEEK_SET
        // beginning of file, no need to add anything
      } else if (whence === 1) {
        // SEEK_CUR
        position += stream.position
      } else if (whence === 2) {
        // SEEK_END
        position += stream.node.usedBytes
      }

      if (position < 0) {
        throw new CCFS.ErrnoError(22)
      }
      stream.position = position
      return stream.position
    },
    read: function (stream, buffer, offset, length) {
      if (length < 0) {
        throw new CCFS.ErrnoError(22)
      }
      if (CCFS.isClosed(stream)) {
        throw new CCFS.ErrnoError(9)
      }
      if ((stream.flags & 2097155) === 1) {
        throw new CCFS.ErrnoError(9)
      }

      const position = stream.position
      const bytesRead = MEMFS.stream_read(
        stream,
        buffer,
        offset,
        length,
        position
      )
      stream.position += bytesRead
      return bytesRead
    },
    write: function (stream, buffer, offset, length, canOwn) {
      if (length < 0) {
        throw new CCFS.ErrnoError(22)
      }
      if (CCFS.isClosed(stream)) {
        throw new CCFS.ErrnoError(9)
      }
      if ((stream.flags & 2097155) === 0) {
        throw new CCFS.ErrnoError(9)
      }
      if (stream.flags & 1024) {
        // seek to the end before writing in append mode
        CCFS.llseek(stream, 0, 2)
      }

      const position = stream.position
      const bytesWritten = MEMFS.stream_write(
        stream,
        buffer,
        offset,
        length,
        position,
        canOwn
      )
      stream.position += bytesWritten
      return bytesWritten
    },
    readFile: function (path, encoding) {
      encoding = encoding || 'binary'

      let ret
      const stream = CCFS.open(path, 0) // O_RDONLY
      const length = stream.node.usedBytes
      const buf = new Uint8Array(length)
      CCFS.read(stream, buf, 0, length)

      if (encoding === 'utf8') {
        ret = UTF8ArrayToString(buf, 0)
      } else if (encoding === 'binary') {
        ret = buf
      } else {
        throw new Error('Invalid encoding: ' + encoding)
      }

      CCFS.close(stream)
      return ret
    },
    writeFile: function (path, data) {
      const stream = CCFS.open(path, 577) // O_WRONLY | O_CREAT | O_TRUNC

      if (typeof data === 'string') {
        const buf = new Uint8Array(lengthBytesUTF8(data) + 1)
        const actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length)
        CCFS.write(stream, buf, 0, actualNumBytes, true)
      } else if (ArrayBuffer.isView(data)) {
        CCFS.write(stream, data, 0, data.byteLength, true)
      } else {
        throw new Error('Unsupported data type')
      }
      CCFS.close(stream)
    },
    chdir: function (path) {
      CCFS.currentPath = CCFS.resolvePath(path)
    },
    ensureErrnoError: function () {
      CCFS.ErrnoError = function ErrnoError (errno, node) {
        this.node = node
        this.errno = errno
      }
      CCFS.ErrnoError.prototype = new Error()
      CCFS.ErrnoError.prototype.constructor = CCFS.ErrnoError
    }
  }

  CCFS.ensureErrnoError()
}

function _IDBFS_storeRemoteEntry (store, path, entry, callback) {
  const req = store.put(entry, path)
  req.onsuccess = function () {
    callback(null)
  }
  req.onerror = function (e) {
    callback(this.error)
    e.preventDefault()
  }
}
function _interop_SaveNode (path) {
  const callback = function (err) {
    if (!err) return
    console.log(err)
    _interop_callStringFunc('Platform_LogError', '&cError saving ' + path)
    _interop_callStringFunc('Platform_LogError', '   &c' + err)
  }

  let stat, node, entry
  try {
    const lookup = CCFS.lookupPath(path)
    node = lookup.node

    // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
    // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
    node.contents = MEMFS.getFileDataAsTypedArray(node)
    entry = {
      timestamp: node.timestamp,
      mode: CCFS.MODE_TYPE_FILE,
      contents: node.contents
    }
  } catch (err) {
    return callback(err)
  }

  _IDBFS_getDB(function (err, db) {
    if (err) return callback(err)
    let transaction, store

    // can still throw errors here
    try {
      transaction = db.transaction([IDBFS_DB_STORE_NAME], 'readwrite')
      store = transaction.objectStore(IDBFS_DB_STORE_NAME)
    } catch (err) {
      return callback(err)
    }

    transaction.onerror = function (e) {
      callback(this.error)
      e.preventDefault()
    }

    _IDBFS_storeRemoteEntry(store, path, entry, callback)
  })
}
function _interop_FileClose (fd) {
  try {
    const stream = CCFS.getStream(fd)
    CCFS.close(stream)
    // save writable files to IndexedDB (check for O_RDWR)
    if ((stream.flags & 3) == 2) _interop_SaveNode(stream.path)
    return 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return -e.errno
  }
}

function _interop_FileCreate (raw, flags) {
  const path = UTF8ToString(raw)
  try {
    const stream = CCFS.open(path, flags)
    return stream.fd | 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return -e.errno
  }
}

function _interop_FileExists (raw) {
  let path = UTF8ToString(raw)

  path = CCFS.resolvePath(path)
  return path in CCFS.entries
}

function _interop_FileLength (fd) {
  try {
    const stream = CCFS.getStream(fd)
    return stream.node.usedBytes | 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return -e.errno
  }
}

function _interop_FileRead (fd, dst, count) {
  try {
    const stream = CCFS.getStream(fd)
    return CCFS.read(stream, HEAP8, dst, count) | 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return -e.errno
  }
}

function _interop_FileSeek (fd, offset, whence) {
  try {
    const stream = CCFS.getStream(fd)
    return CCFS.llseek(stream, offset, whence) | 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return -e.errno
  }
}

function _interop_FileWrite (fd, src, count) {
  try {
    const stream = CCFS.getStream(fd)
    return CCFS.write(stream, HEAP8, src, count) | 0
  } catch (e) {
    if (!(e instanceof CCFS.ErrnoError)) abort(e)
    return -e.errno
  }
}

function _interop_ForceTouchPageLayout () {
  if (typeof forceTouchLayout === 'function') forceTouchLayout()
}

function _interop_GetContainerID () {
  // For chrome on android, need to make container div fullscreen instead
  return document.getElementById('canvas_wrapper') ? 1 : 0
}

function _interop_GetGpuRenderer (buffer, len) {
  const dbg = GLctx.getExtension('WEBGL_debug_renderer_info')
  const str = dbg ? GLctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''
  stringToUTF8(str, buffer, len)
}

function _interop_GetLocalTime (time) {
  const date = new Date()
  HEAP32[(time | (0 + 0)) >> 2] = date.getFullYear()
  HEAP32[(time | (0 + 4)) >> 2] = (date.getMonth() + 1) | 0
  HEAP32[(time | (0 + 8)) >> 2] = date.getDate()
  HEAP32[(time | (0 + 12)) >> 2] = date.getHours()
  HEAP32[(time | (0 + 16)) >> 2] = date.getMinutes()
  HEAP32[(time | (0 + 20)) >> 2] = date.getSeconds()
}

function _interop_AudioLog (err) {
  console.log(err)
  window.AUDIO.errors.push('' + err)
  return window.AUDIO.errors.length | 0
}
function _interop_InitAudio () {
  window.AUDIO = window.AUDIO || {
    context: null,
    sources: [],
    buffers: {},
    errors: [],
    seen: {}
  }
  if (window.AUDIO.context) return 0

  try {
    if (window.AudioContext) {
      AUDIO.context = new window.AudioContext()
    } else {
      AUDIO.context = new window.webkitAudioContext()
    }
    return 0
  } catch (err) {
    return _interop_AudioLog(err)
  }
}

function _interop_InitContainer () {
  // Create wrapper div if necessary (so input textbox shows in fullscreen on android)
  const agent = navigator.userAgent
  const canvas = Module.canvas
  window.cc_container = document.body

  if (/Android/i.test(agent)) {
    const wrapper = document.createElement('div')
    wrapper.id = 'canvas_wrapper'

    canvas.parentNode.insertBefore(wrapper, canvas)
    wrapper.appendChild(canvas)
    window.cc_container = wrapper
  }
}

function _interop_InitFilesystem (buffer) {
  if (!window.cc_idbErr) return
  const msg =
    'Error preloading IndexedDB:' +
    window.cc_idbErr +
    '\n\nPreviously saved settings/maps will be lost'
  _interop_callStringFunc('Platform_LogError', msg)
}

function _interop_callVoidFunc (func) {
  Module['_' + func]()
}

function _interop_callStringFunc (func, str) {
  let arg = 0
  const stackTop = stackSave()

  if (str !== null && str !== undefined) {
    const len = str.length * 4 + 1 // worst case, 4 bytes to encode a char
    arg = stackAlloc(len)
    stringToUTF8(str, arg, len)
  }

  Module['_' + func](arg)
  stackRestore(stackTop)
}
function _interop_InitModule () {
  // these are required for older versions of emscripten, but the compiler removes
  // this by default as no syscalls are used by the C platform code anymore
  window.ERRNO_CODES = {
    ENOENT: 2,
    EBADF: 9,
    EAGAIN: 11,
    ENOMEM: 12,
    EEXIST: 17,
    EINVAL: 22
  }
}

function _interop_InitSockets () {
  window.SOCKETS = {
    EBADF: -8,
    EISCONN: -30,
    ENOTCONN: -53,
    EAGAIN: -6,
    EHOSTUNREACH: -23,
    EINPROGRESS: -26,
    EALREADY: -7,
    ECONNRESET: -15,
    EINVAL: -28,
    ECONNREFUSED: -14,
    sockets: []
  }
}

function _interop_IsAndroid () {
  return /Android/i.test(navigator.userAgent)
}

function _interop_IsHttpsOnly () {
  // If this webpage is https://, browsers deny any http:// downloading
  return location.protocol === 'https:'
}

function _interop_IsIOS () {
  // iOS 13 on iPad doesn't identify itself as iPad by default anymore
  //  https://stackoverflow.com/questions/57765958/how-to-detect-ipad-and-ipad-os-version-in-ios-13-and-up
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2)
  )
}

function _interop_LoadIndexedDB () {
  // previously you were required to add interop_LoadIndexedDB to Module.preRun array
  //  to load the indexedDB asynchronously *before* starting ClassiCube, because it
  //  could not load indexedDB asynchronously
  // however, as ClassiCube now loads IndexedDB asynchronously itself, this is
  //   no longer necessary, but is kept around for backwards compatibility
}

function _interop_Log (msg, len) {
  Module.print(UTF8ArrayToString(HEAPU8, msg, len))
}

function _interop_OpenFileDialog (filter, action, folder) {
  let elem = window.cc_uploadElem
  const root = UTF8ToString(folder)

  if (!elem) {
    elem = document.createElement('input')
    elem.setAttribute('type', 'file')
    elem.setAttribute('style', 'display: none')
    elem.accept = UTF8ToString(filter)

    elem.addEventListener(
      'change',
      function (ev) {
        const files = ev.target.files
        for (let i = 0; i < files.length; i++) {
          const reader = new FileReader()
          var name = files[i].name

          reader.onload = function (e) {
            const data = new Uint8Array(e.target.result)
            const path = root + '/' + name
            CCFS.writeFile(path, data)
            _interop_callStringFunc('Window_OnFileUploaded', path)

            if (action == 0) CCFS.unlink(path) // OFD_UPLOAD_DELETE
            if (action == 1) _interop_SaveNode(path) // OFD_UPLOAD_PERSIST
          }
          reader.readAsArrayBuffer(files[i])
        }
        window.cc_container.removeChild(window.cc_uploadElem)
        window.cc_uploadElem = null
      },
      false
    )
    window.cc_uploadElem = elem
    window.cc_container.appendChild(elem)
  }
  elem.click()
}

function _interop_OpenKeyboard (text, flags, placeholder) {
  let elem = window.cc_inputElem
  let shown = true
  const type = flags & 0xff

  if (!elem) {
    if (type == 1) {
      // KEYBOARD_TYPE_NUMBER
      elem = document.createElement('input')
      elem.setAttribute('type', 'text')
      elem.setAttribute('inputmode', 'decimal')
    } else if (type == 3) {
      // KEYBOARD_TYPE_INTEGER
      elem = document.createElement('input')
      elem.setAttribute('type', 'text')
      elem.setAttribute('inputmode', 'numeric')
      // Fix for older iOS safari where inputmode is unsupported
      //  https://news.ycombinator.com/item?id=22433654
      //  https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/
      elem.setAttribute('pattern', '[0-9]*')
    } else {
      elem = document.createElement('textarea')
    }
    shown = false
  }

  if (flags & 0x100) {
    elem.setAttribute('enterkeyhint', 'send')
  }
  // elem.setAttribute('style', 'position:absolute; left:0.5%; bottom:1%; margin: 0px; width: 99%; background-color: #080808; border: none; color: white; opacity: 0.7');
  elem.setAttribute(
    'style',
    'position:absolute; left:0; bottom:0; margin: 0px; width: 100%; background-color: #222222; border: none; color: white;'
  )
  elem.setAttribute('placeholder', UTF8ToString(placeholder))
  elem.value = UTF8ToString(text)

  if (!shown) {
    // stop event propagation, because we don't want the game trying to handle these events
    elem.addEventListener(
      'touchstart',
      function (ev) {
        ev.stopPropagation()
      },
      false
    )
    elem.addEventListener(
      'touchmove',
      function (ev) {
        ev.stopPropagation()
      },
      false
    )
    elem.addEventListener(
      'mousedown',
      function (ev) {
        ev.stopPropagation()
      },
      false
    )
    elem.addEventListener(
      'mousemove',
      function (ev) {
        ev.stopPropagation()
      },
      false
    )

    elem.addEventListener(
      'input',
      function (ev) {
        _interop_callStringFunc('Window_OnTextChanged', ev.target.value)
      },
      false
    )
    window.cc_inputElem = elem

    window.cc_divElem = document.createElement('div')
    window.cc_divElem.setAttribute(
      'style',
      'position:absolute; left:0; top:0; width:100%; height:100%; background-color: black; opacity:0.4; resize:none; pointer-events:none;'
    )

    window.cc_container.appendChild(window.cc_divElem)
    window.cc_container.appendChild(elem)
  }

  // force on-screen keyboard to be shown
  elem.focus()
  elem.click()
}

function _interop_OpenTab (url) {
  try {
    window.open(UTF8ToString(url))
  } catch (e) {
    // DOMException gets thrown when invalid URL provided. Test cases:
    //   http://example:app/test.zip
    console.log(e)
    return 1
  }
  return 0
}

function _interop_RequestCanvasResize () {
  if (typeof resizeGameCanvas === 'function') resizeGameCanvas()
}

function _interop_ScreenHeight () {
  return screen.height
}

function _interop_ScreenWidth () {
  return screen.width
}

function _interop_SetFont (fontStr, size, flags) {
  if (!window.FONT_CANVAS) {
    window.FONT_CANVAS = document.createElement('canvas')
    window.FONT_CONTEXT = window.FONT_CANVAS.getContext('2d')
  }

  let prefix = ''
  if (flags & 1) prefix += 'Bold '
  size += 4 // adjust font size so text appears more like FreeType

  const font = UTF8ToString(fontStr)
  const ctx = window.FONT_CONTEXT
  ctx.font = prefix + size + 'px ' + font
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  return ctx
}

function _interop_SetKeyboardText (text) {
  if (!window.cc_inputElem) return
  const str = UTF8ToString(text)
  let cur = window.cc_inputElem.value

  // when pressing 'Go' on the on-screen keyboard, some web browsers add \n to value
  if (cur.length && cur[cur.length - 1] == '\n') {
    cur = cur.substring(0, cur.length - 1)
  }
  if (str != cur) window.cc_inputElem.value = str
}

function _interop_SetPageTitle (title) {
  document.title = UTF8ToString(title)
}

function _interop_ShowDialog (title, msg) {
  alert(UTF8ToString(title) + '\n\n' + UTF8ToString(msg))
}

function _interop_SocketClose (sockFD) {
  const sock = SOCKETS.sockets[sockFD]
  if (!sock) return SOCKETS.EBADF

  try {
    sock.socket.close()
  } catch (e) {}
  delete sock.socket
  return 0
}

function _interop_SocketConnect (sockFD, raw, port) {
  const addr = UTF8ToString(raw)
  const sock = SOCKETS.sockets[sockFD]
  if (!sock) return SOCKETS.EBADF

  // already connecting or connected
  let ws = sock.socket
  if (ws) {
    if (ws.readyState === ws.CONNECTING) return SOCKETS.EALREADY
    return SOCKETS.EISCONN
  }

  // create the actual websocket object and connect
  try {
    const parts = addr.split('/')
    const proto = _interop_IsHttpsOnly() ? 'wss://' : 'ws://'
    const url = proto + parts[0] + ':' + port + '/' + parts.slice(1).join('/')

    ws = new WebSocket(url, 'ClassiCube')
    ws.binaryType = 'arraybuffer'
  } catch (e) {
    return SOCKETS.EHOSTUNREACH
  }
  sock.socket = ws

  ws.onopen = function () {}
  ws.onclose = function () {}
  ws.onmessage = function (event) {
    let data = event.data
    if (typeof data === 'string') {
      const encoder = new TextEncoder() // should be utf-8
      data = encoder.encode(data) // make a typed array from the string
    } else {
      assert(data.byteLength !== undefined) // must receive an ArrayBuffer
      if (data.byteLength == 0) {
        // An empty ArrayBuffer will emit a pseudo disconnect event
        // as recv/recvmsg will return zero which indicates that a socket
        // has performed a shutdown although the connection has not been disconnected yet.
        return
      } else {
        data = new Uint8Array(data) // make a typed array view on the array buffer
      }
    }
    sock.recv_queue.push(data)
  }
  ws.onerror = function (error) {
    // The WebSocket spec only allows a 'simple event' to be thrown on error,
    // so we only really know as much as ECONNREFUSED.
    sock.error = SOCKETS.ECONNREFUSED // Used by interop_SocketWritable
  }
  // always "fail" in non-blocking mode
  return SOCKETS.EINPROGRESS
}

function _interop_SocketCreate () {
  const sock = {
    error: null, // Used by interop_SocketWritable
    recv_queue: [],
    socket: null
  }

  SOCKETS.sockets.push(sock)
  return (SOCKETS.sockets.length - 1) | 0
}

function _interop_SocketRecv (sockFD, dst, length) {
  const sock = SOCKETS.sockets[sockFD]
  if (!sock) return SOCKETS.EBADF

  let packet = sock.recv_queue.shift()
  if (!packet) {
    const ws = sock.socket

    if (!ws || ws.readyState == ws.CLOSING || ws.readyState == ws.CLOSED) {
      return SOCKETS.ENOTCONN
    } else {
      // socket is in a valid state but truly has nothing available
      return SOCKETS.EAGAIN
    }
  }

  // packet will be an ArrayBuffer if it's unadulterated, but if it's
  // requeued TCP data it'll be an ArrayBufferView
  const packetLength = packet.byteLength || packet.length
  const packetOffset = packet.byteOffset || 0
  const packetBuffer = packet.buffer || packet
  const bytesRead = Math.min(length, packetLength)
  const msg = new Uint8Array(packetBuffer, packetOffset, bytesRead)

  // push back any unread data for TCP connections
  if (bytesRead < packetLength) {
    const bytesRemaining = packetLength - bytesRead
    packet = new Uint8Array(
      packetBuffer,
      packetOffset + bytesRead,
      bytesRemaining
    )
    sock.recv_queue.unshift(packet)
  }

  HEAPU8.set(msg, dst)
  return msg.byteLength
}

function _interop_SocketSend (sockFD, src, length) {
  const sock = SOCKETS.sockets[sockFD]
  if (!sock) return SOCKETS.EBADF

  const ws = sock.socket
  if (!ws || ws.readyState === ws.CLOSING || ws.readyState === ws.CLOSED) {
    return SOCKETS.ENOTCONN
  } else if (ws.readyState === ws.CONNECTING) {
    return SOCKETS.EAGAIN
  }

  // var data = HEAP8.slice(src, src + length); unsupported in IE11
  const data = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    data[i] = HEAP8[src + i]
  }

  try {
    ws.send(data)
    return length
  } catch (e) {
    return SOCKETS.EINVAL
  }
}

function _interop_SocketWritable (sockFD, writable) {
  HEAPU8[writable | 0] = 0
  const sock = SOCKETS.sockets[sockFD]
  if (!sock) return SOCKETS.EBADF

  const ws = sock.socket
  if (!ws) return SOCKETS.ENOTCONN
  if (ws.readyState === ws.OPEN || ws.readyState == ws.CLOSED) {
    HEAPU8[writable | 0] = 1
  }

  return 0
}

function _interop_TakeScreenshot (path) {
  const name = UTF8ToString(path)
  const canvas = Module.canvas
  if (canvas.toBlob) {
    canvas.toBlob(function (blob) {
      _interop_SaveBlob(blob, name)
    })
  } else if (canvas.msToBlob) {
    _interop_SaveBlob(canvas.msToBlob(), name)
  }
}

function _interop_TextDraw (textStr, textLen, bmp, dstX, dstY, shadow, hexStr) {
  const text = UTF8ArrayToString(HEAPU8, textStr, textLen)
  const hex = UTF8ArrayToString(HEAPU8, hexStr, 7)
  const ctx = window.FONT_CONTEXT

  // resize canvas if necessary so text fits
  const data = ctx.measureText(text)
  const text_width = Math.ceil(data.width) | 0
  if (text_width > ctx.canvas.width) {
    const font = ctx.font
    ctx.canvas.width = text_width
    // resizing canvas also resets the properties of CanvasRenderingContext2D
    ctx.font = font
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
  }

  let text_offset = 0.0
  ctx.fillStyle = hex
  if (shadow) {
    text_offset = 1.3
  }

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillText(text, text_offset, text_offset)

  bmp = bmp | 0
  dstX = dstX | 0
  dstY = dstY | 0

  const dst_pixels = HEAP32[((bmp + 0) | 0) >> 2] + (dstX << 2)
  const dst_width = HEAP32[((bmp + 4) | 0) >> 2]
  const dst_height = HEAP32[((bmp + 8) | 0) >> 2]

  // TODO not all of it
  const src = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const src_pixels = src.data
  const src_width = src.width | 0
  const src_height = src.height | 0

  const img_width = Math.min(src_width, dst_width)
  const img_height = Math.min(src_height, dst_height)

  for (let y = 0; y < img_height; y++) {
    const yy = y + dstY
    if (yy < 0 || yy >= dst_height) continue

    const src_row = (y * (src_width << 2)) | 0
    const dst_row = (dst_pixels + yy * (dst_width << 2)) | 0

    for (let x = 0; x < img_width; x++) {
      const xx = x + dstX
      if (xx < 0 || xx >= dst_width) continue
      const I = src_pixels[src_row + (x << 2) + 3]
      const invI = (255 - I) | 0

      HEAPU8[dst_row + (x << 2) + 0] =
        ((src_pixels[src_row + (x << 2) + 0] * I) >> 8) +
        ((HEAPU8[dst_row + (x << 2) + 0] * invI) >> 8)
      HEAPU8[dst_row + (x << 2) + 1] =
        ((src_pixels[src_row + (x << 2) + 1] * I) >> 8) +
        ((HEAPU8[dst_row + (x << 2) + 1] * invI) >> 8)
      HEAPU8[dst_row + (x << 2) + 2] =
        ((src_pixels[src_row + (x << 2) + 2] * I) >> 8) +
        ((HEAPU8[dst_row + (x << 2) + 2] * invI) >> 8)
      HEAPU8[dst_row + (x << 2) + 3] =
        I + ((HEAPU8[dst_row + (x << 2) + 3] * invI) >> 8)
    }
  }
  return data.width
}

function _interop_TextWidth (textStr, textLen) {
  const text = UTF8ArrayToString(HEAPU8, textStr, textLen)
  const ctx = window.FONT_CONTEXT
  const data = ctx.measureText(text)
  return data.width
}

function _interop_TryGetClipboardText () {
  // For IE11, use window.clipboardData to get the clipboard
  if (window.clipboardData) {
    const contents = window.clipboardData.getData('Text')
    _interop_callStringFunc('Window_StoreClipboardText', contents)
  }
}

function _interop_TrySetClipboardText (text) {
  // For IE11, use window.clipboardData to set the clipboard */
  // For other browsers, instead use the window.copy events */
  if (window.clipboardData) {
    if (window.getSelection && window.getSelection().toString()) return
    window.clipboardData.setData('Text', UTF8ToString(text))
  } else {
    window.cc_copyText = UTF8ToString(text)
  }
}

const print = out

const updateTableMap = (offset, count) => {
  if (functionsInTableMap) {
    for (let i = offset; i < offset + count; i++) {
      const item = getWasmTableEntry(i)
      // Ignore null values.
      if (item) {
        functionsInTableMap.set(item, i)
      }
    }
  }
}

let functionsInTableMap

const getFunctionAddress = (func) => {
  // First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap()
    updateTableMap(0, wasmTable.length)
  }
  return functionsInTableMap.get(func) || 0
}

const freeTableIndexes = []

const getEmptyTableSlot = () => {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop()
  }
  try {
    // Grow the table
    return wasmTable.grow(1)
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err
    }
    abort('Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.')
  }
}

const setWasmTableEntry = (idx, func) => {
  /** @suppress {checkTypes} */
  wasmTable.set(idx, func)
  // With ABORT_ON_WASM_EXCEPTIONS wasmTable.get is overridden to return wrapped
  // functions so we need to call it here to retrieve the potential wrapper correctly
  // instead of just storing 'func' directly into wasmTableMirror
  /** @suppress {checkTypes} */
  wasmTableMirror[idx] = wasmTable.get(idx)
}

const uleb128EncodeWithLen = (arr) => {
  const n = arr.length
  assert(n < 16384)
  // Note: this LEB128 length encoding produces extra byte for n < 128,
  // but we don't care as it's only used in a temporary representation.
  return [(n % 128) | 128, n >> 7, ...arr]
}

const wasmTypeCodes = {
  i: 0x7f, // i32
  p: 0x7f, // i32
  j: 0x7e, // i64
  f: 0x7d, // f32
  d: 0x7c, // f64
  e: 0x6f // externref
}
const generateTypePack = (types) =>
  uleb128EncodeWithLen(
    Array.from(types, (type) => {
      const code = wasmTypeCodes[type]
      assert(code, `invalid signature char: ${type}`)
      return code
    })
  )
const convertJsFunctionToWasm = (func, sig) => {
  // Rest of the module is static
  const bytes = Uint8Array.of(
    0x00,
    0x61,
    0x73,
    0x6d, // magic ("\0asm")
    0x01,
    0x00,
    0x00,
    0x00, // version: 1
    0x01, // Type section code
    // The module is static, with the exception of the type section, which is
    // generated based on the signature passed in.
    ...uleb128EncodeWithLen([
      0x01, // count: 1
      0x60 /* form: func */,
      // param types
      ...generateTypePack(sig.slice(1)),
      // return types (for now only supporting [] if `void` and single [T] otherwise)
      ...generateTypePack(sig[0] === 'v' ? '' : sig[0])
    ]),
    // The rest of the module is static
    0x02,
    0x07, // import section
    // (import "e" "f" (func 0 (type 0)))
    0x01,
    0x01,
    0x65,
    0x01,
    0x66,
    0x00,
    0x00,
    0x07,
    0x05, // export section
    // (export "f" (func 0 (type 0)))
    0x01,
    0x01,
    0x66,
    0x00,
    0x00
  )

  // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  const module = new WebAssembly.Module(bytes)
  const instance = new WebAssembly.Instance(module, { e: { f: func } })
  const wrappedFunc = instance.exports.f
  return wrappedFunc
}
/** @param {string=} sig */
const addFunction = (func, sig) => {
  assert(typeof func !== 'undefined')
  // Check if the function is already in the table, to ensure each function
  // gets a unique index.
  const rtn = getFunctionAddress(func)
  if (rtn) {
    return rtn
  }

  // It's not in the table, add it now.

  const ret = getEmptyTableSlot()

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause table.set() to fail
    setWasmTableEntry(ret, func)
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err
    }
    assert(
      typeof sig !== 'undefined',
      'Missing signature argument to addFunction: ' + func
    )
    const wrapped = convertJsFunctionToWasm(func, sig)
    setWasmTableEntry(ret, wrapped)
  }

  functionsInTableMap.set(func, ret)

  return ret
}

Module.requestAnimationFrame = MainLoop.requestAnimationFrame
Module.pauseMainLoop = MainLoop.pause
Module.resumeMainLoop = MainLoop.resume
MainLoop.init()
const miniTempWebGLFloatBuffersStorage = new Float32Array(288)
// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
for (/** @suppress{duplicate} */ let i = 0; i <= 288; ++i) {
  miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(
    0,
    i
  )
}
// End JS library code

// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.

{
  // Begin ATMODULES hooks
  if (Module.noExitRuntime) noExitRuntime = Module.noExitRuntime
  if (Module.print) out = Module.print
  if (Module.printErr) err = Module.printErr
  if (Module.wasmBinary) wasmBinary = Module.wasmBinary

  Module.FS_createDataFile = FS.createDataFile
  Module.FS_createPreloadedFile = FS.createPreloadedFile

  // End ATMODULES hooks

  checkIncomingModuleAPI()

  if (Module.arguments) arguments_ = Module.arguments
  if (Module.thisProgram) thisProgram = Module.thisProgram

  // Assertions on removed incoming Module JS APIs.
  assert(
    typeof Module.memoryInitializerPrefixURL === 'undefined',
    'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead'
  )
  assert(
    typeof Module.pthreadMainPrefixURL === 'undefined',
    'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead'
  )
  assert(
    typeof Module.cdInitializerPrefixURL === 'undefined',
    'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead'
  )
  assert(
    typeof Module.filePackagePrefixURL === 'undefined',
    'Module.filePackagePrefixURL option was removed, use Module.locateFile instead'
  )
  assert(typeof Module.read === 'undefined', 'Module.read option was removed')
  assert(
    typeof Module.readAsync === 'undefined',
    'Module.readAsync option was removed (modify readAsync in JS)'
  )
  assert(
    typeof Module.readBinary === 'undefined',
    'Module.readBinary option was removed (modify readBinary in JS)'
  )
  assert(
    typeof Module.setWindowTitle === 'undefined',
    'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)'
  )
  assert(
    typeof Module.TOTAL_MEMORY === 'undefined',
    'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY'
  )
  assert(
    typeof Module.ENVIRONMENT === 'undefined',
    'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)'
  )
  assert(
    typeof Module.STACK_SIZE === 'undefined',
    'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time'
  )
  // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
  assert(
    typeof Module.wasmMemory === 'undefined',
    'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally'
  )
  assert(
    typeof Module.INITIAL_MEMORY === 'undefined',
    'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically'
  )

  if (Module.preInit) {
    if (typeof Module.preInit === 'function') {
      Module.preInit = [Module.preInit]
    }
    while (Module.preInit.length > 0) {
      Module.preInit.shift()()
    }
  }
  consumedModuleProp('preInit')
}

// Begin runtime exports
Module.addFunction = addFunction
Module.UTF8ToString = UTF8ToString
Module.stringToUTF8 = stringToUTF8
Module.print = print
// End runtime exports
// Begin JS library exports
Module.ExitStatus = ExitStatus
Module.addOnPostRun = addOnPostRun
Module.onPostRuns = onPostRuns
Module.callRuntimeCallbacks = callRuntimeCallbacks
Module.addOnPreRun = addOnPreRun
Module.onPreRuns = onPreRuns
Module.addRunDependency = addRunDependency
Module.runDependencies = runDependencies
Module.removeRunDependency = removeRunDependency
Module.dependenciesFulfilled = dependenciesFulfilled
Module.runDependencyTracking = runDependencyTracking
Module.runDependencyWatcher = runDependencyWatcher
Module.getValue = getValue
Module.noExitRuntime = noExitRuntime
Module.ptrToString = ptrToString
Module.setValue = setValue
Module.stackRestore = stackRestore
Module.stackSave = stackSave
Module.warnOnce = warnOnce
Module.__abort_js = __abort_js
Module._clock_time_get = _clock_time_get
Module._emscripten_get_now = _emscripten_get_now
Module._emscripten_date_now = _emscripten_date_now
Module.nowIsMonotonic = nowIsMonotonic
Module.checkWasiClock = checkWasiClock
Module.bigintToI53Checked = bigintToI53Checked
Module.INT53_MAX = INT53_MAX
Module.INT53_MIN = INT53_MIN
Module._emscripten_cancel_main_loop = _emscripten_cancel_main_loop
Module.MainLoop = MainLoop
Module.setMainLoop = setMainLoop
Module._emscripten_set_main_loop_timing = _emscripten_set_main_loop_timing
Module.maybeExit = maybeExit
Module._exit = _exit
Module.exitJS = exitJS
Module._proc_exit = _proc_exit
Module.keepRuntimeAlive = keepRuntimeAlive
Module.runtimeKeepaliveCounter = runtimeKeepaliveCounter
Module.handleException = handleException
Module.callUserCallback = callUserCallback
Module._emscripten_exit_fullscreen = _emscripten_exit_fullscreen
Module.JSEvents = JSEvents
Module.addOnExit = addOnExit
Module.onExits = onExits
Module.specialHTMLTargets = specialHTMLTargets
Module.JSEvents_requestFullscreen = JSEvents_requestFullscreen
Module.JSEvents_resizeCanvasForFullscreen = JSEvents_resizeCanvasForFullscreen
Module.registerRestoreOldStyle = registerRestoreOldStyle
Module.getCanvasElementSize = getCanvasElementSize
Module._emscripten_get_canvas_element_size =
  _emscripten_get_canvas_element_size
Module.findCanvasEventTarget = findCanvasEventTarget
Module.findEventTarget = findEventTarget
Module.maybeCStringToJsString = maybeCStringToJsString
Module.UTF8ToString = UTF8ToString
Module.UTF8ArrayToString = UTF8ArrayToString
Module.UTF8Decoder = UTF8Decoder
Module.findStringEnd = findStringEnd
Module.stringToUTF8OnStack = stringToUTF8OnStack
Module.lengthBytesUTF8 = lengthBytesUTF8
Module.stringToUTF8 = stringToUTF8
Module.stringToUTF8Array = stringToUTF8Array
Module.stackAlloc = stackAlloc
Module.setCanvasElementSize = setCanvasElementSize
Module._emscripten_set_canvas_element_size =
  _emscripten_set_canvas_element_size
Module.currentFullscreenStrategy = currentFullscreenStrategy
Module.getWasmTableEntry = getWasmTableEntry
Module.wasmTableMirror = wasmTableMirror
Module.setLetterbox = setLetterbox
Module.getBoundingClientRect = getBoundingClientRect
Module._emscripten_exit_pointerlock = _emscripten_exit_pointerlock
Module.requestPointerLock = requestPointerLock
Module._emscripten_get_device_pixel_ratio = _emscripten_get_device_pixel_ratio
Module._emscripten_get_element_css_size = _emscripten_get_element_css_size
Module._emscripten_get_fullscreen_status = _emscripten_get_fullscreen_status
Module.fillFullscreenChangeEventData = fillFullscreenChangeEventData
Module.getFullscreenElement = getFullscreenElement
Module._emscripten_get_gamepad_status = _emscripten_get_gamepad_status
Module.fillGamepadEventData = fillGamepadEventData
Module._emscripten_get_num_gamepads = _emscripten_get_num_gamepads
Module._emscripten_get_pointerlock_status = _emscripten_get_pointerlock_status
Module.fillPointerlockChangeEventData = fillPointerlockChangeEventData
Module._emscripten_is_webgl_context_lost = _emscripten_is_webgl_context_lost
Module.GL = GL
Module.GLctx = GLctx
Module.webgl_enable_ANGLE_instanced_arrays =
  webgl_enable_ANGLE_instanced_arrays
Module.webgl_enable_OES_vertex_array_object =
  webgl_enable_OES_vertex_array_object
Module.webgl_enable_WEBGL_draw_buffers = webgl_enable_WEBGL_draw_buffers
Module.webgl_enable_EXT_polygon_offset_clamp =
  webgl_enable_EXT_polygon_offset_clamp
Module.webgl_enable_EXT_clip_control = webgl_enable_EXT_clip_control
Module.webgl_enable_WEBGL_polygon_mode = webgl_enable_WEBGL_polygon_mode
Module.webgl_enable_WEBGL_multi_draw = webgl_enable_WEBGL_multi_draw
Module.getEmscriptenSupportedExtensions = getEmscriptenSupportedExtensions
Module._emscripten_request_fullscreen_strategy =
  _emscripten_request_fullscreen_strategy
Module.doRequestFullscreen = doRequestFullscreen
Module._emscripten_request_pointerlock = _emscripten_request_pointerlock
Module._emscripten_resize_heap = _emscripten_resize_heap
Module.getHeapMax = getHeapMax
Module.alignMemory = alignMemory
Module.growMemory = growMemory
Module._emscripten_resume_main_loop = _emscripten_resume_main_loop
Module._emscripten_sample_gamepad_data = _emscripten_sample_gamepad_data
Module._emscripten_set_beforeunload_callback_on_thread =
  _emscripten_set_beforeunload_callback_on_thread
Module.registerBeforeUnloadEventCallback = registerBeforeUnloadEventCallback
Module._emscripten_set_blur_callback_on_thread =
  _emscripten_set_blur_callback_on_thread
Module.registerFocusEventCallback = registerFocusEventCallback
Module._emscripten_set_element_css_size = _emscripten_set_element_css_size
Module._emscripten_set_focus_callback_on_thread =
  _emscripten_set_focus_callback_on_thread
Module._emscripten_set_fullscreenchange_callback_on_thread =
  _emscripten_set_fullscreenchange_callback_on_thread
Module.registerFullscreenChangeEventCallback =
  registerFullscreenChangeEventCallback
Module._emscripten_set_keydown_callback_on_thread =
  _emscripten_set_keydown_callback_on_thread
Module.registerKeyEventCallback = registerKeyEventCallback
Module._emscripten_set_keypress_callback_on_thread =
  _emscripten_set_keypress_callback_on_thread
Module._emscripten_set_keyup_callback_on_thread =
  _emscripten_set_keyup_callback_on_thread
Module._emscripten_set_main_loop = _emscripten_set_main_loop
Module._emscripten_set_mousedown_callback_on_thread =
  _emscripten_set_mousedown_callback_on_thread
Module.registerMouseEventCallback = registerMouseEventCallback
Module.fillMouseEventData = fillMouseEventData
Module._emscripten_set_mousemove_callback_on_thread =
  _emscripten_set_mousemove_callback_on_thread
Module._emscripten_set_mouseup_callback_on_thread =
  _emscripten_set_mouseup_callback_on_thread
Module._emscripten_set_resize_callback_on_thread =
  _emscripten_set_resize_callback_on_thread
Module.registerUiEventCallback = registerUiEventCallback
Module._emscripten_set_touchcancel_callback_on_thread =
  _emscripten_set_touchcancel_callback_on_thread
Module.registerTouchEventCallback = registerTouchEventCallback
Module._emscripten_set_touchend_callback_on_thread =
  _emscripten_set_touchend_callback_on_thread
Module._emscripten_set_touchmove_callback_on_thread =
  _emscripten_set_touchmove_callback_on_thread
Module._emscripten_set_touchstart_callback_on_thread =
  _emscripten_set_touchstart_callback_on_thread
Module._emscripten_set_visibilitychange_callback_on_thread =
  _emscripten_set_visibilitychange_callback_on_thread
Module.registerVisibilityChangeEventCallback =
  registerVisibilityChangeEventCallback
Module.fillVisibilityChangeEventData = fillVisibilityChangeEventData
Module._emscripten_set_webglcontextlost_callback_on_thread =
  _emscripten_set_webglcontextlost_callback_on_thread
Module.registerWebGlEventCallback = registerWebGlEventCallback
Module._emscripten_set_wheel_callback_on_thread =
  _emscripten_set_wheel_callback_on_thread
Module.registerWheelEventCallback = registerWheelEventCallback
Module._emscripten_webgl_create_context = _emscripten_webgl_create_context
Module._emscripten_webgl_do_create_context =
  _emscripten_webgl_do_create_context
Module.webglPowerPreferences = webglPowerPreferences
Module._emscripten_webgl_destroy_context = _emscripten_webgl_destroy_context
Module._emscripten_webgl_make_context_current =
  _emscripten_webgl_make_context_current
Module._fd_close = _fd_close
Module.SYSCALLS = SYSCALLS
Module._fd_seek = _fd_seek
Module._fd_write = _fd_write
Module.flush_NO_FILESYSTEM = flush_NO_FILESYSTEM
Module.printChar = printChar
Module.printCharBuffers = printCharBuffers
Module._glAttachShader = _glAttachShader
Module._emscripten_glAttachShader = _emscripten_glAttachShader
Module._glBindAttribLocation = _glBindAttribLocation
Module._emscripten_glBindAttribLocation = _emscripten_glBindAttribLocation
Module._glBindBuffer = _glBindBuffer
Module._emscripten_glBindBuffer = _emscripten_glBindBuffer
Module._glBindTexture = _glBindTexture
Module._emscripten_glBindTexture = _emscripten_glBindTexture
Module._glBlendFunc = _glBlendFunc
Module._emscripten_glBlendFunc = _emscripten_glBlendFunc
Module._glBufferData = _glBufferData
Module._emscripten_glBufferData = _emscripten_glBufferData
Module._glBufferSubData = _glBufferSubData
Module._emscripten_glBufferSubData = _emscripten_glBufferSubData
Module._glClear = _glClear
Module._emscripten_glClear = _emscripten_glClear
Module._glClearColor = _glClearColor
Module._emscripten_glClearColor = _emscripten_glClearColor
Module._glColorMask = _glColorMask
Module._emscripten_glColorMask = _emscripten_glColorMask
Module._glCompileShader = _glCompileShader
Module._emscripten_glCompileShader = _emscripten_glCompileShader
Module._glCreateProgram = _glCreateProgram
Module._emscripten_glCreateProgram = _emscripten_glCreateProgram
Module._glCreateShader = _glCreateShader
Module._emscripten_glCreateShader = _emscripten_glCreateShader
Module._glDeleteBuffers = _glDeleteBuffers
Module._emscripten_glDeleteBuffers = _emscripten_glDeleteBuffers
Module._glDeleteProgram = _glDeleteProgram
Module._emscripten_glDeleteProgram = _emscripten_glDeleteProgram
Module._glDeleteShader = _glDeleteShader
Module._emscripten_glDeleteShader = _emscripten_glDeleteShader
Module._glDeleteTextures = _glDeleteTextures
Module._emscripten_glDeleteTextures = _emscripten_glDeleteTextures
Module._glDepthFunc = _glDepthFunc
Module._emscripten_glDepthFunc = _emscripten_glDepthFunc
Module._glDepthMask = _glDepthMask
Module._emscripten_glDepthMask = _emscripten_glDepthMask
Module._glDetachShader = _glDetachShader
Module._emscripten_glDetachShader = _emscripten_glDetachShader
Module._glDisable = _glDisable
Module._emscripten_glDisable = _emscripten_glDisable
Module._glDisableVertexAttribArray = _glDisableVertexAttribArray
Module._emscripten_glDisableVertexAttribArray =
  _emscripten_glDisableVertexAttribArray
Module._glDrawArrays = _glDrawArrays
Module._emscripten_glDrawArrays = _emscripten_glDrawArrays
Module._glDrawElements = _glDrawElements
Module._emscripten_glDrawElements = _emscripten_glDrawElements
Module._glEnable = _glEnable
Module._emscripten_glEnable = _emscripten_glEnable
Module._glEnableVertexAttribArray = _glEnableVertexAttribArray
Module._emscripten_glEnableVertexAttribArray =
  _emscripten_glEnableVertexAttribArray
Module._glGenBuffers = _glGenBuffers
Module._emscripten_glGenBuffers = _emscripten_glGenBuffers
Module._glGenTextures = _glGenTextures
Module._emscripten_glGenTextures = _emscripten_glGenTextures
Module._glGetIntegerv = _glGetIntegerv
Module._emscripten_glGetIntegerv = _emscripten_glGetIntegerv
Module.emscriptenWebGLGet = emscriptenWebGLGet
Module.writeI53ToI64 = writeI53ToI64
Module.readI53FromI64 = readI53FromI64
Module.readI53FromU64 = readI53FromU64
Module._glGetProgramInfoLog = _glGetProgramInfoLog
Module._emscripten_glGetProgramInfoLog = _emscripten_glGetProgramInfoLog
Module._glGetProgramiv = _glGetProgramiv
Module._emscripten_glGetProgramiv = _emscripten_glGetProgramiv
Module._glGetShaderInfoLog = _glGetShaderInfoLog
Module._emscripten_glGetShaderInfoLog = _emscripten_glGetShaderInfoLog
Module._glGetShaderiv = _glGetShaderiv
Module._emscripten_glGetShaderiv = _emscripten_glGetShaderiv
Module._glGetString = _glGetString
Module._emscripten_glGetString = _emscripten_glGetString
Module.stringToNewUTF8 = stringToNewUTF8
Module.webglGetExtensions = webglGetExtensions
Module._glGetUniformLocation = _glGetUniformLocation
Module._emscripten_glGetUniformLocation = _emscripten_glGetUniformLocation
Module.jstoi_q = jstoi_q
Module.webglPrepareUniformLocationsBeforeFirstUse =
  webglPrepareUniformLocationsBeforeFirstUse
Module.webglGetLeftBracePos = webglGetLeftBracePos
Module._glLinkProgram = _glLinkProgram
Module._emscripten_glLinkProgram = _emscripten_glLinkProgram
Module._glShaderSource = _glShaderSource
Module._emscripten_glShaderSource = _emscripten_glShaderSource
Module._glTexImage2D = _glTexImage2D
Module._emscripten_glTexImage2D = _emscripten_glTexImage2D
Module.emscriptenWebGLGetTexPixelData = emscriptenWebGLGetTexPixelData
Module.computeUnpackAlignedImageSize = computeUnpackAlignedImageSize
Module.colorChannelsInGlTextureFormat = colorChannelsInGlTextureFormat
Module.heapObjectForWebGLType = heapObjectForWebGLType
Module.toTypedArrayIndex = toTypedArrayIndex
Module._glTexParameteri = _glTexParameteri
Module._emscripten_glTexParameteri = _emscripten_glTexParameteri
Module._glTexSubImage2D = _glTexSubImage2D
Module._emscripten_glTexSubImage2D = _emscripten_glTexSubImage2D
Module._glUniform1f = _glUniform1f
Module._emscripten_glUniform1f = _emscripten_glUniform1f
Module.webglGetUniformLocation = webglGetUniformLocation
Module._glUniform2f = _glUniform2f
Module._emscripten_glUniform2f = _emscripten_glUniform2f
Module._glUniform3f = _glUniform3f
Module._emscripten_glUniform3f = _emscripten_glUniform3f
Module._glUniformMatrix4fv = _glUniformMatrix4fv
Module._emscripten_glUniformMatrix4fv = _emscripten_glUniformMatrix4fv
Module.miniTempWebGLFloatBuffers = miniTempWebGLFloatBuffers
Module._glUseProgram = _glUseProgram
Module._emscripten_glUseProgram = _emscripten_glUseProgram
Module._glVertexAttribPointer = _glVertexAttribPointer
Module._emscripten_glVertexAttribPointer = _emscripten_glVertexAttribPointer
Module._glViewport = _glViewport
Module._emscripten_glViewport = _emscripten_glViewport
Module._interop_AddClipboardListeners = _interop_AddClipboardListeners
Module._interop_AdjustXY = _interop_AdjustXY
Module._interop_AsyncDownloadTexturePack = _interop_AsyncDownloadTexturePack
Module._fetchTexturePackAsync = _fetchTexturePackAsync
Module._interop_AsyncLoadIndexedDB = _interop_AsyncLoadIndexedDB
Module._IDBFS_loadFS = _IDBFS_loadFS
Module._IDBFS_getRemoteSet = _IDBFS_getRemoteSet
Module._IDBFS_getDB = _IDBFS_getDB
Module._IDBFS_reconcile = _IDBFS_reconcile
Module._IDBFS_loadRemoteEntry = _IDBFS_loadRemoteEntry
Module._IDBFS_storeLocalEntry = _IDBFS_storeLocalEntry
Module._interop_AudioClose = _interop_AudioClose
Module._interop_AudioCreate = _interop_AudioCreate
Module._interop_AudioDescribe = _interop_AudioDescribe
Module._interop_AudioPlay = _interop_AudioPlay
Module._interop_AudioDownload = _interop_AudioDownload
Module._interop_AudioPoll = _interop_AudioPoll
Module._interop_AudioVolume = _interop_AudioVolume
Module._interop_CanvasHeight = _interop_CanvasHeight
Module._interop_CanvasWidth = _interop_CanvasWidth
Module._interop_CloseKeyboard = _interop_CloseKeyboard
Module._interop_DirectoryIter = _interop_DirectoryIter
Module._interop_DirectorySetWorking = _interop_DirectorySetWorking
Module._interop_DownloadAsync = _interop_DownloadAsync
Module._interop_DownloadFile = _interop_DownloadFile
Module._interop_SaveBlob = _interop_SaveBlob
Module._interop_ShowSaveDialog = _interop_ShowSaveDialog
Module._interop_EnterFullscreen = _interop_EnterFullscreen
Module._interop_FS_Init = _interop_FS_Init
Module._interop_FileClose = _interop_FileClose
Module._interop_SaveNode = _interop_SaveNode
Module._IDBFS_storeRemoteEntry = _IDBFS_storeRemoteEntry
Module._interop_FileCreate = _interop_FileCreate
Module._interop_FileExists = _interop_FileExists
Module._interop_FileLength = _interop_FileLength
Module._interop_FileRead = _interop_FileRead
Module._interop_FileSeek = _interop_FileSeek
Module._interop_FileWrite = _interop_FileWrite
Module._interop_ForceTouchPageLayout = _interop_ForceTouchPageLayout
Module._interop_GetContainerID = _interop_GetContainerID
Module._interop_GetGpuRenderer = _interop_GetGpuRenderer
Module._interop_GetLocalTime = _interop_GetLocalTime
Module._interop_InitAudio = _interop_InitAudio
Module._interop_AudioLog = _interop_AudioLog
Module._interop_InitContainer = _interop_InitContainer
Module._interop_InitFilesystem = _interop_InitFilesystem
Module._interop_InitModule = _interop_InitModule
Module._interop_callVoidFunc = _interop_callVoidFunc
Module._interop_callStringFunc = _interop_callStringFunc
Module._interop_InitSockets = _interop_InitSockets
Module._interop_IsAndroid = _interop_IsAndroid
Module._interop_IsHttpsOnly = _interop_IsHttpsOnly
Module._interop_IsIOS = _interop_IsIOS
Module._interop_LoadIndexedDB = _interop_LoadIndexedDB
Module._interop_Log = _interop_Log
Module._interop_OpenFileDialog = _interop_OpenFileDialog
Module._interop_OpenKeyboard = _interop_OpenKeyboard
Module._interop_OpenTab = _interop_OpenTab
Module._interop_RequestCanvasResize = _interop_RequestCanvasResize
Module._interop_ScreenHeight = _interop_ScreenHeight
Module._interop_ScreenWidth = _interop_ScreenWidth
Module._interop_SetFont = _interop_SetFont
Module._interop_SetKeyboardText = _interop_SetKeyboardText
Module._interop_SetPageTitle = _interop_SetPageTitle
Module._interop_ShowDialog = _interop_ShowDialog
Module._interop_SocketClose = _interop_SocketClose
Module._interop_SocketConnect = _interop_SocketConnect
Module._interop_SocketCreate = _interop_SocketCreate
Module._interop_SocketRecv = _interop_SocketRecv
Module._interop_SocketSend = _interop_SocketSend
Module._interop_SocketWritable = _interop_SocketWritable
Module._interop_TakeScreenshot = _interop_TakeScreenshot
Module._interop_TextDraw = _interop_TextDraw
Module._interop_TextWidth = _interop_TextWidth
Module._interop_TryGetClipboardText = _interop_TryGetClipboardText
Module._interop_TrySetClipboardText = _interop_TrySetClipboardText
Module.print = print
Module.addFunction = addFunction
Module.getFunctionAddress = getFunctionAddress
Module.updateTableMap = updateTableMap
Module.functionsInTableMap = functionsInTableMap
Module.getEmptyTableSlot = getEmptyTableSlot
Module.freeTableIndexes = freeTableIndexes
Module.setWasmTableEntry = setWasmTableEntry
Module.convertJsFunctionToWasm = convertJsFunctionToWasm
Module.uleb128EncodeWithLen = uleb128EncodeWithLen
Module.generateTypePack = generateTypePack
Module.wasmTypeCodes = wasmTypeCodes
// End JS library exports

// end include: postlibrary.js

function checkIncomingModuleAPI () {
  ignoredModuleProp('fetchSettings')
}

// Imports from the Wasm binary.
var _malloc = (Module._malloc = makeInvalidEarlyAccess('_malloc'))
let _Http_OnUpdateProgress = (Module._Http_OnUpdateProgress =
  makeInvalidEarlyAccess('_Http_OnUpdateProgress'))
let _Http_OnFinishedAsync = (Module._Http_OnFinishedAsync =
  makeInvalidEarlyAccess('_Http_OnFinishedAsync'))
let _Directory_IterCallback = (Module._Directory_IterCallback =
  makeInvalidEarlyAccess('_Directory_IterCallback'))
let _strerror = (Module._strerror = makeInvalidEarlyAccess('_strerror'))
let _Platform_LogError = (Module._Platform_LogError =
  makeInvalidEarlyAccess('_Platform_LogError'))
let _main = (Module._main = makeInvalidEarlyAccess('_main'))
let _main_phase1 = (Module._main_phase1 =
  makeInvalidEarlyAccess('_main_phase1'))
let _main_phase2 = (Module._main_phase2 =
  makeInvalidEarlyAccess('_main_phase2'))
let _Window_RequestClipboardText = (Module._Window_RequestClipboardText =
  makeInvalidEarlyAccess('_Window_RequestClipboardText'))
let _Window_StoreClipboardText = (Module._Window_StoreClipboardText =
  makeInvalidEarlyAccess('_Window_StoreClipboardText'))
let _Window_GotClipboardText = (Module._Window_GotClipboardText =
  makeInvalidEarlyAccess('_Window_GotClipboardText'))
let _Window_OnFileUploaded = (Module._Window_OnFileUploaded =
  makeInvalidEarlyAccess('_Window_OnFileUploaded'))
let _Window_OnTextChanged = (Module._Window_OnTextChanged =
  makeInvalidEarlyAccess('_Window_OnTextChanged'))
var _fflush = (Module._fflush = makeInvalidEarlyAccess('_fflush'))
var _emscripten_stack_get_end = (Module._emscripten_stack_get_end =
  makeInvalidEarlyAccess('_emscripten_stack_get_end'))
let _emscripten_stack_get_base = (Module._emscripten_stack_get_base =
  makeInvalidEarlyAccess('_emscripten_stack_get_base'))
let _emscripten_stack_init = (Module._emscripten_stack_init =
  makeInvalidEarlyAccess('_emscripten_stack_init'))
let _emscripten_stack_get_free = (Module._emscripten_stack_get_free =
  makeInvalidEarlyAccess('_emscripten_stack_get_free'))
var __emscripten_stack_restore = (Module.__emscripten_stack_restore =
  makeInvalidEarlyAccess('__emscripten_stack_restore'))
var __emscripten_stack_alloc = (Module.__emscripten_stack_alloc =
  makeInvalidEarlyAccess('__emscripten_stack_alloc'))
var _emscripten_stack_get_current = (Module._emscripten_stack_get_current =
  makeInvalidEarlyAccess('_emscripten_stack_get_current'))
let memory = (Module.memory = makeInvalidEarlyAccess('memory'))
let __indirect_function_table = (Module.__indirect_function_table =
  makeInvalidEarlyAccess('__indirect_function_table'))
var wasmMemory = (Module.wasmMemory = makeInvalidEarlyAccess('wasmMemory'))
var wasmTable = (Module.wasmTable = makeInvalidEarlyAccess('wasmTable'))

function assignWasmExports (wasmExports) {
  assert(
    typeof wasmExports.malloc !== 'undefined',
    'missing Wasm export: malloc'
  )
  assert(
    typeof wasmExports.Http_OnUpdateProgress !== 'undefined',
    'missing Wasm export: Http_OnUpdateProgress'
  )
  assert(
    typeof wasmExports.Http_OnFinishedAsync !== 'undefined',
    'missing Wasm export: Http_OnFinishedAsync'
  )
  assert(
    typeof wasmExports.Directory_IterCallback !== 'undefined',
    'missing Wasm export: Directory_IterCallback'
  )
  assert(
    typeof wasmExports.strerror !== 'undefined',
    'missing Wasm export: strerror'
  )
  assert(
    typeof wasmExports.Platform_LogError !== 'undefined',
    'missing Wasm export: Platform_LogError'
  )
  assert(
    typeof wasmExports.__main_argc_argv !== 'undefined',
    'missing Wasm export: __main_argc_argv'
  )
  assert(
    typeof wasmExports.main_phase1 !== 'undefined',
    'missing Wasm export: main_phase1'
  )
  assert(
    typeof wasmExports.main_phase2 !== 'undefined',
    'missing Wasm export: main_phase2'
  )
  assert(
    typeof wasmExports.Window_RequestClipboardText !== 'undefined',
    'missing Wasm export: Window_RequestClipboardText'
  )
  assert(
    typeof wasmExports.Window_StoreClipboardText !== 'undefined',
    'missing Wasm export: Window_StoreClipboardText'
  )
  assert(
    typeof wasmExports.Window_GotClipboardText !== 'undefined',
    'missing Wasm export: Window_GotClipboardText'
  )
  assert(
    typeof wasmExports.Window_OnFileUploaded !== 'undefined',
    'missing Wasm export: Window_OnFileUploaded'
  )
  assert(
    typeof wasmExports.Window_OnTextChanged !== 'undefined',
    'missing Wasm export: Window_OnTextChanged'
  )
  assert(
    typeof wasmExports.fflush !== 'undefined',
    'missing Wasm export: fflush'
  )
  assert(
    typeof wasmExports.emscripten_stack_get_end !== 'undefined',
    'missing Wasm export: emscripten_stack_get_end'
  )
  assert(
    typeof wasmExports.emscripten_stack_get_base !== 'undefined',
    'missing Wasm export: emscripten_stack_get_base'
  )
  assert(
    typeof wasmExports.emscripten_stack_init !== 'undefined',
    'missing Wasm export: emscripten_stack_init'
  )
  assert(
    typeof wasmExports.emscripten_stack_get_free !== 'undefined',
    'missing Wasm export: emscripten_stack_get_free'
  )
  assert(
    typeof wasmExports._emscripten_stack_restore !== 'undefined',
    'missing Wasm export: _emscripten_stack_restore'
  )
  assert(
    typeof wasmExports._emscripten_stack_alloc !== 'undefined',
    'missing Wasm export: _emscripten_stack_alloc'
  )
  assert(
    typeof wasmExports.emscripten_stack_get_current !== 'undefined',
    'missing Wasm export: emscripten_stack_get_current'
  )
  assert(
    typeof wasmExports.memory !== 'undefined',
    'missing Wasm export: memory'
  )
  assert(
    typeof wasmExports.__indirect_function_table !== 'undefined',
    'missing Wasm export: __indirect_function_table'
  )
  _malloc = Module._malloc = createExportWrapper('malloc', 1)
  _Http_OnUpdateProgress = Module._Http_OnUpdateProgress = createExportWrapper(
    'Http_OnUpdateProgress',
    3
  )
  _Http_OnFinishedAsync = Module._Http_OnFinishedAsync = createExportWrapper(
    'Http_OnFinishedAsync',
    4
  )
  _Directory_IterCallback = Module._Directory_IterCallback =
    createExportWrapper('Directory_IterCallback', 1)
  _strerror = Module._strerror = createExportWrapper('strerror', 1)
  _Platform_LogError = Module._Platform_LogError = createExportWrapper(
    'Platform_LogError',
    1
  )
  _main = Module._main = createExportWrapper('__main_argc_argv', 2)
  _main_phase1 = Module._main_phase1 = createExportWrapper('main_phase1', 0)
  _main_phase2 = Module._main_phase2 = createExportWrapper('main_phase2', 0)
  _Window_RequestClipboardText = Module._Window_RequestClipboardText =
    createExportWrapper('Window_RequestClipboardText', 0)
  _Window_StoreClipboardText = Module._Window_StoreClipboardText =
    createExportWrapper('Window_StoreClipboardText', 1)
  _Window_GotClipboardText = Module._Window_GotClipboardText =
    createExportWrapper('Window_GotClipboardText', 1)
  _Window_OnFileUploaded = Module._Window_OnFileUploaded = createExportWrapper(
    'Window_OnFileUploaded',
    1
  )
  _Window_OnTextChanged = Module._Window_OnTextChanged = createExportWrapper(
    'Window_OnTextChanged',
    1
  )
  _fflush = Module._fflush = createExportWrapper('fflush', 1)
  _emscripten_stack_get_end = Module._emscripten_stack_get_end =
    wasmExports.emscripten_stack_get_end
  _emscripten_stack_get_base = Module._emscripten_stack_get_base =
    wasmExports.emscripten_stack_get_base
  _emscripten_stack_init = Module._emscripten_stack_init =
    wasmExports.emscripten_stack_init
  _emscripten_stack_get_free = Module._emscripten_stack_get_free =
    wasmExports.emscripten_stack_get_free
  __emscripten_stack_restore = Module.__emscripten_stack_restore =
    wasmExports._emscripten_stack_restore
  __emscripten_stack_alloc = Module.__emscripten_stack_alloc =
    wasmExports._emscripten_stack_alloc
  _emscripten_stack_get_current = Module._emscripten_stack_get_current =
    wasmExports.emscripten_stack_get_current
  memory = Module.memory = wasmMemory = wasmExports.memory
  __indirect_function_table =
    Module.__indirect_function_table =
    wasmTable =
      wasmExports.__indirect_function_table
}

var wasmImports = {
  /** @export */
  _abort_js: __abort_js,
  /** @export */
  clock_time_get: _clock_time_get,
  /** @export */
  emscripten_cancel_main_loop: _emscripten_cancel_main_loop,
  /** @export */
  emscripten_date_now: _emscripten_date_now,
  /** @export */
  emscripten_exit_fullscreen: _emscripten_exit_fullscreen,
  /** @export */
  emscripten_exit_pointerlock: _emscripten_exit_pointerlock,
  /** @export */
  emscripten_get_device_pixel_ratio: _emscripten_get_device_pixel_ratio,
  /** @export */
  emscripten_get_element_css_size: _emscripten_get_element_css_size,
  /** @export */
  emscripten_get_fullscreen_status: _emscripten_get_fullscreen_status,
  /** @export */
  emscripten_get_gamepad_status: _emscripten_get_gamepad_status,
  /** @export */
  emscripten_get_now: _emscripten_get_now,
  /** @export */
  emscripten_get_num_gamepads: _emscripten_get_num_gamepads,
  /** @export */
  emscripten_get_pointerlock_status: _emscripten_get_pointerlock_status,
  /** @export */
  emscripten_is_webgl_context_lost: _emscripten_is_webgl_context_lost,
  /** @export */
  emscripten_request_fullscreen_strategy:
    _emscripten_request_fullscreen_strategy,
  /** @export */
  emscripten_request_pointerlock: _emscripten_request_pointerlock,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  emscripten_resume_main_loop: _emscripten_resume_main_loop,
  /** @export */
  emscripten_sample_gamepad_data: _emscripten_sample_gamepad_data,
  /** @export */
  emscripten_set_beforeunload_callback_on_thread:
    _emscripten_set_beforeunload_callback_on_thread,
  /** @export */
  emscripten_set_blur_callback_on_thread:
    _emscripten_set_blur_callback_on_thread,
  /** @export */
  emscripten_set_canvas_element_size: _emscripten_set_canvas_element_size,
  /** @export */
  emscripten_set_element_css_size: _emscripten_set_element_css_size,
  /** @export */
  emscripten_set_focus_callback_on_thread:
    _emscripten_set_focus_callback_on_thread,
  /** @export */
  emscripten_set_fullscreenchange_callback_on_thread:
    _emscripten_set_fullscreenchange_callback_on_thread,
  /** @export */
  emscripten_set_keydown_callback_on_thread:
    _emscripten_set_keydown_callback_on_thread,
  /** @export */
  emscripten_set_keypress_callback_on_thread:
    _emscripten_set_keypress_callback_on_thread,
  /** @export */
  emscripten_set_keyup_callback_on_thread:
    _emscripten_set_keyup_callback_on_thread,
  /** @export */
  emscripten_set_main_loop: _emscripten_set_main_loop,
  /** @export */
  emscripten_set_main_loop_timing: _emscripten_set_main_loop_timing,
  /** @export */
  emscripten_set_mousedown_callback_on_thread:
    _emscripten_set_mousedown_callback_on_thread,
  /** @export */
  emscripten_set_mousemove_callback_on_thread:
    _emscripten_set_mousemove_callback_on_thread,
  /** @export */
  emscripten_set_mouseup_callback_on_thread:
    _emscripten_set_mouseup_callback_on_thread,
  /** @export */
  emscripten_set_resize_callback_on_thread:
    _emscripten_set_resize_callback_on_thread,
  /** @export */
  emscripten_set_touchcancel_callback_on_thread:
    _emscripten_set_touchcancel_callback_on_thread,
  /** @export */
  emscripten_set_touchend_callback_on_thread:
    _emscripten_set_touchend_callback_on_thread,
  /** @export */
  emscripten_set_touchmove_callback_on_thread:
    _emscripten_set_touchmove_callback_on_thread,
  /** @export */
  emscripten_set_touchstart_callback_on_thread:
    _emscripten_set_touchstart_callback_on_thread,
  /** @export */
  emscripten_set_visibilitychange_callback_on_thread:
    _emscripten_set_visibilitychange_callback_on_thread,
  /** @export */
  emscripten_set_webglcontextlost_callback_on_thread:
    _emscripten_set_webglcontextlost_callback_on_thread,
  /** @export */
  emscripten_set_wheel_callback_on_thread:
    _emscripten_set_wheel_callback_on_thread,
  /** @export */
  emscripten_webgl_create_context: _emscripten_webgl_create_context,
  /** @export */
  emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
  /** @export */
  emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
  /** @export */
  exit: _exit,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write,
  /** @export */
  glAttachShader: _glAttachShader,
  /** @export */
  glBindAttribLocation: _glBindAttribLocation,
  /** @export */
  glBindBuffer: _glBindBuffer,
  /** @export */
  glBindTexture: _glBindTexture,
  /** @export */
  glBlendFunc: _glBlendFunc,
  /** @export */
  glBufferData: _glBufferData,
  /** @export */
  glBufferSubData: _glBufferSubData,
  /** @export */
  glClear: _glClear,
  /** @export */
  glClearColor: _glClearColor,
  /** @export */
  glColorMask: _glColorMask,
  /** @export */
  glCompileShader: _glCompileShader,
  /** @export */
  glCreateProgram: _glCreateProgram,
  /** @export */
  glCreateShader: _glCreateShader,
  /** @export */
  glDeleteBuffers: _glDeleteBuffers,
  /** @export */
  glDeleteProgram: _glDeleteProgram,
  /** @export */
  glDeleteShader: _glDeleteShader,
  /** @export */
  glDeleteTextures: _glDeleteTextures,
  /** @export */
  glDepthFunc: _glDepthFunc,
  /** @export */
  glDepthMask: _glDepthMask,
  /** @export */
  glDetachShader: _glDetachShader,
  /** @export */
  glDisable: _glDisable,
  /** @export */
  glDisableVertexAttribArray: _glDisableVertexAttribArray,
  /** @export */
  glDrawArrays: _glDrawArrays,
  /** @export */
  glDrawElements: _glDrawElements,
  /** @export */
  glEnable: _glEnable,
  /** @export */
  glEnableVertexAttribArray: _glEnableVertexAttribArray,
  /** @export */
  glGenBuffers: _glGenBuffers,
  /** @export */
  glGenTextures: _glGenTextures,
  /** @export */
  glGetIntegerv: _glGetIntegerv,
  /** @export */
  glGetProgramInfoLog: _glGetProgramInfoLog,
  /** @export */
  glGetProgramiv: _glGetProgramiv,
  /** @export */
  glGetShaderInfoLog: _glGetShaderInfoLog,
  /** @export */
  glGetShaderiv: _glGetShaderiv,
  /** @export */
  glGetString: _glGetString,
  /** @export */
  glGetUniformLocation: _glGetUniformLocation,
  /** @export */
  glLinkProgram: _glLinkProgram,
  /** @export */
  glShaderSource: _glShaderSource,
  /** @export */
  glTexImage2D: _glTexImage2D,
  /** @export */
  glTexParameteri: _glTexParameteri,
  /** @export */
  glTexSubImage2D: _glTexSubImage2D,
  /** @export */
  glUniform1f: _glUniform1f,
  /** @export */
  glUniform2f: _glUniform2f,
  /** @export */
  glUniform3f: _glUniform3f,
  /** @export */
  glUniformMatrix4fv: _glUniformMatrix4fv,
  /** @export */
  glUseProgram: _glUseProgram,
  /** @export */
  glVertexAttribPointer: _glVertexAttribPointer,
  /** @export */
  glViewport: _glViewport,
  /** @export */
  interop_AddClipboardListeners: _interop_AddClipboardListeners,
  /** @export */
  interop_AdjustXY: _interop_AdjustXY,
  /** @export */
  interop_AsyncDownloadTexturePack: _interop_AsyncDownloadTexturePack,
  /** @export */
  interop_AsyncLoadIndexedDB: _interop_AsyncLoadIndexedDB,
  /** @export */
  interop_AudioClose: _interop_AudioClose,
  /** @export */
  interop_AudioCreate: _interop_AudioCreate,
  /** @export */
  interop_AudioDescribe: _interop_AudioDescribe,
  /** @export */
  interop_AudioPlay: _interop_AudioPlay,
  /** @export */
  interop_AudioPoll: _interop_AudioPoll,
  /** @export */
  interop_AudioVolume: _interop_AudioVolume,
  /** @export */
  interop_CanvasHeight: _interop_CanvasHeight,
  /** @export */
  interop_CanvasWidth: _interop_CanvasWidth,
  /** @export */
  interop_CloseKeyboard: _interop_CloseKeyboard,
  /** @export */
  interop_DirectoryIter: _interop_DirectoryIter,
  /** @export */
  interop_DirectorySetWorking: _interop_DirectorySetWorking,
  /** @export */
  interop_DownloadAsync: _interop_DownloadAsync,
  /** @export */
  interop_DownloadFile: _interop_DownloadFile,
  /** @export */
  interop_EnterFullscreen: _interop_EnterFullscreen,
  /** @export */
  interop_FS_Init: _interop_FS_Init,
  /** @export */
  interop_FileClose: _interop_FileClose,
  /** @export */
  interop_FileCreate: _interop_FileCreate,
  /** @export */
  interop_FileExists: _interop_FileExists,
  /** @export */
  interop_FileLength: _interop_FileLength,
  /** @export */
  interop_FileRead: _interop_FileRead,
  /** @export */
  interop_FileSeek: _interop_FileSeek,
  /** @export */
  interop_FileWrite: _interop_FileWrite,
  /** @export */
  interop_ForceTouchPageLayout: _interop_ForceTouchPageLayout,
  /** @export */
  interop_GetContainerID: _interop_GetContainerID,
  /** @export */
  interop_GetGpuRenderer: _interop_GetGpuRenderer,
  /** @export */
  interop_GetLocalTime: _interop_GetLocalTime,
  /** @export */
  interop_InitAudio: _interop_InitAudio,
  /** @export */
  interop_InitContainer: _interop_InitContainer,
  /** @export */
  interop_InitFilesystem: _interop_InitFilesystem,
  /** @export */
  interop_InitModule: _interop_InitModule,
  /** @export */
  interop_InitSockets: _interop_InitSockets,
  /** @export */
  interop_IsAndroid: _interop_IsAndroid,
  /** @export */
  interop_IsHttpsOnly: _interop_IsHttpsOnly,
  /** @export */
  interop_IsIOS: _interop_IsIOS,
  /** @export */
  interop_LoadIndexedDB: _interop_LoadIndexedDB,
  /** @export */
  interop_Log: _interop_Log,
  /** @export */
  interop_OpenFileDialog: _interop_OpenFileDialog,
  /** @export */
  interop_OpenKeyboard: _interop_OpenKeyboard,
  /** @export */
  interop_OpenTab: _interop_OpenTab,
  /** @export */
  interop_RequestCanvasResize: _interop_RequestCanvasResize,
  /** @export */
  interop_ScreenHeight: _interop_ScreenHeight,
  /** @export */
  interop_ScreenWidth: _interop_ScreenWidth,
  /** @export */
  interop_SetFont: _interop_SetFont,
  /** @export */
  interop_SetKeyboardText: _interop_SetKeyboardText,
  /** @export */
  interop_SetPageTitle: _interop_SetPageTitle,
  /** @export */
  interop_ShowDialog: _interop_ShowDialog,
  /** @export */
  interop_SocketClose: _interop_SocketClose,
  /** @export */
  interop_SocketConnect: _interop_SocketConnect,
  /** @export */
  interop_SocketCreate: _interop_SocketCreate,
  /** @export */
  interop_SocketRecv: _interop_SocketRecv,
  /** @export */
  interop_SocketSend: _interop_SocketSend,
  /** @export */
  interop_SocketWritable: _interop_SocketWritable,
  /** @export */
  interop_TakeScreenshot: _interop_TakeScreenshot,
  /** @export */
  interop_TextDraw: _interop_TextDraw,
  /** @export */
  interop_TextWidth: _interop_TextWidth,
  /** @export */
  interop_TryGetClipboardText: _interop_TryGetClipboardText,
  /** @export */
  interop_TrySetClipboardText: _interop_TrySetClipboardText
}

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

let calledRun

function callMain (args = []) {
  assert(
    runDependencies == 0,
    'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])'
  )
  assert(
    typeof onPreRuns === 'undefined' || onPreRuns.length == 0,
    'cannot call main when preRun functions remain to be called'
  )

  const entryFunction = _main

  args.unshift(thisProgram)

  const argc = args.length
  const argv = stackAlloc((argc + 1) * 4)
  let argv_ptr = argv
  for (const arg of args) {
    HEAPU32[argv_ptr >> 2] = stringToUTF8OnStack(arg)
    argv_ptr += 4
  }
  HEAPU32[argv_ptr >> 2] = 0

  try {
    const ret = entryFunction(argc, argv)

    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true)
    return ret
  } catch (e) {
    return handleException(e)
  }
}

function stackCheckInit () {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init()
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie()
}

function run (args = arguments_) {
  if (runDependencies > 0) {
    dependenciesFulfilled = run
    return
  }

  stackCheckInit()

  preRun()

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    dependenciesFulfilled = run
    return
  }

  function doRun () {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    assert(!calledRun)
    calledRun = true
    Module.calledRun = true

    if (ABORT) return

    initRuntime()

    preMain()

    Module.onRuntimeInitialized?.()
    consumedModuleProp('onRuntimeInitialized')

    const noInitialRun = Module.noInitialRun || false
    if (!noInitialRun) callMain(args)

    postRun()
  }

  if (Module.setStatus) {
    Module.setStatus('Running...')
    setTimeout(() => {
      setTimeout(() => Module.setStatus(''), 1)
      doRun()
    }, 1)
  } else {
    doRun()
  }
  checkStackCookie()
}

function checkUnflushedContent () {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  const oldOut = out
  const oldErr = err
  let has = false
  out = err = (x) => {
    has = true
  }
  try {
    // it doesn't matter if it fails
    flush_NO_FILESYSTEM()
  } catch (e) {}
  out = oldOut
  err = oldErr
  if (has) {
    warnOnce(
      'stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.'
    )
    warnOnce(
      '(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)'
    )
  }
}

let wasmExports

// With async instantation wasmExports is assigned asynchronously when the
// instance is received.
createWasm()

run()

// end include: postamble.js
