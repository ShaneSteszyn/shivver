/*jslint node: true */
'use strict';

var express = require('express'),
  app = express();
var logger = require('morgan');
var http = require('http').Server(app);
var hbs = require('hbs');
var fs = require('fs');
var request = require('request');
var _path = require('path');
var compression = require('compression');
var levelup = require('levelup'),
  db = levelup('./db');

var config = fs.readFileSync('config.json');
config = JSON.parse(config);

var spd = config.ShadowplayDirectory;

app.set('view engine', 'hbs');
app.set('json spaces', 4);
app.use(logger());
app.use(compression());
app.use(express.static('public'));

hbs.registerHelper('string', function(object) {
  return JSON.stringify(object);
});

var apikey = '7e5b358f8f531fc376f3f8ee3b42b2092b67a6b2';

function fetchGame(game, cb) {
  db.get(game, function(err, res) {
    if (!err) {
      return cb(JSON.parse(res));
    } else {
      var root = 'http://www.giantbomb.com/api/';
      var list = root + 'search?api_key=' + apikey + '&format=json&query=' + game + '&resources=game';
      request.get(list, function(e, r, b) {
        var single = JSON.parse(b);
        single = single.results[0].api_detail_url;
        request.get(single + '?format=json&api_key=' + apikey, function(e, r, b) {
          db.put(game, b, function(err) {
            if (err) throw err;
          });
          return cb(JSON.parse(b));
        });
      });
    }
  });
}

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/public' + '/index.html');
});

app.get('/games', function(req, res) {
  var files = fs.readdirSync(spd);
  var folders = [];
  for (var id in files) {
    if (!fs.existsSync(files[id])) {
      folders.push(files[id]);
    }
  }
  res.render('games', {
    games: folders
  });
});

app.get('/games/:game', function(req, res) {
  var game = req.params.game;
  var path = spd + '/' + game;
  if (fs.existsSync(path)) {
    var videos = [];
    var files = fs.readdirSync(path);
    for (var id in files) {
      if (files[id].split(".").pop() === 'mp4') {
        videos.push(files[id]);
      }
    }
    console.log(files);
    fetchGame(game, function(gameData) {
      console.log(gameData.results);
      res.render('game', {
        game: game,
        videos: videos,
        data: gameData.results
      });
    });
  } else {
    res.send(404);
  }
});

app.get('/games/:game/:video', function(req, res) {
  var game = req.params.game;
  var video = req.params.video;
  var path = '/videos/' + video;
  res.render('video', {
    game: game,
    video: video,
    path: path
  });
});

app.get('/videos/:video', function(req, res) {
  var video = decodeURI(req.params.video);
  var game = video.split('.')[0];
  game = game.substring(0, game.length - 3);

  var path = _path.resolve(spd + '/' + game + '/' + video);
  var stat = fs.statSync(path);
  var total = stat.size;
  if (req.headers.range) {
    var range = req.headers.range;
    var parts = range.replace(/bytes=/, "").split("-");
    var partialstart = parts[0];
    var partialend = parts[1];

    var start = parseInt(partialstart, 10);
    var end = partialend ? parseInt(partialend, 10) : total - 1;
    var chunksize = (end - start) + 1;
    console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

    var file = fs.createReadStream(path, {
      start: start,
      end: end
    });
    res.writeHead(206, {
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    });
    file.pipe(res);
  } else {
    console.log('ALL: ' + total);
    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': 'video/mp4'
    });
    fs.createReadStream(path).pipe(res);
  }
});

http.listen(3000);