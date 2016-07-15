// Variable port setting for heroku

var port = process.env.PORT || 3000;

var app = require('express').createServer();
var io = require('socket.io').listen(app);
var apiai = require('apiai');
var app2 = apiai("0b25372273e042f29d6333faec6d4065");

app.listen(port);

// Heroku setting for long polling - assuming io is the Socket.IO server object
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

// routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

// usernames which are currently connected to the chat
var usernames = {};

io.sockets.on('connection', function (socket) {

    // when the client emits 'sendchat', this listens and executes
    socket.on('sendchat', function (data) {
        // we tell the client to execute 'updatechat' with 2 parameters
        io.sockets.emit('updatechat', socket.username, data);
        if (socket.username != 'bot'){
            var request = app2.textRequest(data);
            request.on('response', function(response) {
                console.log(response);
                if (response.status.code == '200'){
                    io.sockets.emit('updatechat', 'bot', response.result.fulfillment.speech);
                } else {
                    io.sockets.emit('updatechat', 'bot', 'Hmm, I don\'t quite have an answer for you, let me check further.');  
                }
            }
        });
 
        request.on('error', function(error) {
            console.log(error);
        });
 
        request.end()
    });

    // when the client emits 'adduser', this listens and executes
    socket.on('adduser', function(username){
        // we store the username in the socket session for this client
        socket.username = username;
        // add the client's username to the global list
        usernames[username] = username;
        // echo to client they've connected
        socket.emit('updatechat', 'SERVER', 'you have connected');
        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('updatechat', 'SERVER', username + ' has connected');
        // update the list of users in chat, client-side
        io.sockets.emit('updateusers', usernames);
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function(){
        // remove the username from global usernames list
        delete usernames[socket.username];
        // update list of users in chat, client-side
        io.sockets.emit('updateusers', usernames);
        // echo globally that this client has left
        socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
    });
});