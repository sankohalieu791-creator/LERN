// Minimal ZIP (STORE method, no compression) writer — just enough to bundle
// a folder's files into one archive for project submission uploads, without
// pulling in a compression library. See APPNOTE.TXT for the format this
// implements: local file headers, a central directory, and the EOCD record.

function crc32(data: Uint8Array): number {
  let crc = ~0
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function dosDateTime(date: Date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f)
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f)
  return { time, day }
}

export async function createZip(files: { name: string; data: Uint8Array }[]): Promise<Blob> {
  const { time, day } = dosDateTime(new Date())
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name.replace(/\\/g, '/'))
    const crc = crc32(file.data)
    const size = file.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)       // version needed
    local.setUint16(6, 0, true)        // flags
    local.setUint16(8, 0, true)        // method: store
    local.setUint16(10, time, true)
    local.setUint16(12, day, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true)    // compressed size
    local.setUint32(22, size, true)    // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true)       // extra field length
    localParts.push(new Uint8Array(local.buffer), nameBytes, file.data)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)     // version made by
    central.setUint16(6, 20, true)     // version needed
    central.setUint16(8, 0, true)
    central.setUint16(10, 0, true)     // method: store
    central.setUint16(12, time, true)
    central.setUint16(14, day, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, size, true)
    central.setUint32(24, size, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint16(30, 0, true)     // extra length
    central.setUint16(32, 0, true)     // comment length
    central.setUint16(34, 0, true)     // disk number start
    central.setUint16(36, 0, true)     // internal attrs
    central.setUint32(38, 0, true)     // external attrs
    central.setUint32(42, offset, true) // local header offset
    centralParts.push(new Uint8Array(central.buffer), nameBytes)

    offset += local.buffer.byteLength + nameBytes.length + size
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0)
  const centralOffset = offset

  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)
  eocd.setUint16(4, 0, true)
  eocd.setUint16(6, 0, true)
  eocd.setUint16(8, files.length, true)
  eocd.setUint16(10, files.length, true)
  eocd.setUint32(12, centralSize, true)
  eocd.setUint32(16, centralOffset, true)
  eocd.setUint16(20, 0, true)

  const allParts = [...localParts, ...centralParts, new Uint8Array(eocd.buffer)] as BlobPart[]
  return new Blob(allParts, { type: 'application/zip' })
}
