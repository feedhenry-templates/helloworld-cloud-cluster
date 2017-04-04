# FeedHenry Hello World MBaaS Server
[![Dependency Status](https://img.shields.io/david/feedhenry-templates/helloworld-cloud-cluster.svg?style=flat-square)](https://david-dm.org/feedhenry-templates/helloworld-cloud-cluster)

This is a blank 'hello world' FeedHenry MBaaS. Use it as a starting point for building your APIs. 

# Group Hello World API

# hello [/hello]

'Hello world' endpoint.

## hello [POST] 

'Hello world' endpoint.

+ Request (application/json)
    + Body
            {
              "hello": "world"
            }

+ Response 200 (application/json)
    + Body
            {
              "msg": "Hello world"
            }
