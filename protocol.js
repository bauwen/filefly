module.exports = {
    receiveMessage,
    createMessage,
};

/*
 * The wire protocol:
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
function receiveMessage(callback) {
    let metadata = null;
    let data = null;
    
    const header = Buffer.alloc(4);
    let buffer = header;
    let state = 0;
    let offset = 0;
    let bytesRead = 0;
    let bytesToRead = 4;

    return (chunk) => {
        const length = chunk.length;
        let mark = 0;

        while (mark < length) {
            bytesRead += length - mark;

            if (bytesRead < bytesToRead) {
                chunk.copy(buffer, offset, mark, length);
                offset = bytesRead;
                break;
            } else {
                chunk.copy(buffer, offset, mark, mark + bytesToRead - offset);
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
                        buffer = Buffer.alloc(bytesToRead);
                        state = 2;

                        if (bytesToRead > 0) {
                            break;
                        }

                    case 2:
                        data = buffer;
                        bytesToRead = 4;
                        buffer = header;
                        state = 0;

                        callback(metadata.name, metadata.content, data);
                        break;
                }
            }
        }
    };
}

function createMessage(name, content, buffer) {
    let dataLength = 0;
    if (buffer !== undefined) {
        if (!Buffer.isBuffer(buffer)) {
            throw new TypeError("buffer must be a buffer, not " + typeof buffer);
        }
        dataLength = buffer.length;
    }
    const json = JSON.stringify({
        name: name,
        content: content,
        length: dataLength
    });
    const metadataLength = Buffer.byteLength(json);
    const packet = Buffer.alloc(4 + metadataLength + dataLength);

    packet.writeUInt32BE(metadataLength);
    packet.write(json, 4, metadataLength);
    if (dataLength > 0) {
        buffer.copy(packet, 4 + metadataLength, 0, dataLength);
    }

    return packet;
}
