// Initialization
var kue, bunyan, log, config, request, queue, magfa;

kue = require('kue');
request = require('request');
bunyan = require('bunyan');
config = require('./configs/config');
magfa = config.magfa;

// Initializ queue
queue = kue.createQueue();

// Setup logger
log = bunyan.createLogger({name: 'A3Mess Consumer'});

// Setup analytics
var Analytics = require('analytics-node');
var analytics = new Analytics(config.segment_key);

// Define processors
queue.process("send-sms", function(job, done){
    sendSMS(job.data, done);
});

queue.process("check-status", function(job, done){
    checkStatus(job.data, done);
});

var addToCheckStatus = function(body, data){
    var msg_data = {
        title: "SMS: " + body + " to: " + data.user_id + " with number: " + data.to,
        mid: body,
        user_id: data.user_id
    };

    queue.create("check-status", msg_data)
        .attempts(5)
        .delay(config.status_delay)
        .backoff( {type:'exponential'} )
        .save();
};

var sendSMS = function(data, done){
    var req, endpoint, req_data;

    // Very bad hack! Magfa can't recognize string service name so
    // service = "enqueu" will return error 25 and I hardcoded it :|
    endpoint = magfa.http.endpoint + "?service=enqueue";
    req_data = {
        domain: magfa.domain,
        username: magfa.username,
        password: magfa.password,
        from: magfa.from,
        to: data.to,
        body: data.body
    };

    req = request.post(endpoint, function(error, response, body){
        if(!error && response.statusCode === 200){
            log.info("Add messsage " + body + " to check status queue");
            addToCheckStatus(body, data);

            // If there is a user_id, track status
            if(data.user_id){
                changeAnalytics(data.user_id, data.mid, "Message in queue");
            }
            // Job done
            done();
        } else {
            // Request failed
            var msg = "Failed to send message: " + error;
            log.warn(msg);
            done(new Error(msg));
        }
    }).form(req_data);
};

var changeAnalytics = function(userId, messageId, status){
    analytics.track({
        userId: userId,
        event: 'SMS Sent',
        properties: {
            message_id: messageId,
            status: status
        }
    });
};

var checkStatus = function(data, done){
    var req, endpoint, req_data;

    endpoint = magfa.http.endpoint + "?service=getRealMessageStatus";
    req_data = {
        domain: magfa.domain,
        username: magfa.username,
        password: magfa.password,
        messageId: data.mid
    };

    req = request.post(endpoint, function(error, response, body){
        if(!error && response.statusCode === 200){
            var status;

            if(body == 1){
                status = "Successful";
            } else if(body in [0, 2, 8, 16]){
                status = "Processing";
            } else {
                status = "Failed";
            }

            // If there is a user_id, track status
            if(data.user_id){
                changeAnalytics(data.user_id, data.mid, status);
            }
            log.info("Change message status to " + body);

            // Job done
            done();
        } else {
            var msg = "Failed to check status: " + error;
            log.warn(msg);
            done(new Error(msg));
        }
    }).form(req_data);

    log.info("Check status for message " + data.mid);
};

log.info("Consumer started...");
