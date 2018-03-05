[![Build Status](https://secure.travis-ci.org/nbluis/static-server.svg?branch=master)](http://travis-ci.org/nbluis/static-server)

# Node static server
A simple http server to serve static resource files from a local directory.

## Getting started
* [Install node.js](http://nodejs.org/download/)
* Install npm package globally `npm -g install static-server`
* Go to the folder you want to serve
* Run the server `static-server`

## Options

    -h, --help                 output usage information
    -V, --version              output the version number
    -p, --port <n>             the port to listen to for incoming HTTP connections
    -i, --index <filename>     the default index file if not specified
    -f, --follow-symlink       follow links, otherwise fail with file not found
    -d, --debug                enable to show error messages
    -n, --not-found <filename> the error 404 file
    -c, --cors <pattern>       Cross Origin Pattern. Use "*" to allow all origins
    -z, --no-nocache           disable cache (http 304) responses.
    -o, --open                 open server in the local browser

## Using as a node module

The server may be used as a dependency HTTP server.

### Example

```javascript
var StaticServer = require('static-server');
var server = new StaticServer({
  rootPath: '.',            // required, the root of the server file tree
  port: 1337,               // required, the port to listen
  name: 'my-http-server',   // optional, will set "X-Powered-by" HTTP header
  host: '10.0.0.100',       // optional, defaults to any interface
  cors: '*',                // optional, defaults to undefined
  followSymlink: true,      // optional, defaults to a 404 error
  templates: {
    index: 'foo.html',      // optional, defaults to 'index.html'
    notFound: '404.html'    // optional, defaults to undefined
  }
});

server.start(function () {
  console.log('Server listening to', server.port);
});

server.on('request', function (req, res) {
  // req.path is the URL resource (file name) from server.rootPath
  // req.elapsedTime returns a string of the request's elapsed time
});

server.on('symbolicLink', function (link, file) {
  // link is the source of the reference
  // file is the link reference
  console.log('File', link, 'is a link to', file);
});

server.on('response', function (req, res, err, file, stat) {
  // res.status is the response status sent to the client
  // res.headers are the headers sent
  // err is any error message thrown
  // file the file being served (may be null)
  // stat the stat of the file being served (is null if file is null)

  // NOTE: the response has already been sent at this point
});
```

## FAQ
* _Can I use this project in production environments?_ **Obviously not.**
* _Can this server run php, ruby, python or any other cgi script?_ **No.**
* _Is this server ready to receive thousands of requests?_ **Preferably not.**

## Contributors
An special thank you to [all contributors](https://github.com/nbluis/static-server/graphs/contributors) who allow this project to continue to evolve.

## License
[The MIT License (MIT)](http://creativecommons.org/licenses/MIT/)
