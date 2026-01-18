// Copyright 2010 The Emscripten Authors. All rights reserved.
// Emscripten is available under two separate licenses,
//  the MIT license and the University of Illinois/NCSA Open Source License.
// Both these licenses can be found in the LICENSE file.

mergeInto(LibraryManager.library, {
  interop_SaveBlob: function (blob, name) {
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
  },
  interop_InitModule: function () {
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
  },
  interop_InitModule__deps: [
    'interop_SaveBlob',
    'interop_callVoidFunc',
    'interop_callStringFunc'
  ],
  interop_TakeScreenshot: function (path) {
    const name = UTF8ToString(path)
    const canvas = Module.canvas
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        _interop_SaveBlob(blob, name)
      })
    } else if (canvas.msToBlob) {
      _interop_SaveBlob(canvas.msToBlob(), name)
    }
  },
  interop_callVoidFunc: function (func) {
    Module['_' + func]()
  },
  interop_callStringFunc: function (func, str) {
    let arg = 0
    const stackTop = stackSave()

    if (str !== null && str !== undefined) {
      const len = str.length * 4 + 1 // worst case, 4 bytes to encode a char
      arg = stackAlloc(len)
      stringToUTF8(str, arg, len)
    }

    Module['_' + func](arg)
    stackRestore(stackTop)
  },

  // ########################################################################################################################
  // -----------------------------------------------------------Http---------------------------------------------------------
  // ########################################################################################################################
  interop_DownloadAsync: function (urlStr, method, reqID) {
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
  },
  interop_IsHttpsOnly: function () {
    // If this webpage is https://, browsers deny any http:// downloading
    return location.protocol === 'https:'
  },

  // ########################################################################################################################
  // ---------------------------------------------------------Dialogs--------------------------------------------------------
  // ########################################################################################################################
  interop_DownloadFile: function (filename, filters, titles) {
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
  },
  interop_DownloadFile__deps: ['interop_SaveBlob', 'interop_ShowSaveDialog'],
  interop_ShowSaveDialog: function (filename, filters, titles) {
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
        _interop_callStringFunc(
          'Platform_LogError',
          '&cError downloading file'
        )
        _interop_callStringFunc('Platform_LogError', '   &c' + error)
      })
      .finally(function (result) {
        if (path) CCFS.unlink(path)
      })
    return 1
  },

  // ########################################################################################################################
  // -------------------------------------------------------Main driver------------------------------------------------------
  // ########################################################################################################################
  fetchTexturePackAsync: function (url, onload, onerror) {
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
  },
  interop_AsyncDownloadTexturePack__deps: ['fetchTexturePackAsync'],
  interop_AsyncDownloadTexturePack: function (rawPath) {
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
  },
  interop_AsyncLoadIndexedDB__deps: ['IDBFS_loadFS'],
  interop_AsyncLoadIndexedDB: function () {
    Module.setStatus('Preloading filesystem.. (2/2)')

    _IDBFS_loadFS(function (err) {
      if (err) window.cc_idbErr = err
      Module.setStatus('')
      _interop_callVoidFunc('main_phase2')
    })
  },

  // ########################################################################################################################
  // ---------------------------------------------------------Platform-------------------------------------------------------
  // ########################################################################################################################
  interop_OpenTab: function (url) {
    try {
      window.open(UTF8ToString(url))
    } catch (e) {
      // DOMException gets thrown when invalid URL provided. Test cases:
      //   http://example:app/test.zip
      console.log(e)
      return 1
    }
    return 0
  },
  interop_Log: function (msg, len) {
    Module.print(UTF8ArrayToString(HEAPU8, msg, len))
  },
  interop_GetLocalTime: function (time) {
    const date = new Date()
    HEAP32[(time | (0 + 0)) >> 2] = date.getFullYear()
    HEAP32[(time | (0 + 4)) >> 2] = (date.getMonth() + 1) | 0
    HEAP32[(time | (0 + 8)) >> 2] = date.getDate()
    HEAP32[(time | (0 + 12)) >> 2] = date.getHours()
    HEAP32[(time | (0 + 16)) >> 2] = date.getMinutes()
    HEAP32[(time | (0 + 20)) >> 2] = date.getSeconds()
  },
  interop_DirectorySetWorking: function (raw) {
    const path = UTF8ToString(raw)
    CCFS.chdir(path)
  },
  interop_DirectoryIter: function (raw) {
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
  },
  interop_FileExists: function (raw) {
    let path = UTF8ToString(raw)

    path = CCFS.resolvePath(path)
    return path in CCFS.entries
  },
  interop_FileCreate: function (raw, flags) {
    const path = UTF8ToString(raw)
    try {
      const stream = CCFS.open(path, flags)
      return stream.fd | 0
    } catch (e) {
      if (!(e instanceof CCFS.ErrnoError)) abort(e)
      return -e.errno
    }
  },
  interop_FileRead: function (fd, dst, count) {
    try {
      const stream = CCFS.getStream(fd)
      return CCFS.read(stream, HEAP8, dst, count) | 0
    } catch (e) {
      if (!(e instanceof CCFS.ErrnoError)) abort(e)
      return -e.errno
    }
  },
  interop_FileWrite: function (fd, src, count) {
    try {
      const stream = CCFS.getStream(fd)
      return CCFS.write(stream, HEAP8, src, count) | 0
    } catch (e) {
      if (!(e instanceof CCFS.ErrnoError)) abort(e)
      return -e.errno
    }
  },
  interop_FileSeek: function (fd, offset, whence) {
    try {
      const stream = CCFS.getStream(fd)
      return CCFS.llseek(stream, offset, whence) | 0
    } catch (e) {
      if (!(e instanceof CCFS.ErrnoError)) abort(e)
      return -e.errno
    }
  },
  interop_FileLength: function (fd) {
    try {
      const stream = CCFS.getStream(fd)
      return stream.node.usedBytes | 0
    } catch (e) {
      if (!(e instanceof CCFS.ErrnoError)) abort(e)
      return -e.errno
    }
  },
  interop_FileClose: function (fd) {
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
  },
  interop_FileClose__deps: ['interop_SaveNode'],

  // ########################################################################################################################
  // --------------------------------------------------------Filesystem------------------------------------------------------
  // ########################################################################################################################
  interop_InitFilesystem__deps: ['interop_SaveNode'],
  interop_InitFilesystem: function (buffer) {
    if (!window.cc_idbErr) return
    const msg =
      'Error preloading IndexedDB:' +
      window.cc_idbErr +
      '\n\nPreviously saved settings/maps will be lost'
    _interop_callStringFunc('Platform_LogError', msg)
  },
  interop_LoadIndexedDB: function () {
    // previously you were required to add interop_LoadIndexedDB to Module.preRun array
    //  to load the indexedDB asynchronously *before* starting ClassiCube, because it
    //  could not load indexedDB asynchronously
    // however, as ClassiCube now loads IndexedDB asynchronously itself, this is
    //   no longer necessary, but is kept around for backwards compatibility
  },
  interop_SaveNode__deps: ['IDBFS_getDB', 'IDBFS_storeRemoteEntry'],
  interop_SaveNode: function (path) {
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
  },
  // ########################################################################################################################
  // --------------------------------------------------------IndexedDB-------------------------------------------------------
  // ########################################################################################################################
  IDBFS_loadFS__deps: ['IDBFS_getRemoteSet', 'IDBFS_reconcile'],
  IDBFS_loadFS: function (callback) {
    _IDBFS_getRemoteSet(function (err, remote) {
      if (err) return callback(err)
      _IDBFS_reconcile(remote, callback)
    })
  },
  IDBFS_getDB: function (callback) {
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
  },
  IDBFS_getRemoteSet__deps: ['IDBFS_getDB'],
  IDBFS_getRemoteSet: function (callback) {
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
  },
  IDBFS_loadRemoteEntry: function (store, path, callback) {
    const req = store.get(path)
    req.onsuccess = function (event) {
      callback(null, event.target.result)
    }
    req.onerror = function (e) {
      callback(this.error)
      e.preventDefault()
    }
  },
  IDBFS_storeRemoteEntry: function (store, path, entry, callback) {
    const req = store.put(entry, path)
    req.onsuccess = function () {
      callback(null)
    }
    req.onerror = function (e) {
      callback(this.error)
      e.preventDefault()
    }
  },
  IDBFS_storeLocalEntry: function (path, entry, callback) {
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
  },
  IDBFS_reconcile__deps: ['IDBFS_loadRemoteEntry', 'IDBFS_storeLocalEntry'],
  IDBFS_reconcile: function (src, callback) {
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
  },

  // ########################################################################################################################
  // ---------------------------------------------------------Sockets--------------------------------------------------------
  // ########################################################################################################################
  interop_InitSockets: function () {
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
  },
  interop_SocketCreate: function () {
    const sock = {
      error: null, // Used by interop_SocketWritable
      recv_queue: [],
      socket: null
    }

    SOCKETS.sockets.push(sock)
    return (SOCKETS.sockets.length - 1) | 0
  },
  interop_SocketConnect: function (sockFD, raw, port) {
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
      const url =
        proto + parts[0] + ':' + port + '/' + parts.slice(1).join('/')

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
  },
  interop_SocketClose: function (sockFD) {
    const sock = SOCKETS.sockets[sockFD]
    if (!sock) return SOCKETS.EBADF

    try {
      sock.socket.close()
    } catch (e) {}
    delete sock.socket
    return 0
  },
  interop_SocketSend: function (sockFD, src, length) {
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
  },
  interop_SocketRecv: function (sockFD, dst, length) {
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
  },
  interop_SocketWritable: function (sockFD, writable) {
    HEAPU8[writable | 0] = 0
    const sock = SOCKETS.sockets[sockFD]
    if (!sock) return SOCKETS.EBADF

    const ws = sock.socket
    if (!ws) return SOCKETS.ENOTCONN
    if (ws.readyState === ws.OPEN || ws.readyState == ws.CLOSED) {
      HEAPU8[writable | 0] = 1
    }

    return 0
  },
  interop_SocketLastError: function (sockFD) {
    const sock = SOCKETS.sockets[sockFD]
    if (!sock) return SOCKETS.EBADF

    const ws = sock.socket
    if (!ws) return SOCKETS.ENOTCONN

    return sock.error || 0
  },

  // ########################################################################################################################
  // ----------------------------------------------------------Window--------------------------------------------------------
  // ########################################################################################################################
  interop_CanvasWidth: function () {
    return Module.canvas.width
  },
  interop_CanvasHeight: function () {
    return Module.canvas.height
  },
  interop_ScreenWidth: function () {
    return screen.width
  },
  interop_ScreenHeight: function () {
    return screen.height
  },

  interop_IsAndroid: function () {
    return /Android/i.test(navigator.userAgent)
  },
  interop_IsIOS: function () {
    // iOS 13 on iPad doesn't identify itself as iPad by default anymore
    //  https://stackoverflow.com/questions/57765958/how-to-detect-ipad-and-ipad-os-version-in-ios-13-and-up
    return (
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' &&
        navigator.maxTouchPoints &&
        navigator.maxTouchPoints > 2)
    )
  },
  interop_InitContainer: function () {
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
  },
  interop_GetContainerID: function () {
    // For chrome on android, need to make container div fullscreen instead
    return document.getElementById('canvas_wrapper') ? 1 : 0
  },
  interop_ForceTouchPageLayout: function () {
    if (typeof forceTouchLayout === 'function') forceTouchLayout()
  },
  interop_SetPageTitle: function (title) {
    document.title = UTF8ToString(title)
  },
  interop_AddClipboardListeners: function () {
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
  },
  interop_TryGetClipboardText: function () {
    // For IE11, use window.clipboardData to get the clipboard
    if (window.clipboardData) {
      const contents = window.clipboardData.getData('Text')
      _interop_callStringFunc('Window_StoreClipboardText', contents)
    }
  },
  interop_TrySetClipboardText: function (text) {
    // For IE11, use window.clipboardData to set the clipboard */
    // For other browsers, instead use the window.copy events */
    if (window.clipboardData) {
      if (window.getSelection && window.getSelection().toString()) return
      window.clipboardData.setData('Text', UTF8ToString(text))
    } else {
      window.cc_copyText = UTF8ToString(text)
    }
  },
  interop_EnterFullscreen: function () {
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
  },

  // Adjust from document coordinates to element coordinates
  interop_AdjustXY: function (x, y) {
    const canvasRect = Module.canvas.getBoundingClientRect()
    HEAP32[x >> 2] = HEAP32[x >> 2] - canvasRect.left
    HEAP32[y >> 2] = HEAP32[y >> 2] - canvasRect.top
  },
  interop_RequestCanvasResize: function () {
    if (typeof resizeGameCanvas === 'function') resizeGameCanvas()
  },
  interop_SetCursorVisible: function (visible) {
    Module.canvas.style.cursor = visible ? 'default' : 'none'
  },
  interop_ShowDialog: function (title, msg) {
    alert(UTF8ToString(title) + '\n\n' + UTF8ToString(msg))
  },
  interop_OpenKeyboard: function (text, flags, placeholder) {
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
  },
  interop_SetKeyboardText: function (text) {
    if (!window.cc_inputElem) return
    const str = UTF8ToString(text)
    let cur = window.cc_inputElem.value

    // when pressing 'Go' on the on-screen keyboard, some web browsers add \n to value
    if (cur.length && cur[cur.length - 1] == '\n') {
      cur = cur.substring(0, cur.length - 1)
    }
    if (str != cur) window.cc_inputElem.value = str
  },
  interop_CloseKeyboard: function () {
    if (!window.cc_inputElem) return
    window.cc_container.removeChild(window.cc_divElem)
    window.cc_container.removeChild(window.cc_inputElem)
    window.cc_divElem = null
    window.cc_inputElem = null
  },
  interop_OpenFileDialog: function (filter, action, folder) {
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
  },

  // ########################################################################################################################
  // --------------------------------------------------------GLContext-------------------------------------------------------
  // #########################################################################################################################
  interop_GetGpuRenderer: function (buffer, len) {
    const dbg = GLctx.getExtension('WEBGL_debug_renderer_info')
    const str = dbg ? GLctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''
    stringToUTF8(str, buffer, len)
  },

  // ########################################################################################################################
  // ---------------------------------------------------------Sockets--------------------------------------------------------
  // ########################################################################################################################
  interop_AudioLog: function (err) {
    console.log(err)
    window.AUDIO.errors.push('' + err)
    return window.AUDIO.errors.length | 0
  },
  interop_InitAudio: function () {
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
  },
  interop_InitAudio__deps: ['interop_AudioLog'],
  interop_AudioCreate: function () {
    const src = {
      source: null,
      gain: AUDIO.context.createGain(),
      playing: false
    }
    AUDIO.sources.push(src)
    return AUDIO.sources.length | 0
    // NOTE: 0 is used by Audio.c for "no source"
  },
  interop_AudioClose: function (ctxID) {
    const src = AUDIO.sources[(ctxID - 1) | 0]
    if (src.source) src.source.stop()
    AUDIO.sources[(ctxID - 1) | 0] = null
  },
  interop_AudioPoll: function (ctxID, inUse) {
    const src = AUDIO.sources[(ctxID - 1) | 0]
    HEAP32[inUse >> 2] = src.playing // only 1 buffer
    return 0
  },
  interop_AudioVolume: function (ctxID, volume) {
    const src = AUDIO.sources[(ctxID - 1) | 0]
    src.gain.gain.value = volume / 100
  },
  interop_AudioPlay: function (ctxID, sndID, rate) {
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
  },
  interop_AudioPlay__deps: ['interop_AudioDownload'],
  interop_AudioDownload: function (name) {
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
  },
  interop_AudioDescribe: function (errCode, buffer, bufferLen) {
    if (errCode > AUDIO.errors.length) return 0

    const str = AUDIO.errors[errCode - 1]
    return stringToUTF8(str, buffer, bufferLen)
  },

  // ########################################################################################################################
  // -----------------------------------------------------------Font---------------------------------------------------------
  // ########################################################################################################################
  interop_SetFont: function (fontStr, size, flags) {
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
  },
  interop_TextWidth: function (textStr, textLen) {
    const text = UTF8ArrayToString(HEAPU8, textStr, textLen)
    const ctx = window.FONT_CONTEXT
    const data = ctx.measureText(text)
    return data.width
  },
  interop_TextDraw: function (
    textStr,
    textLen,
    bmp,
    dstX,
    dstY,
    shadow,
    hexStr
  ) {
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
  },

  // ########################################################################################################################
  // ------------------------------------------------------------FS----------------------------------------------------------
  // ########################################################################################################################
  interop_FS_Init: function () {
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
          (prevCapacity *
            (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) |
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
      stream_write: function (
        stream,
        buffer,
        offset,
        length,
        position,
        canOwn
      ) {
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
})
