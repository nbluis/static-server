#!/usr/bin/env node

const DEFAULT_PORT = 9080;
const DEFAULT_INDEX = 'index.html';
const DEFAULT_FOLLOW_SYMLINKS = false;
const DEFAULT_DEBUG = false;
const DEFAULT_ERROR_404 = undefined;
const DEFAULT_CORS = undefined;
const DEFAULT_CACHE = true;
const DEFAULT_OPEN = false;
const DEFAULT_SILENT = false;


var path    = require("path");
var fsize   = require('file-size');
var program = require('commander');
var chalk   = require('chalk');

var pkg     = require(path.join(__dirname, '..', 'package.json'));

var StaticServer = require('../server.js');
var server;

var templates = {
	index: DEFAULT_INDEX,
	notFound: DEFAULT_ERROR_404
};

initTerminateHandlers();

program
  .version(pkg.name + '@' + pkg.version)
  .usage('[options] <root_path>')
  .option('-p, --port <n>', 'the port to listen to for incoming HTTP connections', DEFAULT_PORT)
  .option('-i, --index <filename>', 'the default index file if not ' + DEFAULT_INDEX, addIndexTemplate, DEFAULT_INDEX)
  .option('-f, --follow-symlink', 'follow links, otherwise fail with file not found', DEFAULT_FOLLOW_SYMLINKS)
  .option('-d, --debug', 'enable to show error messages', DEFAULT_DEBUG)
  .option('-n, --not-found <filename>', 'file to serve if url not found', addNotFoundTemplate, DEFAULT_ERROR_404)
  .option('-c, --cors <pattern>', 'Cross Origin Pattern. Use "*" to allow all origins', DEFAULT_CORS)
  .option('-z, --no-cache', 'disable cache (http 304) responses', DEFAULT_CACHE)
  .option('-o, --open', 'open server in the local browser', DEFAULT_OPEN)
  .option('-s, --silent', 'suppress output about URL requests', DEFAULT_SILENT)
  .parse(process.argv);
;

// overrides
program.rootPath = program.args[0] || process.cwd();
program.name = pkg.name;
program.templates = templates;
delete program.index;

server = new StaticServer(program);

server.start(function () {
  var msg = 'Static server successfully started.';
  if(program.silent){
    msg = 'Static server successfully started in silent mode.';
  }
  console.log(chalk.blue('*'), msg);
  console.log(chalk.blue('*'), 'Serving files at:', chalk.cyan('http://localhost:' + program.port));
  console.log(chalk.blue('*'), 'Press', chalk.yellow.bold('Ctrl+C'), 'to shutdown.');

  return server;
}, function (e) {
  if('EADDRINUSE'!==e.code){
  	throw e;
  }
  console.log(chalk.blue.bold('!'), 'Port', chalk.yellow.bold(program.port), 'already in use.');
  console.log(chalk.blue('*'), 'You could try the next port using:', chalk.green.bold(cmdSetPort(1+parseInt(program.port))));
 
  process.exit(1);
});

function log(){
  if(!program.silent){
    console.log.apply(null, arguments);
  } 
}

server.on('request', function (req, res) {
  log(chalk.gray('<--'), chalk.blue('[' + req.method + ']'), req.path);
});

server.on('symbolicLink', function (link, file) {
  log(chalk.cyan('---'), '"' + path.relative(server.rootPath, link) + '"', chalk.magenta('>'), '"' + path.relative(server.rootPath, file) + '"');
});

server.on('response', function (req, res, err, file, stat) {
  var relFile;
  var nrmFile;

  if (res.status >= 400) {
    log(chalk.gray('-->'), chalk.red(res.status), req.path, '(' + req.elapsedTime + ')');
  } else if (file) {
    relFile = path.relative(server.rootPath, file);
    nrmFile = path.normalize(req.path.substring(1));

    log(chalk.gray('-->'), chalk.green(res.status, StaticServer.STATUS_CODES[res.status]), req.path + (nrmFile !== relFile ? (' ' + chalk.dim('(' + relFile + ')')) : ''), fsize(stat.size).human(), '(' + req.elapsedTime + ')');
  } else {
    log(chalk.gray('-->'), chalk.green.dim(res.status, StaticServer.STATUS_CODES[res.status]), req.path, '(' + req.elapsedTime + ')');
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
      console.log(chalk.blue('*'), 'Shutting down static server');
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

function cmdSetPort(port){
  var cmd = process.argv.slice(1);

  // Isolate executing command from full path
  cmd[0] = cmd[0].match(/[^\\\/]+$/)[0]; 	 
  
  // Edit existing port parameter
  var found = false;
  for(var i=0; i<cmd.length; i++){
    if(cmd[i].match(/^(-p|--port)$/i)){
    	cmd[++i] = port;
		found = true;
    }
  }

  // Add port parameter if not set already
  if(!found){
  	cmd.push('--port');
  	cmd.push(port);
  }

  return cmd.join(' ');
}
