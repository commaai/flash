export class structHelper_io {
  data;
  direction;

  constructor(data, pos=0) {
    this.pos = pos
    this.data = data;
  }

  dword(littleEndian=true) {
    let view = new DataView(this.data.slice(this.pos, this.pos+4).buffer, 0);
    this.pos += 4;
    return view.getUint32(0, littleEndian);
  }

  qword(littleEndian=true) {
    let view = new DataView(this.data.slice(this.pos, this.pos+8).buffer, 0);
    this.pos += 8;
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

export function containsBytes(subString, array) {
  let tArray = new TextDecoder().decode(array);
  return tArray.includes(subString);
}

export function compareStringToBytes(compareString, array) {
  let tArray = new TextDecoder().decode(array);
  return compareString == tArray;
}

export async function loadFileFromLocal() {
  const [fileHandle] = await window.showOpenFilePicker();
  let blob = await fileHandle.getFile();
  return blob;
}

export function readBlobAsBuffer(blob) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsArrayBuffer(blob);
  });
}

export function fromUint8ArrayToNumber(array) {
  let view = new DataView(array.buffer, 0);
  if (array.length > 4) {
    console.error("Only returns <= 32 bit number");
    return null;
  }
  return view.getUint32(0, true);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
