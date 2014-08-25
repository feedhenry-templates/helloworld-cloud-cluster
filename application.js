var mbaasApi = require('fh-mbaas-api');
var express = require('express');
var mbaasExpress = mbaasApi.mbaasExpress();
var cors = require('cors');

// Cluster related
var cluster = require('cluster');
var workers = [];     // Array of Worker processes
var workerId = process.env.NODE_WORKER_ID || 0;
var server;

// Securable endpoints: list the endpoints which you want to make securable here
var securableEndpoints = ['hello'];
var app = express();

// Enable CORS for all requests
app.use(cors());

// Note: the order which we add middleware to Express here is important!
app.use('/sys', mbaasExpress.sys(securableEndpoints));
app.use('/mbaas', mbaasExpress.mbaas);

// Note: important that this is added just before your own Routes
app.use(mbaasExpress.fhmiddleware());

app.use('/hello', require('./lib/hello.js')());

// You can define custom URL handlers here, like this one:
app.use('/', function(req, res){
  res.end('Your Cloud App is Running');
});

// Important that this is last!
app.use(mbaasExpress.errorHandler());

// Start a worker process
function startWorker() {
  var port = process.env.FH_PORT || process.env.VCAP_APP_PORT || 8001;
  server = app.listen(port, function(){
    console.log("App started at: " + new Date() + " on port: " + port);
  });
};

// Start function
// The number of workers to start can be specified with the FH_NUM_WORKERS env variable
function start() {
  if (cluster.isMaster) {
    var numCPUs = process.env.FH_NUM_WORKERS || require('os').cpus().length;
    for (var i = 0; i < numCPUs; i++) {
      var worker = cluster.fork();
      workers.push(worker);
    }

    // Handle workers exiting
    cluster.on('exit', workerExitHandler);
  } else {
    startWorker();
  }
};

// Clean shutdown..
var cleanShutdown = function(cb) {
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


// Utility function: handle workers exiting (which can happen cleanly or due to an error)
function workerExitHandler(worker, code, signal) {
  if (worker.suicide === true) {
    console.log("Cleanly exiting..");
    process.exit(0);
  } else {
    var msg = "Worker: " + worker.process.pid + " has died!! Respawning..";
    console.error(msg);
    var newWorker = cluster.fork();
    for (var i = 0; i < workers.length; i++) {
      if (workers[i] && workers[i].id === worker.id) workers.splice(i);
    }
    workers.push(newWorker);
  }
};

// start our app
start();
