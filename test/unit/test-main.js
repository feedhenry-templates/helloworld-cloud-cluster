var proxyquire = require('proxyquire');
var assert = require('assert');
var util = require('util');

// Sample setUp call - note this is called once, before the other tests in this file are run
exports.setUp = function(finish) {
  finish();
};

// Sample tearDown - note this is called once, after all other tests have been run in this file
exports.tearDown = function(finish) {
  finish();
};

exports.it_should_test_happy = function(finish) {

  // Note we have no requires in main.js to stub out.
  // For more information on using proxyquire, see: https://github.com/thlorenz/proxyquire
  var main = proxyquire('lib/main.js', {});
  main.hello({hello: 'world'}, function(err, data) {
    assert.ok(!err, 'Unexpected error: ' + util.inspect(err));
    assert.equal(data.msg, 'Hello world', 'Unexpected response! - ' + util.inspect(data));
    finish();
  });
};
