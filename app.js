
var express = require('express');
var app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);

var mustache = require("mustache-express");
app.engine("html", mustache());
app.set("views", __dirname + "/views");
app.set("view engine", "html");
app.use(express.static('static'));


app.get("/", function(req, res) {
  res.render("home");
});

app.get("/:team", function(req, res) {
  res.render("team", {
    team: req.params.team
  });
});


rosters = {}

function roster(team) {
  var roster = {
    "members": [],
    "average": null
  };

  var voteTotal = 0;
  var voterCount = 0;
  var shouldSendAverage = true;

  for (var member in rosters[team]) {
    if (rosters[team][member].active) {
      roster.members.push({
        "color": member,
        "vote": rosters[team][member].vote,
        "lurker": rosters[team][member].lurker
      });

      if (!rosters[team][member].lurker) {
        if (rosters[team][member].vote) {
          if (rosters[team][member].vote != "?") {
            voterCount += 1;
            voteTotal += rosters[team][member].vote;
          }
        } else {
          shouldSendAverage = false;
        }
      }
    }
  }

  if (shouldSendAverage) {
    roster.average = voteTotal / voterCount;
  }

  return roster;
}

function addToRoster(team, member) {
  if (!rosters[team]) {
    rosters[team] = {};
  }

  if (!rosters[team][member]) {
    rosters[team][member] = {
      "active": false,
      "vote": null,
      "lurker": false
    }
  }

  rosters[team][member].active = true;
}

function lurk(team, member) {
  if (rosters[team] && rosters[team][member]) {
    rosters[team][member].lurker = true;
    rosters[team][member].vote = null;
  }
}

function participate(team, member) {
  if (rosters[team] && rosters[team][member]) {
    rosters[team][member].lurker = false;
  }
}

function addVote(team, member, vote) {
  if (rosters[team] && rosters[team][member]) {
    rosters[team][member].vote = vote;
  }
}

function clearVotes(team) {
  for (var member in rosters[team]) {
    rosters[team][member].vote = null;
  }
}

function leaveTeam(team, member) {
  if (rosters[team] && rosters[team][member]) {
    rosters[team][member].active = false;
  }
}


io.on("connection", function(socket) {
  socket.on("disconnect", function() {
    if (socket.nickname) {
      console.log("disconnected " + socket.nickname);

      var pieces = socket.nickname.split("-TEAM:");
      var color = pieces[0];
      var team = pieces[1];

      leaveTeam(team, color);
      socket.to(team).emit("roster", roster(team));
    }
  });

  socket.on("join", function(data) {
    console.log(data);

    socket.nickname = data.color + "-TEAM:" + data.team;

    socket.join(data.team);
    addToRoster(data.team, data.color);

    io.in(data.team).emit("roster", roster(data.team));
  });

  socket.on("new-test-member", function(data) {
    addToRoster(data.team, data.color);
    io.in(data.team).emit("roster", roster(data.team));
  });

  socket.on("evict", function(data) {
    leaveTeam(data.team, data.color);
    io.in(data.team).emit("roster", roster(data.team));
  });

  socket.on("vote", function(data) {
    addVote(data.team, data.color, data.vote);
    io.in(data.team).emit("roster", roster(data.team));
  });

  socket.on("clear-all-votes", function(data) {
    clearVotes(data.team);
    io.in(data.team).emit("roster", roster(data.team));
    io.in(data.team).emit("votes-cleared");
  });

  socket.on("lurk", function(data) {
    lurk(data.team, data.color);
    io.in(data.team).emit("roster", roster(data.team));
  });

  socket.on("participate", function(data) {
    participate(data.team, data.color);
    io.in(data.team).emit("roster", roster(data.team));
  });
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
http.listen(port);
