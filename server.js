
const DEFAULT_STATUS_OK = 200;
const DEFAULT_STATUS_NOT_MODIFIED = 304;
const DEFAULT_STATUS_ERR = 500;
const DEFAULT_STATUS_FORBIDDEN = 403;
const DEFAULT_STATUS_FILE_NOT_FOUND = 404;
const DEFAULT_STATUS_INVALID_METHOD = 405;

const VALID_HTTP_METHOD = 'GET';

const TIME_MS_PRECISION = 3;


var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var http         = require("http");
var url          = require("url");
var mime         = require('mime');
var path         = require("path");
var fs           = require("fs");
var slice        = Array.prototype.slice;


/**
Exposes the StaticServer class
*/
module.exports = StaticServer;



function StaticServer(options) {
  options = options || {};

  this.name = options.name;
  this.host = options.host;
  this.port = options.port;
  this.rootPath = options.rootPath;
  this.followSymlink = options.followSymlink;
  this.index = options.index;
  this.debug = options.debug;
  this.STATUS_CODES = http.STATUS_CODES;
}
util.inherits(StaticServer, EventEmitter);


StaticServer.prototype.start = function start(callback) {
  var server = this;

  this._socket = http.createServer(function(req, res) {
    var uri = req.path = url.parse(req.url).pathname;
    var filename = path.join(server.rootPath, uri);
    var timestamp = process.hrtime();

    // add a property to get the elapsed time since the request was issued
    Object.defineProperty(res, 'elapsedTime', {
      get: function getElapsedTime() {
        var elapsed = process.hrtime(timestamp);
        return (elapsed[0] ? elapsed[0] + 's ' : '') + (elapsed[1] / 1000000).toFixed(TIME_MS_PRECISION) + 'ms';
      }
    });

    server.emit('request', req);

    res.headers = {
      'X-Powered-By': server.name
    };

    if (req.method !== VALID_HTTP_METHOD) {
      return sendError(server, req, res, null, DEFAULT_STATUS_INVALID_METHOD);
    } else if (!validPath(server.rootPath, filename)) {
      return sendError(server, req, res, null, DEFAULT_STATUS_FORBIDDEN);
    }

    getFileStats(server, [filename, path.join(filename, server.index)], function (err, stat, file, index) {
      if (err) {
        sendError(server, req, res, null, DEFAULT_STATUS_FILE_NOT_FOUND);
      } else if (stat.isDirectory()) {
        //
        // TODO : handle directory listing here
        //
        sendError(server, req, res, null, DEFAULT_STATUS_FORBIDDEN);
      } else {
        sendFile(server, req, res, stat, file);
      }
    });

  });

  this._socket.listen(this.port, this.host, callback);
}


StaticServer.prototype.stop = function stop() {
  if (this._socket) {
    this._socket.close();
    this._socket = null;
  }
}


/**
Check that path is valid so we don't access invalid resources

@param rootPath {String}    the server root path
@param file {String}        the path to validate
*/
function validPath(rootPath, file) {
  var resolvedPath = path.resolve(rootPath, file);

  // only if we are still in the rootPath of the static site
  return resolvedPath.indexOf(rootPath) === 0;
}


/**
Get stats for the given file(s). The function will return the stats for the
first valid (i.e. found) file or directory.

    getFile(server, ['file1', 'file2'], callback);

The callback function receives four arguments; an error if any, a stats object,
the file name matching the stats found, and the actual index of the file from
the provided list of files.

@param server {StaticServer}    the StaticServer instance
@param files {Array}            list of files
@param callback {Function}      a callback function
*/
function getFileStats(server, files, callback) {
  var dirFound;
  var dirStat;
  var dirIndex;

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
        if (server.followSymlink) {
          fs.readlink(file, function (err, link) {
            if (err) {
              checkNext(err, index);
            } else {
              server.emit('symbolicLInk', file, link);
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

    server.emit('response', req, res);

    return true;
  } else {
    return false;
  }
}


/**
Send error back to the client. If `status` is not specified, a value
of 500 is used. If `message` is not specified, the default message for
the given status is returned.

@param server {StaticServer} the server instance
@param req {Object}          the request object
@param res {Object}          the response object
@param err {Object}          an Error object, if any
@param status {Number}       the status (default 500)
@param message {String}      the status message (optional)
*/
function sendError(server, req, res, err, status, message) {
  status = status || res.status || DEFAULT_STATUS_ERR
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

    res.status = status;
    res.headers['Content-Type'] = mime.lookup('text');

    res.writeHead(status, res.headers);
    res.write(message);
    res.end();
  }

  server.emit('response', req, res, err);
}


/**
Send a file back at the client. If the file is not found, an error 404
will be returned. If the file cannot be read, for any reason, an error 500
will be read and the error will be sent to stderr

@param server {StaticServer} the server instance
@param req {Object}          the request object
@param res {Object}          the response object
@param stat {Object}         the actual file stat
@param file {String}         the absolute file path
*/
function sendFile(server, req, res, stat, file) {
  var headersSent = false;

  res.headers['Etag']           = JSON.stringify([stat.ino, stat.size, stat.mtime.getTime()].join('-'));
  res.headers['Date']           = new Date().toUTCString();
  res.headers['Last-Modified']  = new Date(stat.mtime).toUTCString();
  res.headers['Content-Type']   = mime.lookup(file);
  res.headers['Content-Length'] = stat.size;

  if (validateClientCache(req, res, stat, file)) {
    return;  // abort
  }

  fs.createReadStream(file, {
    flags: 'r',
    mode: 0666
  }).on('close', function () {
    res.end();

    server.emit('response', req, res, null, stat, file);

  }).on('error', function (err) {
    sendError(server, req, res, err);
  }).on('data', function (chunk) {
    if (!headersSent) {
      res.status = DEFAULT_STATUS_OK;
      res.writeHead(DEFAULT_STATUS_OK, res.headers);
      headersSent = true;
    }
    res.write(chunk);
  });

};