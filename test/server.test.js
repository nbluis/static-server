
describe('StaticServer test', function () {

  var http = require('http');
  var path = require('path');
  var fs = require('fs');
  var request = require('supertest');
  var Server = require('../server.js');
  var serverOptions = {
    rootPath: path.join(__dirname, 'fixtures')
  };
  var testServer;

  before(function (done) {
    testServer = new Server(serverOptions);
    testServer.start(done);
  })

  after(function () {
    testServer.stop();
  });

  it('should fail if rootPath is unspecified', function () {
    //!function () { new Server(); }.should.throw('Root path not specified');
  })

  it('should expose the http STATUS_CODES object', function () {
    Server.STATUS_CODES.should.equal(http.STATUS_CODES);
  });

  it('should validate (default) API', function () {
    assert.equal(testServer.name, undefined);
    assert.equal(testServer.host, undefined);
    assert.equal(testServer.port, undefined);

    testServer.followSymlink.should.be.false;
    testServer.index.should.equal('index.html');

    testServer.should.have.ownProperty('_socket');
  });

  describe('testing content types', function () {

    it('should handle text/html', function (done) {
      var testFile = 'test.html';

      fs.readFile(path.join(serverOptions.rootPath, testFile), 'UTF-8', function(err, fileContent) {
        if (err) {
          return done(err);
        }

        request(testServer._socket)
          .get('/' + testFile)
          .expect(200)
          .expect('Content-Type', /html/)
          .expect(fileContent)
          .end(done)
        ;
      });
    });

  });

  it('should handle 404 requests', function (done) {
    request(testServer._socket)
      .get('/')
      .expect(403)
      .end(done)
    ;
  });

});