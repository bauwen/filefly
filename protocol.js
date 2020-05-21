const stream = require("stream");

module.exports = {
    receiveMessage,
    sendMessage,
};

/*
 * The wire protocol:
 * -----------------
 *
 *      Packet layout:
 *
 *          metadata length [x] (4 bytes) | metadata ([x] bytes) | data ([y] bytes)
 *          (unsigned 32-bit integer)       (UTF-8 JSON string)    (raw bytes)
 *                                          ({length: [y], ...})
 *
 *      Packet example:
 *
 *          12 | {"length":7} | 63 6f 6e 74 65 6e 74
 *
 */
 function receiveMessage(inputStream, callback) {
    let metadata = null;
    let data = null;
    
    const header = Buffer.alloc(4);
    let buffer = header;
    let state = 0;
    let offset = 0;
    let bytesRead = 0;
    let bytesToRead = 4;
    let outputStream = null;
    
    inputStream.on("data", (chunk) => {
        const length = chunk.length;
        let mark = 0;

        while (mark < length) {
            bytesRead += length - mark;
            
            if (bytesRead < bytesToRead) {
                if (state === 2) {
                    outputStream.write(chunk.slice(mark, length));
                } else {
                    chunk.copy(buffer, offset, mark, length);
                }
                offset = bytesRead;
                break;
            }
            else {
                if (state === 2) {
                    outputStream.end(chunk.slice(mark, mark + bytesToRead - offset));
                } else {
                    chunk.copy(buffer, offset, mark, mark + bytesToRead - offset);
                }
                
                mark += bytesToRead - offset;
                offset = 0;
                bytesRead = 0;

                switch (state) {
                    case 0:
                        bytesToRead = buffer.readUInt32BE(0);
                        buffer = Buffer.alloc(bytesToRead);
                        state = 1;
                        break;

                    case 1:
                        metadata = JSON.parse(buffer.toString("utf8"));
                        bytesToRead = metadata.length;
                        outputStream = new stream.PassThrough();
                        callback(metadata.name, metadata.content, outputStream);
                        state = 2;
                        
                        if (bytesToRead === 0) {
                            outputStream.end();
                        } else {
                            break;
                        }
                        
                    case 2:
                        data = buffer;
                        bytesToRead = 4;
                        buffer = header;
                        outputStream = null;
                        state = 0;
                        break;
                }
            }
        }
    });
}

function sendMessage(outputStream, name, content, inputSize, inputStream) {
    if (inputSize === undefined || inputStream === undefined) {
        inputSize = 0;
    }
    
    const json = JSON.stringify({
        name: name,
        content: content,
        length: inputSize,
    });
    const metadataLength = Buffer.byteLength(json);
    const packet = Buffer.alloc(4 + metadataLength);
    packet.writeUInt32BE(metadataLength);
    packet.write(json, 4, metadataLength);
    outputStream.write(packet);
    
    if (inputSize > 0) {
        inputStream.pipe(outputStream, { end: false });
    }
}
