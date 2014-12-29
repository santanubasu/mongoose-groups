require("../testSetup.js");

var q = require("q");
var mongoose = require("mongoose");
var groups = require("groups");

describe("For groups module,", function() {
    before(function() {
        return q.ninvoke(mongoose, "connect", "mongodb://localhost/testgroups");
    });
    beforeEach(function() {
        return q.ninvoke(mongoose.connection.db, "dropDatabase");
    });
    after(function() {
        mongoose.connection.close();
    })
    describe("tests enclosure,", function() {
        var group1 = new schema.Group({
            name:"Group 1"
        });
        var group2 = new schema.Group({
            name:"Group 2"
        });
        var group3 = new schema.Group({
            name:"Group 3"
        });
        before(function() {
                return q
                    .all([
                        q.ninvoke(group1, "save"),
                        q.ninvoke(group2, "save"),
                        q.ninvoke(group3, "save")
                    ])
                .then(function() {
                    return groups.encloseGroup(group1, group2);
                })
                .then(function() {
                    return groups.encloseGroup(group2, group3);
                })
        });
        it("tests direct enclosure", function(done) {
            groups.encloses(group1, group2)?done():done(new Error());
        });
        it("tests not direct enclosure", function(done) {
            !groups.encloses(group2, group1)?done():done(new Error());
        });
        it("tests not self enclosure", function(done) {
            !groups.encloses(group1, group1)?done():done(new Error());
        });
        it("tests indirect enclosure", function(done) {
            groups.encloses(group1, group3)?done():done(new Error());
        });
        it("tests not indirect enclosure", function(done) {
            !groups.encloses(group3, group1)?done():done(new Error());
        });
    });
})