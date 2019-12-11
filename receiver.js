const dgram = require("dgram");
const fs = require("fs");
const net = require("net");
const path = require("path");
const protocol = require("./protocol.js");

const PORT = 3080;

function main(args) {
    let directory = args.length > 2 ? args[2] : process.cwd();
    const port = args.length > 4 ? parseInt(args[4]) : PORT;
    
    if (port < 1 || 65535 < port) {
        console.log("The given port number is invalid.");
        return;
    }
    if (!fs.existsSync(directory)) {
        console.log("The given directory does not exist.");
        return;
    }
    if (!fs.statSync(directory).isDirectory()) {
        console.log("First argument must be a directory.");
        return;
    }
    if (!path.isAbsolute(directory)) {
        directory = path.join(process.cwd(), directory);
    }
    
    createUDPServer(port);
    createTCPServer(port, directory);
}

function createUDPServer(port) {
    const socket = dgram.createSocket("udp4");
    socket.on("listening", () => {
        socket.setBroadcast(true);
    });
    socket.on("message", (message, info) => {
        console.log(`Received broadcast message from ${info.address}:${info.port}.`);
        socket.send("hi", port + 1, "255.255.255.255");
    });
    socket.bind(port + 2);
}

function createTCPServer(port, directory) {
    const server = net.createServer();
    server.on("listening", () => {
        console.log("Server listening on port " + port + ".\n");
    });
    server.on("connection", (socket) => {
        socket.on("data", protocol.receiveMessage((type, name, buffer) => {
            const fullPath = path.join(directory, name);    
            switch (type) {
                case "directory":
                    //if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
                    //    fs.unlinkSync(fullPath);
                    //}
                    if (!fs.existsSync(fullPath)) {
                        fs.mkdirSync(fullPath);
                    }
                    socket.write(protocol.createMessage("received"));
                    break;                 
                case "file":
                    try {
                        fs.writeFileSync(fullPath, buffer);
                        console.log(`Received file '${name}'.`);
                    } catch (err) {
                        console.log(`Received file '${name}' (but did not get written).`);
                    }
                    socket.write(protocol.createMessage("received"));
                    break;
            }
        }));
    });
    server.listen(port);
}

main(process.argv);
