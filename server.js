var express = require('express');
var fs = require('fs');
var bodyParser = require("body-parser");
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/json' }));
app.get('/*', express.static(__dirname + '/public'));
app.get('/', express.static(__dirname + '/public/index.html'));
app.use('/node_modules', express.static(__dirname + '/node_modules'));
app.post('/update', function (req, res) {
    fs.writeFile('public/data.json', req.body);
    return res.status(200).send();
});
app.listen(80);

module.exports = app;