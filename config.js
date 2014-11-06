"use strict";

exports.defaults = function() {
  return {
    jscs: {
      exclude: [],
      compiled: true,
      copied: true,
      vendor: false,
      rules: { },
    }
  };
};

exports.placeholder = function() {
  // TODO: Document
  return "";
};

exports.validate = function(config, validators) {
  var errors = [];

  if (validators.ifExistsIsObject(errors, "jscs config", config.jscs)) {
    validators.ifExistsIsObject(errors, "jscs.rules", config.jscs.rules);

    // Note: Call below will modify config to have an
    // jscs.excludeRegex and change jscs.exclude to have absolute
    // paths
    validators.ifExistsFileExcludeWithRegexAndString(errors, "jscs.exclude", config.jscs, config.watch.sourceDir);

    ["compiled", "copied", "vendor"].forEach(function(type) {
      validators.ifExistsIsBoolean(errors, "jscs." + type, config.jscs[type]);
    });
  }

  return errors;
};

