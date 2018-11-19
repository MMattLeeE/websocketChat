var WebSocketServer = require('websocket').server;
var http = require('http');
var express = require('express');
var path = require('path');
//var fs = require('fs');
var webSocketsServerPort = 1337;

// is an array of objects with properties:
//    time
//    text
//    author
//    color
var chatHistory =[];

// is an array of connection objects. Represents the current connections to the
// ws server
var clients =[];

//helper function to escape input strings
function htmlEntities(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

//------------------------------HTTP SERVER-----------------------------//
//WS rides on top of an http server. WS needs a http server created. 
//The callback is blank as we wont be handling any http req or res.
//----------------------------------------------------------------------//
var app = express();

app.use(express.static(__dirname));

var server = app.listen(webSocketsServerPort, function() {
  console.log((new Date()) + " Server is listening to port " + webSocketsServerPort);
});


//------------------------WEBSOCKETS SERVER-----------------------------//
// The WS server is created and mounted to the HTTP server.
// Then the behavior of the server is defined.
// The server will get a request from a client then create a 
// connection (object). Then there are callbacks which listen to the 
// connection object: listen for messages or when connections are closed.
// inputs: request or message or close
// outputs: objects
//    type: history, color, message
//----------------------------------------------------------------------// 
var wsServer = new WebSocketServer({
  httpServer: server
});

// Below is the behavior of the WebSocket server. 
// 'request' code defines what happens everytime someone tries 
// to connect to wsServer.
wsServer.on('request', function(request) {
  //first establish and accept a connection:
  console.log((new Date()) + ' Connection from origin '+ request.origin + '.');
  
  var connection = request.accept(null, request.origin);
  // Saving the index of the client connection to remove it when they disconnect; 
  // .push returns the length of the array clients
  var index = clients.push(connection) - 1;
  var userName = false;
  var userColor = false;
  console.log((new Date()) + ' Connection accepted.');

  // After a connection is established, send the chat history
  // Its a json object the client will decode
  if (chatHistory.length > 0) {
    connection.sendUTF(JSON.stringify({ type: 'history', data: chatHistory} ));
  }

  // user sends message via connection obj. 
  // Send back obj with properties:
  //    type
  //    data 
  connection.on('message', function(message) {
    if (message.type === 'utf8') { //accept only text
    // the first message sent by client will be the userName
      if (userName === false) { //if no username is present for connection:
        console.log(typeof message.utf8Data);
        userName = htmlEntities(message.utf8Data);

        // get random color and send it back to the user
        userColor = colors.shift();
        connection.sendUTF(JSON.stringify({ type:'color', data: userColor }));
        console.log((new Date()) + ' User is known as: ' + userName+ ' with ' + userColor + ' color.');
      
      }else { // log and broadcast the message to all connections:
        console.log((new Date()) + ' Received Message from '+ userName + ': ' + message.utf8Data);
        
        //store message in object:
        var obj = {
          time: (new Date()).getTime(),
          text: htmlEntities(message.utf8Data),
          author: userName,
          color: userColor
        };

        // we want to keep chatHistory of last 100 messages
        chatHistory.push(obj);
        chatHistory = chatHistory.slice(-100);

        //create object to send back to client: 
        var json = JSON.stringify({ type:'message', data: obj });
        
        // broadcast message to all connected clients
        for (var i=0; i < clients.length; i++) {
          clients[i].sendUTF(json);
        }
      }
    }
  });

  // user disconnected
  connection.on('close', function(connection) {
    if (userName !== false && userColor !== false) {
      console.log((new Date()) + " Peer "
          + connection.remoteAddress + " disconnected.");
      // remove user from the list of connected clients
      clients.splice(index, 1);
      // push back user's color to be reused by another user
      colors.push(userColor);
    }
  });
});