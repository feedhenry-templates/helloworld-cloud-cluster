var mbaasApi = require('fh-mbaas-api');
var express = require('express');
var mbaasExpress = mbaasApi.mbaasExpress();
var cors = require('cors');

// Cluster related
var cluster = require('cluster');
var childProcess = require('child_process');
var workers = [];     // Array of Worker processes
var server;


// list the endpoints which you want to make securable here
var securableEndpoints;
securableEndpoints = ['/hello'];

var app = express();

// Enable CORS for all requests
app.use(cors());

// Note: the order which we add middleware to Express here is important!
app.use('/sys', mbaasExpress.sys(securableEndpoints));
app.use('/mbaas', mbaasExpress.mbaas);

/* uncomment this code if you want to use $fh.auth in the app preview
 * localAuth is only used for local development. 
 * If the app is deployed on the platform, 
 * this function will be ignored and the request will be forwarded 
 * to the platform to perform authentication.

app.use('/box', mbaasExpress.auth({localAuth: function(req, cb){
  return cb(null, {status:401, body: {"message": "bad request"}});
}}));

or

app.use('/box', mbaasExpress.core({localAuth: {status:401, body: {"message": "not authorised”}}}));
*/

// allow serving of static files from the public directory
app.use(express.static(__dirname + '/public'));

// Note: important that this is added just before your own Routes
app.use(mbaasExpress.fhmiddleware());

app.use('/hello', require('./lib/hello.js')());

// Important that this is last!
app.use(mbaasExpress.errorHandler());

/*
  Get the number of CPUs that are actually available to this process.
  Can be overwritten with the FH_NUM_WORKERS env var
*/
function getNumCPUs(cb) {
  var numCPUs = process.env.FH_NUM_WORKERS;
  if (!numCPUs) {
    childProcess.exec('nproc', function(err, stdout){
      if (err) {
        if (err.code !== 127) {
          // something went wrong on Linux, callback with the error
          return cb(err);
        } else {
          // `nproc` doesn't exist on macOS & Win.
          // Fallback to `os`
          console.log('Using native os lib to determine num cpus');
          return cb(null, require('os').cpus().length);
        }
      }
      console.log('Using nproc to determine num cpus');
      return cb(null, parseInt(stdout));
    });
  } else {
    process.nextTick(function() {
      console.log('Using FH_NUM_WORKERS to determine num cpus')
      return cb(null, numCPUs);
    });
  }
}

// Start a worker process
function startWorker() {
  var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
  var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
  server = app.listen(port, host, function() {
    console.log("App started at: " + new Date() + " on port: " + port);
  });

}

// Utility function: handle workers exiting (which can happen cleanly or due to an error)
function workerExitHandler(worker, code, signal) {
  if (worker.suicide === true) {
    console.log("Cleanly exiting..");
    process.exit(0);
  } else {
    var msg = "Worker: " + worker.process.pid + " has died!! code=" + code + " signal=" + signal + " Respawning..";
    console.error(msg);
    var newWorker = cluster.fork();
    for (var i = 0; i < workers.length; i++) {
      if (workers[i] && workers[i].id === worker.id) workers.splice(i);
    }
    workers.push(newWorker);
  }
}

// Start function
// The number of workers to start can be specified with the FH_NUM_WORKERS env variable
function start() {
  if (cluster.isMaster && process.env.NODE_ENV !== 'test') {
    getNumCPUs(function(err, numCPUs) {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log('MASTER: numCPUs=' + numCPUs);
      for (var i = 0; i < numCPUs; i++) {
        var worker = cluster.fork();
        workers.push(worker);
      }

      // Handle workers exiting
      cluster.on('exit', workerExitHandler);
    });
  } else {
    startWorker();
  }
}

// Clean shutdown..
var cleanShutdown = function() {
  if (cluster.isMaster) {
    // shutdown all our workers - we exit when all workers have exited..
    for (var i = 0; i < workers.length; i++) {
      var worker = workers[i];
      if (worker.destroy) worker.destroy();
      else if (worker.kill) worker.kill();
      else if (worker.process && worker.process.kill) worker.process.kill();
    }
  }

  // cleanly stop express
  if (server) {
    server.close(function() {
      process.exit(0);
    });
  }
};

// Signal handlers for cleanly shutting down
process.on('SIGTERM', cleanShutdown);
process.on('SIGHUP', cleanShutdown);

// start our app
start();
