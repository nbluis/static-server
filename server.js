
const DEFAULT_PORT = 9080;
const DEFAULT_INDEX = 'index.html';
const DEFAULT_FOLLOW_SYMLINKS = false;
const DEFAULT_DEBUG = false;

const DEFAULT_STATUS_OK = 200;
const DEFAULT_STATUS_NOT_MODIFIED = 304;
const DEFAULT_STATUS_ERR = 500;
const DEFAULT_STATUS_FORBIDDEN = 403;
const DEFAULT_STATUS_FILE_NOT_FOUND = 404;
const DEFAULT_STATUS_INVALID_METHOD = 405;
const DEFAULT_STATUS_REQUEST_RANGE_NOT_SATISFIABLE = 416;

const VALID_HTTP_METHODS = ['GET', 'HEAD'];

const TIME_MS_PRECISION = 3;


var util    = require('util');
var http    = require("http");
var url     = require("url");
var mime    = require('mime');
var path    = require("path");
var fs      = require("fs");
var fsize   = require('file-size');
var chalk   = require('chalk');
var slice   = Array.prototype.slice;
var program = require('commander');
var pkg     = require(path.join(__dirname, 'package.json'));
var server;


program
  .version(pkg.name + '@' + pkg.version)
  .usage('[options] <root_path>')
  .option('-p, --port <n>', 'the port to listen to for incoming HTTP connections', DEFAULT_PORT)
  .option('-i, --index <filename>', 'the default index file if not specified', DEFAULT_INDEX)
  .option('-f, --follow-symlink', 'follow links, otherwise fail with file not found', DEFAULT_FOLLOW_SYMLINKS)
  .option('-d, --debug', 'enable to show error messages', DEFAULT_DEBUG)
  .parse(process.argv);

program.rootPath = program.args[0] || process.cwd();

initTerminateHandlers();
createServer();

/**
 * Create the server
 */
function createServer() {
  server = http.createServer(function(req, res) {
    var uri = req.path = url.parse(req.url).pathname;
    var filename = path.join(program.rootPath, uri);
    var timestamp = process.hrtime();

    // add a property to get the elapsed time since the request was issued
    Object.defineProperty(res, 'elapsedTime', {
      get: function getElapsedTime() {
        var elapsed = process.hrtime(timestamp);
        return (elapsed[0] ? elapsed[0] + 's ' : '') + (elapsed[1] / 1000000).toFixed(TIME_MS_PRECISION) + 'ms';
      }
    });

    res.headers = {
      'X-Powered-By': pkg.name
    };

    console.log(chalk.gray('<--'), chalk.blue('[' + req.method + ']'), uri);

    if (VALID_HTTP_METHODS.indexOf(req.method) === -1) {
      return sendError(req, res, null, DEFAULT_STATUS_INVALID_METHOD);
    } else if (!validPath(filename)) {
      return sendError(req, res, null, DEFAULT_STATUS_FORBIDDEN);
    }

    getFileStats(filename, path.join(filename, program.index), function (err, stat, file, index) {
      if (err) {
        sendError(req, res, null, DEFAULT_STATUS_FILE_NOT_FOUND);
      } else if (stat.isDirectory()) {
        //
        // TODO : handle directory listing here
        //
        sendError(req, res, null, DEFAULT_STATUS_FORBIDDEN);
      } else {
        sendFile(req, res, stat, file);
      }
    });

  });

  server.listen(program.port);

  console.log(chalk.blue('*'), 'Static server successfully started.');
  console.log(chalk.blue('*'), 'Listening on port:', chalk.cyan(program.port));
  console.log(chalk.blue('*'), 'Press', chalk.yellow.bold('Ctrl+C'), 'to shutdown.');

  return server;
}


/**
 * Prepare the 'exit' handler for the program termination
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
      server.close();
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


/**
Check that path is valid so we don't access invalid resources

@param file {String}        the path to validate
*/
function validPath(file) {
  var resolvedPath = path.resolve(program.rootPath, file);
  var rootPath = path.resolve(program.rootPath);

  // only if we are still in the rootPath of the static site
  return resolvedPath.indexOf(rootPath) === 0;
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
  var dirStat;
  var dirIndex;

  if (arguments.length > 2) {
    files = slice.call(arguments, 0, arguments.length - 1);
    callback = arguments[arguments.length - 1];
  } else if (!Array.isArray(file)) {
    files = [files];
  }

  function checkNext(err, index) {
    if (files.length) {
      next(files.shift(), index + 1);
    } else if (dirFound) {
      // if a directory was found at some point, return it and ignore the error
      callback(null, dirStat, dirFound, dirIndex);
    } else {
      callback(err || new Error('File not found'));
    }
  }

  function next(file, index) {
    fs.lstat(file, function (err, stat) {
      if (err) {
        checkNext(err, index);
      } else if (stat.isSymbolicLink()) {
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
      } else if (stat.isDirectory()) {
        if (!dirFound) {
          dirFound = file;
          dirStat = stat;
          dirIndex = index;
        }
        checkNext(null, index);
      } else {
        callback(null, stat, file, index);
      }
    });
  }

  checkNext(null, 0);
}


