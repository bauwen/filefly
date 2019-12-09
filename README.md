# Filefly

Filefly is a dependency-free pair of Node.js command-line scripts that lets you send files from one computer to the other. Although you can send files over the internet, it is meant to be used locally.

## Usage

You need to have [Node.js](https://nodejs.org/) installed.

The receiving computer starts accepting files in a given directory. If no directory is specified, the current working directory is assumed. Optionally, a custom port number can be specified as well.

    node receiver [directory] [port number]

Next, the sending computer can start sending files that are located on its own system. This can either be a single file or a directory. In the case of a directory, all its files and complete subdirectories will be sent over. Optionally, a destination IP address and a port number can be specified. If no IP address is given, Filefly will try to automatically locate a receiving computer in the local network.

    node sender <filename|directory> [ip address] [port number]
