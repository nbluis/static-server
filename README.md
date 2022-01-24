[![Build Status](https://secure.travis-ci.org/nbluis/static-server.svg?branch=master)](http://travis-ci.org/nbluis/static-server)

# Static-server has been retired 🌅

The static-server project started in mid-2014 when node.js didn't even have a stable version (node.js 0.8 Oo). It was born from a personal need that I had to serve static files locally to be able to work with browser APIs that do not allow access through the file protocol.

It's amazing to see the scale it's taken and it just reinforces how open-source communities can build amazing tools together.

But in recent years I've been quite distant from this and many other projects that I contributed for personal reasons. Still, many people keep trying to take it forward and this makes me incredibly happy but at the same time sad because I haven't been able to give the project the attention it deserves and I apologize for that.

Given this scenario and understanding that our community needs projects with obstinate and active people to maintain them, I decided to retire it.

It will be available forever both on github and in already published NPM packages but no new versions will be distributed.

If you are a static-server user and are interested in continuing the project, I suggest you fork it. If you do, please open a pull-request on this project so that we can create a list of kept forks of it in case other users are interested in migrating.

I thank all the people who helped us to build it, especially @yanickrochon who was present all the time and worked a lot on its evolution.

It was a great time and I had a lot of fun, thank you node.js community.

Sincerely @nbluis.

## Node static server
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
    -z, --no-cache           disable cache (http 304) responses.
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
