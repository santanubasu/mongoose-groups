var q = require("q");
var _ = require("underscore");
var mongoose = require("mongoose");
var groups = require("../groups.js");

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
    after(function() {
        mongoose.connection.db.dropDatabase();
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
        var group4 = Group({
            name:"Group 4"
        });
        var group5 = Group({
            name:"Group 5"
        });
        var group6 = Group({
            name:"Group 6"
        });
        before(function() {
            return q
                .all([
                    q.ninvoke(group1, "save"),
                    q.ninvoke(group2, "save"),
                    q.ninvoke(group3, "save"),
                    q.ninvoke(group4, "save"),
                    q.ninvoke(group5, "save"),
                    q.ninvoke(group6, "save")
                ])
                .then(function() {
                    return groups.encloseGroup(group1, group2);
                })
                .then(function() {
                    return groups.encloseGroup(group2, group3);
                })
                .then(function() {
                    return groups.encloseGroup(group4, group3);
                })
                .then(function() {
                    return groups.encloseGroup(group4, group5);
                })
                .then(function() {
                    return groups.encloseGroup(group2, group6);
                })
        });
        it("should return true when the first parameter directly encloses the second parameter", function(done) {
            groups.encloses(group1, group2)?done():done(new Error());
        });
        it("should return false when the first parameter does not enclose the second parameter", function(done) {
            !groups.encloses(group2, group1)?done():done(new Error());
        });
        it("should return false when the first and second parameter are the same", function(done) {
            !groups.encloses(group1, group1)?done():done(new Error());
        });
        it("should return true when the first parameter indirectly encloses the second parameter", function(done) {
            groups.encloses(group1, group3)?done():done(new Error());
        });
        it("should return false when the first parameter does not directly or indirectly enclose the second parameter", function(done) {
            !groups.encloses(group3, group1)?done():done(new Error());
        });
        it("should return true when the first parameter encloses the second parameter, and the second parameter has one or more additional roots", function(done) {
            groups.encloses(group4, group3)?done():done(new Error());
        });
        it("should return false when there is no enclosure path from the second parameter to the first parameter", function(done) {
            !groups.encloses(group1, group5)?done():done(new Error());
        });
    });
    describe("tests membership,", function() {
        var user1 = User({
            name:"User 1"
        });
        var user2 = User({
            name:"User 2"
        });
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
                    q.ninvoke(group3, "save"),
                    q.ninvoke(user1, "save"),
                    q.ninvoke(user2, "save")
                ])
                .then(function() {
                    groups.join(group1, user1);
                    groups.join(group3, user2);
                    return q
                        .all([
                            groups.encloseGroup(group1, group3),
                            groups.encloseGroup(group2, group3)
                    ])
                })
        });

        it("should return a map containing one direct and two indirect enclosing groups when principal is a member of one one group that is enclosed by the other two groups", function(done) {
            groups
                .getEnclosureMap(user2, Group)
                .then(function(enclosureMap) {
                    ((group1.id in enclosureMap)&&(group2.id in enclosureMap)&&(group3.id in enclosureMap))?done():done(new Error());
                });
        });
    });
})