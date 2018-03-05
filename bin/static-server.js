#!/usr/bin/env node

const DEFAULT_PORT = 9080;
const DEFAULT_INDEX = 'index.html';
const DEFAULT_FOLLOW_SYMLINKS = false;
const DEFAULT_DEBUG = false;
const DEFAULT_ERROR_404 = undefined;
const DEFAULT_CORS = undefined;
const DEFAULT_CACHE = true;
const DEFAULT_OPEN = false;


var path    = require("path");
var fsize   = require('file-size');
var program = require('commander');
var chalk   = require('chalk');

var pkg     = require(path.join(__dirname, '..', 'package.json'));

var StaticServer = require('../server.js');
var server;

var templates = {};

initTerminateHandlers();

program
  .version(pkg.name + '@' + pkg.version)
  .usage('[options] <root_path>')
  .option('-p, --port <n>', 'the port to listen to for incoming HTTP connections', DEFAULT_PORT)
  .option('-i, --index <filename>', 'the default index file if not specified', addIndexTemplate, DEFAULT_INDEX)
  .option('-f, --follow-symlink', 'follow links, otherwise fail with file not found', DEFAULT_FOLLOW_SYMLINKS)
  .option('-d, --debug', 'enable to show error messages', DEFAULT_DEBUG)
  .option('-n, --not-found <filename>', 'the file not found template', addNotFoundTemplate, DEFAULT_ERROR_404)
  .option('-c, --cors <pattern>', 'Cross Origin Pattern. Use "*" to allow all origins', DEFAULT_CORS)
  .option('-z, --no-cache', 'disable cache (http 304) responses', DEFAULT_CACHE)
  .option('-o, --open', 'open server in the local browser', DEFAULT_OPEN)
  .parse(process.argv);
;

// overrides
program.rootPath = program.args[0] || process.cwd();
program.name = pkg.name;
program.templates = templates;

server = new StaticServer(program);

server.start(function () {
  console.log(chalk.blue('*'), 'Static server successfully started.');
  console.log(chalk.blue('*'), 'Serving files at:', chalk.cyan('http://localhost:' + program.port));
  console.log(chalk.blue('*'), 'Press', chalk.yellow.bold('Ctrl+C'), 'to shutdown.');

  return server;
});

server.on('request', function (req, res) {
  console.log(chalk.gray('<--'), chalk.blue('[' + req.method + ']'), req.path);
});

server.on('symbolicLink', function (link, file) {
  console.log(chalk.cyan('---'), '"' + path.relative(server.rootPath, link) + '"', chalk.magenta('>'), '"' + path.relative(server.rootPath, file) + '"');
});

server.on('response', function (req, res, err, file, stat) {
  var relFile;
  var nrmFile;

  if (res.status >= 400) {
    console.log(chalk.gray('-->'), chalk.red(res.status), req.path, '(' + req.elapsedTime + ')');
  } else if (file) {
    relFile = path.relative(server.rootPath, file);
    nrmFile = path.normalize(req.path.substring(1));

    console.log(chalk.gray('-->'), chalk.green(res.status, StaticServer.STATUS_CODES[res.status]), req.path + (nrmFile !== relFile ? (' ' + chalk.dim('(' + relFile + ')')) : ''), fsize(stat.size).human(), '(' + req.elapsedTime + ')');
  } else {
    console.log(chalk.gray('-->'), chalk.green.dim(res.status, StaticServer.STATUS_CODES[res.status]), req.path, '(' + req.elapsedTime + ')');
  }

  if (err && server.debug) {
    console.error(err.stack || err.message || err);
  }

});



/**
Prepare the 'exit' handler for the program termination
*/
function initTerminateHandlers() {
  var readLine;

  if (process.platform === "win32"){
    readLine = require("readline");

    readLine.createInterface ({
      input: process.stdin,
      output: process.stdout
    }).on("SIGINT", function () {
      process.emit("SIGINT");
    });
  }

  // handle INTERRUPT (CTRL+C) and TERM/KILL signals
  process.on('exit', function () {
    if (server) {
      console.log(chalk.blue('*'), 'Shutting down server');
      server.stop();
    }
    console.log();  // extra blank line
  });
  process.on('SIGINT', function () {
    console.log(chalk.blue.bold('!'), chalk.yellow.bold('SIGINT'), 'detected');
    process.exit();
  });
  process.on('SIGTERM', function () {
    console.log(chalk.blue.bold('!'), chalk.yellow.bold('SIGTERM'), 'detected');
    process.exit(0);
  });
}

function addNotFoundTemplate(v){
  templates.notFound = v;
}

function addIndexTemplate(v){
  templates.index = v;
}
