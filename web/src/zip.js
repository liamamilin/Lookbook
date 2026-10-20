// Minimal ZIP writer (stored, no compression). The export bundle is a handful of small
// text files, so this avoids pulling in a compression library.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/**
 * @param {{name: string, data: string|Uint8Array}[]} files
 * @param {Date} [date]
 * @returns {Uint8Array}
 */
export function zip(files, date = new Date()) {
  const enc = new TextEncoder()
  const { time, date: day } = dosTime(date)
  const local = []
  const central = []
  let offset = 0

  for (const f of files) {
    const name = enc.encode(f.name)
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data
    const crc = crc32(data)

    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true) // version needed
    head.setUint16(6, 0x0800, true) // UTF-8 file names
    head.setUint16(8, 0, true) // stored
    head.setUint16(10, time, true)
    head.setUint16(12, day, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, data.length, true)
    head.setUint32(22, data.length, true)
    head.setUint16(26, name.length, true)
    local.push(new Uint8Array(head.buffer), name, data)

    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true) // version made by
    dir.setUint16(6, 20, true)
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, 0, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, day, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, data.length, true)
    dir.setUint32(24, data.length, true)
    dir.setUint16(28, name.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), name)

    offset += 30 + name.length + data.length
  }

  const dirSize = central.reduce((n, b) => n + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, dirSize, true)
  end.setUint32(16, offset, true)

  const parts = [...local, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0))
  let p = 0
  for (const b of parts) {
    out.set(b, p)
    p += b.length
  }
  return out
}
