export class structHelper_io {
  data;
  direction;

  constructor(data) {
    this.data = data;
  }

  dword(idx_start, littleEndian=true) {
    let view = new DataView(this.data.slice(idx_start, idx_start+4).buffer, 0);
    return view.getUint32(0, littleEndian);
  }

  qword(idx_start, littleEndian=true) {
    let view = new DataView(this.data.slice(idx_start, idx_start+8).buffer, 0);
    return view.getBigUint64(0, littleEndian);
  }
}

export function packGenerator(elements, littleEndian=true) {
  let n = elements.length;
  const buffer = new ArrayBuffer(n*4);
  const view = new DataView(buffer);
  for (let i = 0; i < n; i++){
    view.setUint32(i*4, elements[i], littleEndian);
  }
  return new Uint8Array(view.buffer);
}

export function concatUint8Array(arrays){
  let length = 0;
  arrays.forEach(item => {
    if (item !== null)
      length += item.length;
  });

  let concatArray = new Uint8Array(length);
  let offset = 0;
  arrays.forEach( item => {
    if (item !== null) {
      concatArray.set(item, offset);
      offset += item.length;
    }
  });

  return concatArray;
}
