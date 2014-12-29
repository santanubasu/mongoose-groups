var q = require("q");
var mongoose = require("mongoose");
var mockgoose = require("mockgoose");
var groups = require("../groups.js");

mockgoose(mongoose);

var userSchema = mongoose.Schema({
    name:String
});

var groupSchema = mongoose.Schema({
    name:String
});
groups.enable(groupSchema, "User");

var Group = mongoose.model("Group", groupSchema);
var User = mongoose.model("User", userSchema);

describe("For groups module,", function() {
    before(function() {
        mongoose.connect("mongodb://localhost/testgroups");
    });
    beforeEach(function() {
        mongoose.connection.db.dropDatabase();
    });
    after(function() {
        mongoose.connection.close();
    })
    describe("tests enclosure,", function() {
        var group1 = Group({
            name:"Group 1"
        });
        var group2 = Group({
            name:"Group 2"
        });
        var group3 = Group({
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