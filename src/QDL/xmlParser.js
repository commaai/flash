export class xmlParser {
  getReponse(input) {
    let tInput = new TextDecoder().decode(input);
    let lines = tInput.split("<?xml");
    let content = {}
    const replaceBytes = new TextDecoder().decode(new Uint8Array([0xf0, 0xe9, 0x88, 0x14]));
    for (let line of lines) {
      if ("" == line) {
        continue;
      }
      line = "<?xml" + line;
      if (line.includes(replaceBytes)) {
        line.replace(replaceBytes, "")
      }
      const xmlDoc = new DOMParser().parseFromString(line, "text/xml");
      const responseElement = xmlDoc.querySelector('response');
      if (responseElement !== null) {
        content = Array.from(responseElement.attributes).reduce((obj, attr) => {
          obj[attr.name] = attr.value;
          return obj;
        }, content);
      }
    }
    return content;
  }


  getLog(input) {
    let tInput = new TextDecoder().decode(input);
    let lines = tInput.split("<?xml");
    let data = [];
    const replaceBytes = new TextDecoder().decode(new Uint8Array([0xf0, 0xe9, 0x88, 0x14]));
    for (let line of lines) {
      if ("" == line) {
        continue;
      }
      line = "<?xml" + line;
      if (line.includes(replaceBytes)) {
        line.replace(replaceBytes, "")
      }
      const xmlDoc = new DOMParser().parseFromString(line, "text/xml");
      const responseElement = xmlDoc.querySelector('log');
      if (responseElement !== null) {
        data = Array.from(responseElement.attributes).reduce((obj, attr) => {
          if (attr.name == "value")
           obj.push(attr.value);
          return obj;
        }, data);
      }
    }
    return data;
  }
}
