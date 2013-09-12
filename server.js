
var http            = require("http"),
    url             = require("url"),
    path            = require("path"),
    fs              = require("fs"),
    defaultFileName = 'index.html',
    port            = process.argv[2] || 9080;

http.createServer(function(request, response) {

  var uri = url.parse(request.url).pathname,
      fileName = path.join(process.cwd(), uri);

  function writeFile(fullFilePath) {
    console.log('Serving file: ' + fullFilePath);
    fs.readFile(fullFilePath, 'binary', function(err, file) {
      if (err) {
        writeError(500, 'Error reading file: ' + err);
        return;
      }

      response.writeHead(200);
      response.write(file, 'binary');
      response.end();
    });
  };

  function writeError(statusCode, content) {
    response.writeHead(statusCode, {"Content-Type": "text/plain"});
    response.end(content);
  };

  fs.lstat(fileName, function(err, stats) {
    if (err)
      writeError(404, '404 Not Found: ' + fileName);
    else if (stats.isDirectory() || stats.isSymbolicLink())
      writeFile(path.join(fileName + defaultFileName));
    else if (stats.isFile())
      writeFile(fileName);
    else
      writeError(500, 'Invalid file state');
  });

}).listen(port);

console.log('Static server successfully started.');
console.log('Listening on port: ' + port);
console.log('Press Ctrl + C to shutdown.');