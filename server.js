var http = require("http"),
    https = require("https"),
    url = require("url"),
    redis = require("redis"),
    crypto = require("crypto");

var client = redis.createClient();

//create server
var server = http.createServer(function (request, response) {

    //get input's request pathname
    var pathname = url.parse(request.url).pathname;

    if (pathname == "/getRequestId") {
        if (request.method == 'POST') {
            //first request = > response generated ID
            handleGetRequestId(request, response, responseRequestId);
        }
    }
    else if (pathname == "/getResponse") {
        //second request = > response data from database
        handleGetResponse(request, response);
    }
    ;
});


//Function checks input object for request path '/getRequestId'
function checkInputParams(data, response) {
    if (!data.owner) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end("The parameter 'owner' is required");
        return false;
    }

    if (!data.repo) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end("The parameter 'repo' is required");
        return false;
    }

    if (!data.date) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end("The parameter 'date' is required");
        return false;
    }
    if (!isValidDate(data.date)) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end("The parameter 'date' is in wrong format or is invalid");
        return false;
    }

    return true;
}

//Function create response for request to path '/getRequestId'
function responseRequestId(request, response, data, error) {

    //check if there was error in parsing input params
    if (error) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end(error.message);
        return;
    }

    //check input params
    if (!checkInputParams(data, response)) {
        return;
    }

    //generate key for request and return it
    var key = crypto.randomBytes(16).toString("hex");
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.end(key);


    //call making request to github
    make_request_to_github(data, key);
}

//Function makes request to github and saves response to DB within input key
function make_request_to_github(data, key) {
    var options = {
        protocol: 'https:',
        host: 'api.github.com',
        path: '/repos/' + data.owner + '/' + data.repo + '/commits' + '?since=' + data.date + 'T00:00:00Z' + '&until=' + data.date + 'T23:59:59Z' + (data.author ? '&author=' + data.author : ''),
        headers: {
            "User-Agent": "My-Test-App"
        }
    };

    callback = function (response) {
        var str = '';

        //chunk of data has been recieved, append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved
        response.on('end', function () {
            //save response to DB
            client.set(key, str);
        });
    };

    https.request(options, callback).end();
}

//Function joins parts of input request and call fnCallback when process is done
function handleGetRequestId(request, response, fnCallback) {

    var jsonString = '';

    request.on('data', function (data) {
        jsonString += data;
    });

    request.on('end', function () {

        var oRequestObj,
            oError;

        try {
            oRequestObj = JSON.parse(jsonString);
        }
        catch (ex) {
            oError = ex;
        }

        fnCallback(request, response, oRequestObj, oError);
    });
};


//Function create response for request to path '/getResponse'. It gets saved response to github from DB using input request parameter 'requestID'
function handleGetResponse(request, response) {
    var qdata = url.parse(request.url, true).query;

    if (!qdata.requestID) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end("The parameter 'requestID' is required");
        return;
    }

    client.get(qdata.requestID, function (err, reply) {
        response.end(reply);
    });
};

//Function validates date for input format 'YYYY-mm-dd'
function isValidDate(dateString) {
    var regEx = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateString.match(regEx))
        return false;  // Invalid format

    var d = new Date(dateString);

    if (!d.getTime())
        return false; // Invalid date or this could be epoch

    return d.toISOString().slice(0, 10) === dateString;
}

server.listen(8124);
console.log('Server running at http://127.0.0.1:8124/');