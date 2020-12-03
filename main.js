const http = require('http').createServer();
const redis = require('redis');
// Create the database client
let RedisClient = redis.createClient({
    host: 'open360-redis-sock',
    port: 6379
});

// Listen for any database errors
RedisClient.on("error", function(error) {
    console.error(error);
});

// Require our core modules
const Util = require("open360-util");

// Tell the server what port it should use. 4000 is for testing purposes
const PORT = parseInt(process.env.API_PORT) || 4000;

// Start the socket server
const {Server, Socket} = require('socket.io');
const io = new Server(http, {
    // Allow cross origin requests
    cors: {
        // The `*` is used as the wildcard here.
        origin: "*",
        // Set the other options according to your needs.
        // The docs are here:
        // https://www.npmjs.com/package/cors#configuration-options
        methods: ["GET", "POST"],
        allowedHeaders: ["content-type"]
    }
});

// Require some data over the connections start
io.use((socket, next) => {
    let handshakeData = socket.request;

    // Register the socket to the database along with the room the socket is trying to join
    RedisClient.set(socket.id + "room", 'universal');
    let name = handshakeData._query['name'];
    if (name == ""){
        RedisClient.set(socket.id + "name", false);
        RedisClient.set(socket.id + "colour", false);
    } else {
        RedisClient.set(socket.id + "name", name);
        RedisClient.set(socket.id + "colour", Util.random.randomColour());
    }

    next();
});

// On socket connection
io.on('connection', (socket) => {
    //console.log("New connection on: " + socket.id);
    //log(socket, "connected");
    // Get the room the socket is supposed to be in and add it to the room
    RedisClient.get(socket.id + "room", (err, reply) => {
        socket.join(reply);
    });

    socket.on("log", (data) => {
        log(socket, data.log, data.type);
    });

    socket.on("api-message", (data) => {
        switch (data.type) {
            case "message":
            case Util.api.APIMessageType.message:
            case "question":
            case Util.api.APIMessageType.question:
                log(socket, "Message relayed:" + JSON.stringify(data.package.message), "info");
                socket.broadcast.emit(data.target, data);
                break;
            default:
                try {
                    log(socket, "Unknown message recieved:" + JSON.stringify(data.package.message), "warn");
                    socket.broadcast.emit(data.target, data)
                }
                catch (err) {
                    log(socket, "Unknown message recieved:" + JSON.stringify(data), "warn");
                }
                break;
        }
    });

    // On disconnect delete the socket from the database
    socket.on('disconnect', () => {
        //log(socket, "disconnected");
    });
});

http.listen(PORT, function () {
    console.log("Listening on *:", PORT);
});

/**
 * Logs a message from the socket given
 * @param {Socket} socket
 * @param {string} message
 * @param {string} [type] - "error", "warn", "info" or "log" type beat
 */
function log(socket, message, type){
    // Retrieve the name and colour of the service from the database
    let promises = [
        getName(socket),
        getColour(socket)
    ]
    Promise.all(promises)
        .then((data) => {
            // Define different types of styles
            let style = [
                "color: #fff",
                "background-color: #" + data[1] + "",
                "padding: 2px 4px",
                "border-radius: 2px"
            ].join(';');
            //
            let time = new Date();
            let dateOptions = {
                year: "2-digit",
                month:"2-digit",
                day:"2-digit"
            }
            let timeOptions = {
                hour12 : false,
                hour:  "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
            let dateString = time.toLocaleDateString("en-UK", dateOptions) + "][" + time.toLocaleTimeString("en-UK", timeOptions);
            // Log the message according to the type
            switch (type){
                case "error":
                    console.error(`[${dateString}][%c${data[0]}][ERROR]`, style, message);
                    break;
                case "info":
                    console.info(`[${dateString}][%c${data[0]}][INFO]`, style, message);
                    break;
                case "warn":
                    console.warn(`[${dateString}][%c${data[0]}][WARN]`, style, message);
                    break;
                default:
                    // If no type was passed log normally
                    console.log(`[${dateString}][%c${data[0]}]`, style, message);
            }
        });
}

/**
 * Gets the name of the socket from the database
 * @param {Socket} socket
 * @return {Promise<string>}
 */
function getName(socket){
    return new Promise(resolve => {
        // Get the name of the socket
        RedisClient.get(socket.id + "name", (err, name) => {
            resolve(name);
        });
    });
}

/**
 * Gets the colour of the socket from the database
 * @param {Socket} socket
 * @return {Promise<string>}
 */
function getColour(socket){
    return new Promise(resolve => {
        // Get the colour of the socket
        RedisClient.get(socket.id + "colour", (err, colour) => {
            resolve(colour);
        });
    });
}