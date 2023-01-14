var express = require('express');
var socket = require('socket.io');

// Used for managing the user list
var connectionArray = [];

// App setup
var app = express();
var server = app.listen(4000, function() {
    console.log('listening to requests on port 4000');
});

// Static files
app.use(express.static('public'));

// Socket setup
var io = socket(server);

io.on('connection', function(socket) {
    console.log('made socket connection', socket.id);
    connectionArray.push(socket);

    sendUsers();
    
    //var msg = {};
    socket.on('message', function(data) {
        console.log(data, socket.id);
        if (socket.id == connectionArray[0].id) {
            console.log("YEET");
            connectionArray[1].send(data);
        }
        else {
            connectionArray[0].send(data);
        }
    });

});

function sendToOneUser(target, msgString) {
    connectionArray.find((conn) => conn.id === target).send(msgString);
}

function sendUsers() {
    let users = []
    for (conn of connectionArray) {
        users.push(conn.id);
    }
    io.emit('users-update', { userArray: users });
}












// if (message.type === 'utf8') {
        //     msg = JSON.parse(message.utf8Data);
        //     var msgString = JSON.stringify(msg);

        //     if (msg.target && msg.target !== undefined && msg.target.length !== 0) {
        //         sendToOneUser(msg.target, msgString);
        //     } else {
        //         for (const connection of connectionArray) {
        //             connection.send(msgString);
        //         }
        //     }
        // }