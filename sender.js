const dgram = require("dgram");
const fs = require("fs");
const net = require("net");
const path = require("path");
const protocol = require("./protocol.js");

const PORT = 3080;

function main(args) {
    if (args.length < 3) {
        console.log("Please provide a file or directory to send.");
        return;
    }
    const entry = args[2];
    const host = args.length > 3 ? args[3] : "";
    const port = args.length > 4 ? parseInt(args[4]) : PORT;

    if (!fs.existsSync(entry)) {
        console.log("The given file or directory does not exist.");
        return;
    }
    if (port < 1 || 65535 < port) {
        console.log("The given port number is invalid.");
        return;
    }
    
    if (!host) {
        searchHost(port, (address) => {
            if (!address) {
                console.log("Unable to find a receiving computer on the network.");
                return;
            }
            sendFiles(entry, address, port);
        });
    } else {
        sendFiles(entry, host, port);
    }
}

function searchHost(port, callback) {
    const socket = dgram.createSocket("udp4");
    let interval = null;
    let found = false;
    
    socket.bind(port + 1);
    socket.on("listening", () => {
        socket.setBroadcast(true);
        const sendBroadcast = () => {
            socket.send("hi", port + 2, "255.255.255.255", (err) => {
                if (err) {
                    callback("");
                }
            });
        };
        interval = setInterval(sendBroadcast, 1000);
        sendBroadcast();
    });
    socket.on("message", (message, info) => {
        if (!found) {
            found = true;
            clearInterval(interval);
            socket.close();
            callback(info.address);
        }
    });
}

function sendFiles(entry, host, port) {
    const prefix = path.dirname(entry);
    const base = path.basename(entry);
    
    const list = [];
    const size = mapFileStructure(list, prefix, base);
    
    const count = list.length;
    console.log(`Found ${count} file${count === 1 ? "" : "s"} to send.`);
    console.log("Total size: " + size + " bytes.\n");
    
    let index = 0;
    const socket = net.connect(port, host);
    protocol.receiveMessage(socket, (id) => {
        if (id === "received") {
            if (index < list.length - 1) {
                index += 1;
                sendNextFile(socket, list, index, prefix);
            } else {
                console.log("\nAll files have been sent successfully.");
                socket.end();
            }
        }
    });
    sendNextFile(socket, list, index, prefix);
}

function sendNextFile(socket, list, index, prefix) {
    const entry = list[index];
    
    console.log(`${index + 1}/${list.length}: ${entry.name}`);
    
    switch (entry.type) {
        case "directory":
            protocol.sendMessage(socket, "directory", entry.name);
            break;
            
        case "file":
            const pathname = path.join(prefix, entry.name);
            const fileSize = fs.statSync(pathname).size;
            const fileStream = fs.createReadStream(pathname);
            protocol.sendMessage(socket, "file", entry.name, fileSize, fileStream);
            break;
    }
}

function mapFileStructure(list, prefix, base) {
    let size = 0;
    
    const fullPath = path.join(prefix, base);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
        list.push({
            type: "directory",
            name: base,
        });
        fs.readdirSync(fullPath).forEach(file => {
            size += mapFileStructure(list, prefix, path.join(base, file));
        });
    } else {
        list.push({
            type: "file",
            name: base,
        });
        size += stat.size;
    }
    
    return size;
}

main(process.argv);
