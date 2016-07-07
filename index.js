var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
   res.sendFile(__dirname + '/index.html');
});

var games = [];

var Player = function(x, y) {
    this.socket = undefined;
    this.x = x;
    this.y = y;
    this.height = 300;
    this.name = "Opponent";
    this.points = 0;
    
    this.score = function() {
        this.points++;
    }
    
    this.move = function(amount) {
        this.y += amount;
        if (this.y < 0) {
            this.y = 0;
        }
        if (this.y + this.height > 800) {
            this.y = 800 - this.height;
        }
    }
}

var getGame = function(socket) {
    for (var i = 0; i < games.length; i++) {
        var g = games[i];
        if (g.player1.socket === socket || g.player2.socket === socket) {
            return g;
        }
    }
    return 0;
}

var getPlayer = function(g, socket) {
    if (g.player1.socket === socket) {
        return g.player1;
    } else if (g.player2.socket === socket) {
        return g.player2;
    } else {
        return undefined;
    }
}

var Ball = function(x, y) {
    this.originx = x;
    this.originy = y;
    this.x = x;
    this.y = y;
    this.xvelocity = 3;
    this.yvelocity = -0.5;
    
    this.canMove = true;
    this.reset = function() {
        this.x = this.originx;
        this.y = this.originy;
        this.xvelocity = 3;
        this.yvelocity = -0.5;
        this.canMove = false;
        setTimeout(function(ball) {ball.canMove = true;}, 1000, this);
    }
}

var Game = function() {
    this.player1 = new Player(200, 50);
    this.player2 = new Player(1100, 50);
    this.ball = new Ball(500, 400);
    
    this.finished = false;
    
    this.end = function() {
        this.player1.socket.emit("end", "");
        this.player2.socket.emit("end", "");
    }
    
}

var lobby = []; // list of players in lobby

io.on('connection', function(socket){
    
    if (lobby.length >= 1) {
        var new_game = new Game();
        new_game.player1.socket = lobby.shift();
        new_game.player2.socket = socket;
        
        games.push(new_game);
    } else {
        lobby.push(socket);
    }
    
    // when the user disconnects
    socket.on('disconnect', function(){
        var game = getGame(socket);
        if (game !== 0 && !game.finished) {
            game.end();
            games.splice(games.indexOf(game), 1);
        }
    });
    
    socket.on('name', function(val) {
        var game = getGame(socket);
        var player = getPlayer(game, socket);
        console.log(val + " has joined the game.")
        if (game.player1.socket === socket) {
            game.player1.socket.emit("p1-name", val);
            game.player2.socket.emit("p1-name", val);
        } else if (game.player2.socket === socket) {
            game.player1.socket.emit("p2-name", val);
            game.player2.socket.emit("p2-name", val);
        }
    });
    
    // when the user moves
    socket.on('move', function(val) {
        var game = getGame(this);
        if (game === 0) {
            // they are still in lobby, not allowed to move
            return;
        }
        var player = getPlayer(game, this);
        if (player !== undefined) {
            if (val === "up") {
                player.move(-3);
            } else if (val === "down") {
                player.move(3);
            }
            if (game.player1.socket === socket) {
                game.player1.socket.emit("update player1", game.player1.y);
                game.player2.socket.emit("update player1", game.player1.y);
            } else {
                game.player1.socket.emit("update player2", game.player2.y);
                game.player2.socket.emit("update player2", game.player2.y);
            }
        }
    });
    
});

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

var update = function(g) {
    if (g.player1.socket !== undefined && g.player2.socket !== undefined) {
        
        if (g.ball.canMove) {
            g.ball.x += g.ball.xvelocity;
            g.ball.y += g.ball.yvelocity;
        }
        
        if (g.ball.x < 250 && g.ball.x > 175 && g.ball.y > g.player1.y && g.ball.y < g.player1.y + 300) {
            g.ball.xvelocity *= -1.1;
            g.ball.yvelocity = rand(-3.5, 3.5);
        }
        
        if (g.ball.x > 1075 && g.ball.x < 1150 && g.ball.y > g.player2.y && g.ball.y < g.player2.y + 300) {
            g.ball.xvelocity *= -1.1;
            g.ball.yvelocity = rand(-3.5, 3.5);
        }
        
        if (g.ball.y > 775 || g.ball.y < 0) {
            g.ball.yvelocity *= -1;
        }
        
        if (g.ball.x <= 0) {
            g.ball.reset();
            g.player2.score();
            g.player1.socket.emit("player2-score", "");
            g.player2.socket.emit("player2-score", "");
        } else if (g.ball.x >= 1350) {
            g.ball.reset();
            g.player1.score();
            g.player1.socket.emit("player1-score", "");
            g.player2.socket.emit("player1-score", "");
        }
        
        if (g.player1.points >= 5) {
            g.player1.socket.emit("win", g.player1.points + " to " + g.player2.points);
            g.player2.socket.emit("lose", g.player2.points + " to " + g.player1.points);
            g.finished = true;
            g.ball.canMove = false;
        } else if (g.player2.points >= 5) {
            g.player2.socket.emit("win", g.player1.points + " to " + g.player2.points);
            g.player1.socket.emit("lose", g.player2.points + " to " + g.player1.points);
            g.finished = true;
            g.ball.canMove = false;
        }
        
        g.player1.socket.emit("update ball", g.ball.x + " " + g.ball.y);
        g.player2.socket.emit("update ball", g.ball.x + " " + g.ball.y);
    }
};

var update_games = function() {
    for (var i = 0; i < games.length; i++) {
        update(games[i]);
    }
}

setInterval(update_games, 10);


http.listen(3000, function(){
  console.log('listening on localhost:3000');
});