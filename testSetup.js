requireLocal = (function(root) {
    return function(resource) {
        return require(root+"/local_modules/"+resource);
    }
})(__dirname);

