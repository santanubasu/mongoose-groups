var mongoose = require("mongoose");
var q = require("q");
var _ = require("underscore");

require("node-polyfill");

var enable = module.exports.enable = function(schema, memberRef) {
    schema.plugin(function() {
        schema.add({
            enclosurePaths:[{
                type:String,
                index:true,
                unique:true
            }],
            enclosingGroups:[{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Group",
                index:true
            }],
            members:[{
                type:mongoose.Schema.Types.ObjectId,
                ref:memberRef,
                index:true
            }]
        });
    })
}

// Enclose one group inside another one.
var encloseGroup = module.exports.encloseGroup = function(enclosing, enclosed) {
    // First find all groups enclosing `enclosing`.  This is used to ensure that `enclosed` does not already enclose
    // `enclosing`
    return findAllEnclosingGroups(enclosing)
        .then(function(currentlyEnclosing) {
            var loop = false;
            // If a loop is detected, throw an error, otherwise proceed
            for (var i=0; i<currentlyEnclosing.length&&!loop; i++) {
                if (currentlyEnclosing[i].id==enclosed.id) {
                    loop = true;
                }
            }
            if (loop) {
                throw {
                    message:"Cannot enclose "+enclosed.id+" inside "+enclosing.id+" because it would create a cyclical enclosure."
                }
            }
            else {
                // If `enclosing` does not already enclose `enclosed`, process the enclosure, otherwise return a trivial
                // promise which returns `enclosing`
                if (enclosed.enclosingGroups.indexOf(enclosing.id)==-1) {
                    // Add `enclosing` to the set of direct enclosing groups for `enclosed`
                    enclosed.enclosingGroups.addToSet(enclosing);
                    var enclosingPrefixes;
                    // Generate enclosurePrefixes, which are all enclosure paths leading from roots through `enclosing`
                    // to `enclosed`.  These will be used to modify enclosure paths for all groups already enclosed by
                    // `enclosed`
                    if (enclosing.enclosurePaths.length==0) {
                        enclosingPrefixes = ["/"+enclosing.id]
                    }
                    else {
                        enclosingPrefixes = enclosing.enclosurePaths.map(function(enclosurePath) {
                            return enclosurePath+"/"+enclosing.id
                        })
                    }
                    // Find all groups already enclosed by `enclosed` and operate on their enclosure paths.  The result
                    // is addition/modification of their `enclosurePaths` arrays to include all new paths through which
                    // they are reachable as a result of the current tenclosure operation.
                    return findAllEnclosedGroups(enclosed)
                        .then(function(currentlyEnclosed) {
                            var enclosurePathUpdatePromises;

                            // If `enclosed` is initally a root group (not enclosed in any other), then modify the
                            // `enclosurePaths` of all it's enclosed groups.
                            if (enclosed.enclosurePaths.length==0) {
                                enclosurePathUpdatePromises = currentlyEnclosed.map(function(group) {
                                    var newEnclosurePaths = [];
                                    var replacedEnclosurePaths = [];
                                    for (var i=0; i<group.enclosurePaths.length; i++) {
                                        if (group.enclosurePaths[i].startsWith("/"+enclosed.id)) {
                                            replacedEnclosurePaths.push(group.enclosurePaths[i]);
                                            for (var j=0; j<enclosingPrefixes.length; j++) {
                                                newEnclosurePaths.push(enclosingPrefixes[j]+group.enclosurePaths[i]);
                                            }
                                        }
                                    }
                                    group.enclosurePaths.remove.apply(group.enclosurePaths, replacedEnclosurePaths);
                                    group.enclosurePaths.addToSet.apply(group.enclosurePaths, newEnclosurePaths);
                                    return q.ninvoke(group, "save");
                                });
                            }
                            // Otherwise, append the `enclosurePaths`
                            else {
                                enclosurePathUpdatePromises = currentlyEnclosed.map(function(group) {
                                    var newEnclosurePaths = [];
                                    group.enclosurePaths.forEach(function(enclosurePath) {
                                        if (enclosurePath.startsWith(enclosed.enclosurePaths[0]+"/"+enclosed.id)) {
                                            newEnclosurePaths.push(enclosurePath.replace(enclosed.enclosurePaths[0], ""))
                                        }
                                    });
                                    var newEnclosurePaths = _.flatten(enclosingPrefixes.map(function(enclosingPrefix) {
                                        return newEnclosurePaths.map(function(newEnclosurePath) {
                                            return enclosingPrefix+newEnclosurePath;
                                        });
                                    }));
                                    group.enclosurePaths.addToSet.apply(group.enclosurePaths, newEnclosurePaths);
                                    return q.ninvoke(group, "save");
                                });
                            }

                            // For `enclosed` itself, the `enclosingPrefixes` array contains all new enclosure paths to
                            // add.
                            enclosed.enclosurePaths.addToSet.apply(enclosed.enclosurePaths, enclosingPrefixes);
                            return q
                                .all([
                                    q.all(enclosurePathUpdatePromises),
                                    q
                                        .ninvoke(enclosed, "save")
                                ])
                                .then(function() {
                                    return enclosing;
                                })
                        });
                }
                else {
                    return q.when(enclosing);
                }
            }
        })
}

