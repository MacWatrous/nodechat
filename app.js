// Variable port setting for heroku

var port = process.env.PORT || 3000;
//var path = require("path");
//var express = require('express');
//var app = express.createServer();
var app = require('express').createServer();
var io = require('socket.io').listen(app);
var apiai = require('apiai');
var app2 = apiai("0b25372273e042f29d6333faec6d4065");
var request = require('request');

app.listen(port);

// Heroku setting for long polling - assuming io is the Socket.IO server object
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

//app.use(express.static(path.join(__dirname, 'public')));
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
        if (data.lastIndexOf("ADD") == -1)
        	io.sockets.emit('updatechat', socket.username, data);
        if (socket.username != 'bot'){
            var request2 = app2.textRequest(data,
            	{
            		sessionId: socket.id
            	});
            request2.on('response', function(response) {
                console.log(response);
                if (response.status.code == '200'){
                    io.sockets.emit('updatechat', 'bot', response.result.fulfillment.speech);
                } else {
                    io.sockets.emit('updatechat', 'bot', 'Hmm, I don\'t quite have an answer for you, let me check further.');
                    socket.broadcast.emit('alert');  
                }
            });
            request2.on('error', function(error) {
            console.log(error);
            });
            request2.end()
        }
        else if (socket.username == 'bot'){
            if (data.lastIndexOf("ADDE:") != -1){
                var drug = data.split(": ");
                console.log(drug);
                var synonyms =[];
                request.get({
	                headers: {
	                    'Authorization': 'Bearer b9c554f76c3b471780436428dd458afd',
	                    'Content-Type': 'application/json',
	                    'Accept': 'application/json'
	                },
	                url: 'https://api.api.ai/v1/entities/drug',
	            }, function(error, response, body){
					//console.log(body);
					body = JSON.parse(body);
					console.log(drug);

					console.log(body.entries.length);
	            	console.log(body.entries[1].value);
	                for (var i=0; i<body.entries.length; i++){
	                	//console.log("hi");
		                if (body.entries[i].value == drug[1]){
		                	console.log(body.entries[i].synonyms[0]);
		                	console.log('hello match here!');
		                	for (var j=0; j<body.entries[i].synonyms.length; j++){
		                		synonyms.push(body.entries[i].synonyms[j]);
		                	}
		                }
		            }
////////////////////COPY AND PASTE///////////////////////////////
		            if (drug[2] == null){
		                request.put({
		                	headers: {
		                        'Authorization': 'Bearer b9c554f76c3b471780436428dd458afd',
		                        'Content-Type': 'application/json',
		                        'Accept': 'application/json'
		                    },
		                    url: 'https://api.api.ai/v1/entities/drug/entries',
		                    body: {
		                    	"value": drug[1],
		                    	"synonyms": [
		                    		drug[1]
		                    	]
		                    },
		                    json: true
		                }, function(error, response, body){
		                	console.log(body);
		                });
	            	}
		            else {
		            	synonyms.push(drug[2]);
						request.put({
		                	headers: {
		                        'Authorization': 'Bearer b9c554f76c3b471780436428dd458afd',
		                        'Content-Type': 'application/json',
		                        'Accept': 'application/json'
		                    },
		                    url: 'https://api.api.ai/v1/entities/drug/entries',
		                    body: {
		                    	"value": drug[1],
		                    	"synonyms": synonyms
		                    },
		                    json: true
		                }, function(error, response, body){
		                	console.log(body);
		                });
		            }

	            });
            }
        }
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

    // when the client emits 'alert', this listens and executes
    socket.on('alert', function(message){
        console.log('alerted');
        io.sockets.emit('updatechat', 'bot', message);
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