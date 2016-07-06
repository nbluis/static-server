
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
    !function () { new Server(); }.should.throw('Root path not specified');
  })

  it('should expose the http STATUS_CODES object', function () {
    Server.STATUS_CODES.should.equal(http.STATUS_CODES);
  });

  it('should validate (default) API', function () {
    assert.equal(testServer.name, undefined);
    assert.equal(testServer.host, undefined);
    assert.equal(testServer.port, undefined);
    assert.equal(testServer.cors, undefined);

    testServer.followSymlink.should.be.false;
    testServer.templates.index.should.equal('index.html');

    testServer.should.have.ownProperty('_socket');
  });

  it('should handle 403 requests', function (done) {
    request(testServer._socket)
      .get('/')
      .expect(403)
      .end(done)
    ;
  });

  it('should show a 404 page if configured to', function(done){
    testServer.templates.notFound = path.join(__dirname, 'fixtures', '404.html');

    request(testServer._socket)
      .get('/foo.html')
      .expect(404)
      .expect(/<h1>Error 404<\/h1>/)
      .end(function(err, res){
        testServer.templates.notFound = undefined;
        done(err);
      });
  })

  it('should throw 404 page if configured page does not exist', function(done){
    testServer.templates.notFound = path.join(__dirname, 'fixtures', 'missing.html');

    request(testServer._socket)
      .get('/foo.html')
      .expect(404)
      .end(function(err, res){
        testServer.templates.notFound = undefined;
        done(err);
      });
  })

  it('should handle index', function (done) {
    var oldIndex = testServer.index;
    testServer.templates.index = 'test.html';

    request(testServer._socket)
      .get('/')
      .expect(200)
      .end(function (err) {
        testServer.index = oldIndex;

        done(err);
      })
    ;
  });

  it('should accept HEAD requests');


  describe('testing content types', function () {

    function testFixture(testFile, contentEncoding, contentType, done) {
      fs.readFile(path.join(serverOptions.rootPath, testFile), contentEncoding, function(err, fileContent) {
        if (err) {
          return done(err);
        }

        request(testServer._socket)
          .get('/' + testFile)
          .expect(200)
          .expect('Content-Type', contentType)
          .expect(fileContent)
          .end(done)
        ;
      });
    }

    it('should handle HTML', function (done) {
      testFixture('test.html', 'UTF-8', /html/, done);
    });

    it('should handle JavaScript', function (done) {
      testFixture('test.js', 'UTF-8', /javascript/, done);
    });

    it('should handle PNG', function (done) {
      testFixture('test.png', null, 'image/png', done);
    });

    it('should handle JPG', function (done) {
      testFixture('test.jpg', null, 'image/jpeg', done);
    });

  });


  describe('Testing range', function () {
    it('should return first bytes only');

    it('should return last bytes only');

    it('should return specified bytes only');

    it('should handle multiple ranges');
  })


  describe('Symbolic links', function () {

    it('should handle fail');

    it('should follow');

  });

  describe('setting \'cors\' option', function () {
      before(function (done) {
        var opt = serverOptions
        opt.cors = '*'
        testServer = new Server(opt);
        testServer.start(done);
      })

      it('should set Access-Control-Allow-Origin', function (done) {
        request(testServer._socket)
          .get('/test.js')
          .expect(200)
          .expect('Access-Control-Allow-Origin', '*')
          .end(done)
      });
  })


});