// Release one group enclosure within another.  This is the opposite of encloseGroup.
var releaseGroup = module.exports.releaseGroup = function(enclosing, enclosed) {
    // If `enclosed` is not directly enclosed by `enclosing` then there is nothing to be done
    if (enclosed.enclosingGroups.indexOf(enclosing.id)==-1) {
        return q.when(enclosing);
    }
    else {
        var enclosingPrefixes;
        // Generate enclosurePrefixes, which are all enclosure paths leading from roots through `enclosing`
        // to `enclosed`.  These will be used to modify enclosure paths for all groups already enclosed by
        // `enclosed`
        if (enclosing.enclosurePaths.length==0) {
            enclosingPrefixes = ["/"+enclosing.id]
        }
        else {
            enclosingPrefixes = enclosing.enclosurePaths.map(function(enclosurePath) {
                return enclosurePath+"/"+enclosing.id
            })
        }
        // First make changed to `enclosed` itself, and then operate on it's enclosed groups
        enclosed.enclosingGroups.remove(enclosing);
        enclosed.enclosurePaths.remove.apply(enclosed.enclosurePaths, enclosingPrefixes);
        // Record whether this operation results in `enclosed` becoming a root (no further enclosing groups)
        var isNewRoot = enclosed.enclosurePaths.length==0;
        return findAllEnclosedGroups(enclosed)
            .then(function(currentlyEnclosed) {
                var enclosurePathUpdatePromises = currentlyEnclosed.map(function(group) {
                    var newEnclosurePaths = [];
                    var replacedEnclosurePaths = [];
                    for (var i=0; i<group.enclosurePaths.length; i++) {
                        for (var j=0; j<enclosingPrefixes.length; j++) {
                            if (group.enclosurePaths[i].startsWith(enclosingPrefixes[j]+"/"+enclosed.id)) {
                                if (isNewRoot) {
                                    newEnclosurePaths.push(group.enclosurePaths[i].replace(enclosingPrefixes[j], ""));
                                }
                                replacedEnclosurePaths.push(group.enclosurePaths[i]);
                            }
                        }
                    }
                    group.enclosurePaths.remove.apply(group.enclosurePaths, replacedEnclosurePaths);
                    group.enclosurePaths.addToSet.apply(group.enclosurePaths, newEnclosurePaths);
                    return q.ninvoke(group, "save");
                });
                return q
                    .all([
                        q.all(enclosurePathUpdatePromises),
                        q
                            .ninvoke(enclosed, "save")
                    ])
                    .then(function() {
                        return enclosing;
                    })
            });
    }
}

// Find all groups directly or indirectly enclosing `group`s
var findAllEnclosingGroups = module.exports.findAllEnclosingGroups = function(groups) {
    if (groups.length==0) {
        return q.when([]);
    }
    groups = [].concat(groups);
    var enclosureIds = {};
    groups.forEach(function(group) {
        group.enclosurePaths.forEach(function(enclosurePath) {
            enclosurePath.split("/").splice(1).forEach(function(id) {
                enclosureIds[id] = true;
            });
        });

    })
    return q(groups[0].constructor
        .find({
            _id:{
                $in:_.keys(enclosureIds)
            }
        })
        .exec());
}

// Find all groups directly or indirectly enclosed by `group`
var findAllEnclosedGroups = module.exports.findAllEnclosedGroups = function(group) {
    var enclosurePatterns;
    if (group.enclosurePaths.length==0) {
        enclosurePatterns = [new RegExp("^"+"\/"+group.id)]
    }
    else {
        enclosurePatterns = group.enclosurePaths.map(function(enclosurePath) {
            return new RegExp("^"+enclosurePath+"\/"+group.id);
        })
    }
    return q(group.constructor.find({
        enclosurePaths:{
            $in:enclosurePatterns
        }
    }).exec());
}

// Join `principal` to `group`
var join = module.exports.join = function(group, principal) {
    group.members.addToSet(principal);
}

// Detach `principal` from `group`
var leave = module.exports.leave = function(group, principal) {
    group.members.remove(principal);
}

// Test if `enclosed` is enclosed by `enclosing`, directly or indirectly
var encloses = module.exports.encloses = function(enclosing, enclosed) {
    var enclosureIds = {};
    enclosed.enclosurePaths.forEach(function(enclosurePath) {
        enclosurePath.split("/").splice(1).forEach(function(segment) {
            enclosureIds[segment] = true;
        })
    })
    return enclosing.id in enclosureIds;
}

// Get all groups of which `principal` is a member
var getPrincipalGroups = module.exports.getPrincipalGroups = function(principal, groupModel) {
    return q(groupModel
        .find(
        {
            members:principal
        })
        .exec());
}

// Get a map of all enclosing groups for `principal`
var getEnclosureMap = module.exports.getEnclosureMap = function(principal, groupModel) {
    return getPrincipalGroups(principal, groupModel)
        .then(function(principalGroups) {
            return q.all([
                principalGroups,
                findAllEnclosingGroups(principalGroups)
            ])
        })
        .spread(function(principalGroups, groups) {
            groups = groups.concat(principalGroups);
            var groupMap = {};
            groups.forEach(function(group) {
                groupMap[group.id] = group;
            })
            return groupMap;
        });
}
