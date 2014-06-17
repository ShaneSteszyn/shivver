var express = require('express');
var logger = require('morgan');
var compression = require('compression');

var app = express();

app.set('view engine', 'hbs');

app.use(logger());
app.use(compression());
app.use(express.static('public'));

app.get('/', function(req, res) {
  res.render('index', {});
});

app.listen(3000);