/**
Validate that this file is not client cached

@param req {Object}       the request object
@param res {Object}       the response object
@return {boolean}         true if the file is client cached
*/
function validateClientCache(req, res, stat) {
  var mtime         = stat.mtime.getTime();
  var clientETag  = req.headers['if-none-match'];
  var clientMTime = Date.parse(req.headers['if-modified-since']);

  if ((clientMTime  || clientETag) &&
      (!clientETag  || clientETag === res.headers['Etag']) &&
      (!clientMTime || clientMTime >= mtime)) {

    // NOT MODIFIED responses should not contain entity headers
    [
      'Content-Encoding',
      'Content-Language',
      'Content-Length',
      'Content-Location',
      'Content-MD5',
      'Content-Range',
      'Content-Type',
      'Expires',
      'Last-Modified'
    ].forEach(function(entityHeader) {
        delete res.headers[entityHeader];
    });

    res.status = DEFAULT_STATUS_NOT_MODIFIED;

    res.writeHead(res.status, res.headers);
    res.end();

    console.log(chalk.gray('-->'), chalk.green.dim(res.status, http.STATUS_CODES[res.status]), req.path, '(' + res.elapsedTime + ')');

    return true;
  } else {
    return false;
  }
}


/**
Send error back to the client. If `status` is not specified, a value
of 500 is used. If `message` is not specified, the default message for
the given status is returned.

@param req {Object}         the request object
@param res {Object}         the response object
@param status {Number}      the status (default 500)
@param message {String}     the status message (optional)
*/
function sendError(req, res, error, status, message) {
  status = status || res.status || DEFAULT_STATUS_ERR;
  message = message || http.STATUS_CODES[status];

  if (status >= 400) {
    // ERR responses should not contain entity headers
    [
      'Content-Encoding',
      'Content-Language',
      'Content-Length',
      'Content-Location',
      'Content-MD5',
      'Content-Range',
      'Etag',
      'Expires',
      'Last-Modified'
    ].forEach(function(entityHeader) {
        delete res.headers[entityHeader];
    });

    res.headers['Content-Type'] = mime.lookup('text');

    res.writeHead(status, res.headers);
    res.write(message);
    res.end();
  }

  console.log(chalk.gray('-->'), chalk.red(status, message), req.path, '(' + res.elapsedTime + ')');

  if (error && program.debug) {
    console.error(error.stack || error.message || error);
  }

}


/**
Send a file back at the client. If the file is not found, an error 404
will be returned. If the file cannot be read, for any reason, an error 500
will be read and the error will be sent to stderr

@param req {Object}        the request object
@param res {Object}        the response object
@param stat {Object}       the actual file stat
@param file {String}       the absolute file path
*/
function sendFile(req, res, stat, file) {
  var headersSent = false;
  var relFile;
  var nrmFile;
  var range, start, end;
  var streamOptions = {flags: 'r'};
  var size = stat.size;

  // support range headers
  if (req.headers.range) {
    range = req.headers.range.split('-').map(Number);
    start = range[0];
    end = range[1];

    // check if requested range is within file range
    if ((start < 0) || (end < 0) || (start > stat.size) || (end > stat.size)) {
      return sendError(req, res, null, DEFAULT_STATUS_REQUEST_RANGE_NOT_SATISFIABLE);
    }

    res.headers['Content-Range'] = req.headers.range;

    // update filestream options
    streamOptions.start = start;
    streamOptions.end = end;

    // update size
    size = end - start;
  }

  res.headers['Etag']           = JSON.stringify([stat.ino, stat.size, stat.mtime.getTime()].join('-'));
  res.headers['Date']           = new Date().toUTCString();
  res.headers['Last-Modified']  = new Date(stat.mtime).toUTCString();
  res.headers['Content-Type']   = mime.lookup(file);
  res.headers['Content-Length'] = size;

  // return only headers if request method is HEAD
  if (req.method === 'HEAD') {
    res.status = DEFAULT_STATUS_OK;
    res.writeHead(DEFAULT_STATUS_OK, res.headers);
    res.end();
    console.log(chalk.gray('-->'), chalk.green(res.status, http.STATUS_CODES[res.status]), req.path + (nrmFile !== relFile ? (' ' + chalk.dim('(' + relFile + ')')) : ''), fsize(size).human(), '(' + res.elapsedTime + ')');
    return;
  }

  if (validateClientCache(req, res, stat, file)) {
    return;  // abort
  }

  relFile = path.relative(program.rootPath, file);
  nrmFile = path.normalize(req.path.substring(1));
  fs.createReadStream(file, streamOptions).on('close', function () {
    res.end();
    console.log(chalk.gray('-->'), chalk.green(res.status, http.STATUS_CODES[res.status]), req.path + (nrmFile !== relFile ? (' ' + chalk.dim('(' + relFile + ')')) : ''), fsize(size).human(), '(' + res.elapsedTime + ')');
  }).on('error', function (err) {
    sendError(req, res, err);
  }).on('data', function (chunk) {
    if (!headersSent) {
      res.status = DEFAULT_STATUS_OK;
      res.writeHead(DEFAULT_STATUS_OK, res.headers);
      headersSent = true;
    }
    res.write(chunk);
  });

}
