var zlib = require('zlib'),
    fs = require('fs'),
    should = require('should'),
    Planner = require('../lib/BasicCSA.js'),
    Deserialize = require('./data/Deserialize.js'),
    async = require('async');

describe('Test minimum transfer time', function () {
    //Read stations in memory
    var stations = JSON.parse(fs.readFileSync('test/data/stations.json', 'utf8'));
    var minimumTransferTime = 180;
    var queries = [
        {
            //Short travel: should only contain 2 stops
            departureStop : "stops:32829",
            departureTime : new Date("2013-12-16T00:00:00.000Z"),
            "minimumTransferTime": minimumTransferTime,
            arrivalStop : "stops:32830"
        },
        {
            //Short travel: should only contain 2 stops
            departureStop : "stops:32830",
            departureTime : new Date("2013-12-16T00:00:00.000Z"),
            "minimumTransferTime": minimumTransferTime,
            arrivalStop : "stops:32829"
        },
        {
            //Long travel: should contain multiple stops
            departureStop : "stops:32829",
            departureTime : new Date("2013-12-16T00:00:00.000Z"),
            "minimumTransferTime": minimumTransferTime,
            arrivalStop : "stops:32831"
        },
    ];
    async.eachSeries(queries, function (query, doneEntry) {
        //let's create our route planner
        var planner = new Planner(query);
        var ending = "";
        if (query.arrivalStop) {
            ending += "to " + stations[query.arrivalStop].name + " (" + query.arrivalStop + ")";
        }
        describe(stations[query.departureStop].name + " (" + query.departureStop + ") " + ending, function () {
            var readStream = fs.createReadStream('test/data/test20131216.json.gz', {flags: 'r'});
            var result = readStream.pipe(zlib.createGunzip()).pipe(new Deserialize()).pipe(planner);
            it("should yield a result", function (done) {
                var mst = {};
                result.on("data", function (data) {
                    //It should never give two times the same arrivalStop!
                    if (mst[data["departureStop"]]) {
                        if(!(mst[data["departureStop"]]["gtfs:trip"] == data["gtfs:trip"])) {
                            var transferTime = (data["arrivalTime"].getTime() - mst[data["departureStop"]]["arrivalTime"].getTime())/1000;
                            if(transferTime < minimumTransferTime) {
                                done('Minimum transfertime exceeded at transfer: ' + stations[mst[data["departureStop"]]].name + " -> " + stations[data.departureStop].name + " - " + transferTime);
                            }
                        }
                    }
                    mst[data.arrivalStop] = data;
                });
                result.on("result", function (path) {
                    done();
                    doneEntry();
                    readStream.destroy();
                    result.destroy();
                });
                result.on("error", function (error) {
                    done("error encountered" + error);
                    doneEntry();
                });
                result.on("end", function () {
                    if (query.arrivalStop) {
                        done("no path found");
                    } else {
                        done();
                    }
                    doneEntry();
                });
            });
        });
    });
});
