# A3Mess
A3mess (pronounce as `A se mess`) 's SMS handler API.

## Installation

### Dependencies:

- redis-server

### Run:
```
$ cd a3mess
$ npm install
$ nodemon index.js
$ nodemon consumer.js
```

## Parts

### Web API:
Available on port `3883` by default. A valid request works as follow:

```
Endpoint: /

Valid arguments:
  - to: Receiver's phone number (11 digit)
  - body: Message body
  - user_id: Optional user_id to trigger proper tracks over segment.
```

### Consumer:
Actual worker which will process message requests. 

### Web UI:
A simple web UI provided by `kue` to monitor system. Available on port 38083 by default (editable in configs/config.js)
If you want to disable it just set its related (`config.status_delay `) value to `null` in `configs/config.js`