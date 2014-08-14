
const DEFAULT_PORT = 9080;
const DEFAULT_INDEX = 'index.html';
const DEFAULT_FOLLOW_SYMLINKS = false;
const DEFAULT_DEBUG = false;

const DEFAULT_STATUS_OK = 200;
const DEFAULT_STATUS_ERR = 500;
const DEFAULT_STATUS_FORBIDDEN = 403;
const DEFAULT_STATUS_FILE_NOT_FOUND = 404;
const DEFAULT_STATUS_INVALID_METHOD = 405;

const VALID_HTTP_METHOD = 'GET';

const TIME_MS_PRECISION = 3;


var http  = require("http");
var url   = require("url");
var mime  = require('mime');
var path  = require("path");
var fs    = require("fs");
var fsize = require('file-size');
var chalk = require('chalk');
var slice = Array.prototype.slice;
var program = require('commander')
  .version('1.0.0')
  .usage('[options] <root_path>')
  .option('-p, --port <n>', 'the port to listen to for incoming HTTP connections', DEFAULT_PORT)
  .option('-i, --index <filename>', 'the default index file if not specified', DEFAULT_INDEX)
  .option('-f, --follow-symlink', 'follow links, otherwise fail with file not found', DEFAULT_FOLLOW_SYMLINKS)
  .option('-d, --debug', 'enable to show error messages', DEFAULT_DEBUG)
  .parse(process.argv);
;
var server;

program.rootPath = program.args[0] || process.cwd();

initTerminateHandlers();




server = http.createServer(function(req, res) {
  var uri = url.parse(req.url).pathname;
  var filename = path.join(program.rootPath, uri);
  var timestamp = process.hrtime();

  // add a property to get the elapsed time since the request was issued
  Object.defineProperty(res, 'elapsedTime', {
    get: function getElapsedTime() {
      var elapsed = process.hrtime(timestamp);
      return (elapsed[0] ? elapsed[0] + 's ' : '') + (elapsed[1] / 1000000).toFixed(TIME_MS_PRECISION) + 'ms';
    }
  });

  console.log(chalk.gray('<--'), chalk.blue('[' + req.method + ']'), uri);

  if (req.method !== VALID_HTTP_METHOD) {
    return sendError(res, null, DEFAULT_STATUS_INVALID_METHOD);
  }

  getFileStats(filename, path.join(filename, program.index), function (err, stats, file) {
    if (err) {
      sendError(res, err, DEFAULT_STATUS_FILE_NOT_FOUND);
    } else if (stats.isDirectory()) {
      //
      // TODO : handle directory listing here
      //
      sendError(res, null, DEFAULT_STATUS_FORBIDDEN);
    } else {
      sendFile(res, stats, file);
    }
  });

});

server.listen(program.port);

console.log(chalk.blue('*'), 'Static server successfully started.');
console.log(chalk.blue('*'), 'Listening on port:', chalk.cyan(program.port));
console.log(chalk.blue('*'), 'Press', chalk.yellow.bold('Ctrl+C'), 'to shutdown.');




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
    console.log(chalk.blue('*'), 'Shutting down server');
    server.close();
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


/**
Get stats for the given file(s). The function will return the stats for the
first valid (i.e. found) file or directory.

    getFile('file1', callback);
    getFile('file1', 'file2', ..., callback);
    getFile(['file1', 'file2'], callback);

The callback function receives four arguments; an error if any, a stats object,
the file name matching the stats found, and the actual index of the file from
the provided list of files.

@param files {Array|String}     a file, or list of files
@param callback {Function}      a callback function
*/
function getFileStats(files, callback) {
  var dirFound;
  var dirStats;

  if (arguments.length > 2) {
    files = slice.call(arguments, 0, arguments.length - 1);
    callback = arguments[arguments.length - 1];
  } else if (!Array.isArray(file)) {
    files = [files];
  }

  function checkNext(err, index) {
    if (files.length) {
      next(files.shift(), index + 1);
    } else if (err && dirFound) {
      // if a directory was found at some point, return it and ignore the error
      callback(null, dirFound, dirStats);
    } else {
      callback(err || new Error('File not found'));
    }
  }

  function next(file, index) {
    fs.lstat(file, function (err, stats) {
      if (err) {
        callback(err);
      } else if (stats.isSymbolicLink()) {
        if (program.followSymlink) {
          fs.readlink(file, function (err, link) {
            if (err) {
              checkNext(err, index);
            } else {
              console.log(chalk.cyan('---'), '"' + path.relative(program.rootPath, file) + '"', chalk.magenta('>'), '"' + path.relative(program.rootPath, link) + '"');
              next(link, index);
            }
          });
        } else {
          callback(new Error('Symbolic link not allowed'));
        }
      } else if (stats.isDirectory()) {
        if (!dirFound) {
          dirFound = file;
          dirStats = stats;
        }
        checkNext(null, index);
      } else {
        callback(null, stats, file, index);
      }
    });
  }

  checkNext(0);
}


/**
Send error back to the client. If `status` is not specified, a value
of 500 is used. If `message` is not specified, the default message for
the given status is returned.

@param res {Object}         the request's response object
@param status {Number}      the status (default 500)
@param message {String}     the status message (optional)
*/
function sendError(res, error, status, message) {
  status = status || DEFAULT_STATUS_ERR;
  message = message || http.STATUS_CODES[status];

  console.log(chalk.gray('-->'), chalk.red('ERR'), status, ':', message, '(' + res.elapsedTime + ')');

  if (error) {
    console.error(error.stack || error.message || error);
  }

  res.writeHead(status, {
    'Content-Type': mime.lookup('text')
  });
  res.end(message);
}


/**
Send a file back at the client. If the file is not found, an error 404
will be returned. If the file cannot be read, for any reason, an error 500
will be read and the error will be sent to stderr

@param res {Object}        the request's response object
@param stats {Object}      the actual file stats
@param file {String}       the absolute file path
*/
function sendFile(res, stats, file) {
  fs.readFile(file, 'binary', function(err, content) {
    if (err) {
      return sendError(res, err);
    }

    res.writeHead(DEFAULT_STATUS_OK, {
      'Content-type': mime.lookup(file)
    });
    res.write(content, 'binary');
    res.end();

    console.log(chalk.gray('-->'), 'OK', '"' + path.sep + path.relative(program.rootPath, file) + '"', fsize(stats.size).human(), '(' + res.elapsedTime + ')');
  });
};