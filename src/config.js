'use strict';

var fs = require('fs');
var path = require('path');
var stripJSONComments = require('strip-json-comments');

var logger;

exports.defaults = function () {
  return {
    jscs: {
      exclude: [],
      compiled: true,
      copied: true,
      vendor: false,
      executeOnCompiledCode: true
    }
  };
};

exports.validate = function (config, validators) {
  logger = config.log;

  var errors = [];

  if (validators.ifExistsIsObject(errors, 'jscs config', config.jscs)) {

    if (validators.ifExistsIsBoolean(errors,
                                     'jscs.executeOnCompiledCode',
                                     config.jscs.executeOnCompiledCode)) {

      // Determine what step to run JSCS at and what
      // text to run it on. Create specific function
      // to return value rather than run if stmt on
      // flag for each file.
      if (config.jscs.executeOnCompiledCode) {
        config.jscs.workflowStep = 'afterCompile';
        config.jscs.textToProcess = function(file) {
          return file.outputFileText;
        };
      } else {
        config.jscs.workflowStep = 'beforeCompile';
        config.jscs.textToProcess = function(file) {
          return file.inputFileText;
        };
      }
    }

    // Note: Call below will modify config to have an
    // jscs.excludeRegex and change jscs.exclude to have absolute
    // paths
    validators.ifExistsFileExcludeWithRegexAndString(errors,
                                                     'jscs.exclude',
                                                     config.jscs,
                                                     config.watch.sourceDir);

    ['compiled', 'copied', 'vendor'].forEach(function (type) {
      validators.ifExistsIsBoolean(errors, 'jscs.' + type, config.jscs[type]);
    });

    var configFileExists = ifExistsIsFile(validators,
                                          errors,
                                          'jscs.configFile',
                                          config.jscs.configFile,
                                          config.root);

    if (!configFileExists && !config.jscs.rules) {
      logger.warn('Neither JSCS rules or JSCS config file specified, JSCS ' +
                  'will check for syntax errors only');
    }

    if (!validators.ifExistsIsObject(errors, 'jscs.rules', config.jscs.rules)) {
      // Make sure jscs.rules exists and is an object
      config.jscs.rules = { };
    }

    if (configFileExists) {
      // Merge property from config file into rules property, rules
      // properties overriding config file properties
      var jscsConfig = getContent(config.jscs.configFile, config.root);
      for (var property in jscsConfig) {
        property in config.jscs.rules ||
          (config.jscs.rules[property] = jscsConfig[property]);
      }
    }

    if (validators.ifExistsIsArray(errors,
                                   'excludeFiles in JSCS config',
                                   config.jscs.rules.excludeFiles))
    {
      config.jscs.excludeGlobs = config.jscs.rules.excludeFiles;
    }
  }

  return errors;
};

// Validates that a property is a string pointing to an existing file
// (absolute path or relative to project root). Similar to standard
// Mimosa validator functions.
function ifExistsIsFile(validators, errors, fld, file, relTo) {
  if (!validators.ifExistsIsString(errors, fld, file)) {
    return false;
  }

  var fullPath = path.resolve(relTo, file);
  if (!fs.existsSync(fullPath)) {
    errors.push('' + fld + ' [[ ' + fullPath + ' ]] cannot be found');
    return false;
  }
  if (!fs.statSync(fullPath).isFile()) {
    errors.push('' + fld + ' [[ ' + fullPath + ' ]] exists but is not a file');
    return false;
  }

  return true;
}

// Loads a configuration file. This function is copied from the file
// cli-config.js in JSCS v1.7.3. It is not part of JSCS' public
// interface, by copying it mimosa-jscs gets the same behavior as
// JSCS. Function has been slightly rewritten to add some logging.
function getContent(config, directory) {
  if (!config) {
    return;
  }

  var configPath = path.resolve(directory, config);
  var ext;
  var content;

  config = path.basename(config);

  if (fs.existsSync(configPath)) {
    ext = path.extname(configPath);

    if (ext === '.js' || ext === '.json') {
      logger.debug('Loading JSCS config from [[ ' + configPath + ' ]] ' +
                   'using Node require');
      content = require(configPath);
    } else {
      logger.debug('Loading JSCS config from [[ ' + configPath + ' ]] ' +
                   'as JSON (with comments removed)');
      content = JSON.parse(
        stripJSONComments(
          fs.readFileSync(configPath, 'utf8')
        )
      );
    }

    // Adding property via Object.defineProperty makes it
    // non-enumerable and avoids warning for unsupported rules
    Object.defineProperty(content, 'configPath', {
      value: configPath
    });
  }

  if (content && config === 'package.json') {
    if ('jscsConfig' in content) {
      logger.debug('Using JSCS config in jscsConfig property of ' +
                   '[[ ' + configPath + ' ]]');
    } else {
      logger.warn('Loading JSCS config from [[ ' + configPath + ' ]], ' +
                  'but [[ ' + configPath + ' ]] is missing a jscsConfig ' +
                  'property');
    }

    return content.jscsConfig;
  }

  return content;
}
