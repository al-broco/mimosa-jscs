'use strict';

var path = require('path');
var minimatch = require('minimatch');
var config = require('./config');
var jscs;
var logger;

function registration (mimosaConfig, register) {
  logger = mimosaConfig.log;

  var extensions = getFileExtensions(mimosaConfig);
  if (extensions.length > 0) {
    register(['buildFile'],
             mimosaConfig.jscs.workflowStep,
             onMimosaBuildWorkflowCallback,
             extensions);
    register(['add', 'update'],
             mimosaConfig.jscs.workflowStep,
             onMimosaWatchWorkflowCallback,
             extensions);
  }
}

/**
 * Based on a Mimosa config, return an array of file name extensions
 * the module should act on.
 */
function getFileExtensions(mimosaConfig) {
  var result = [];

  if (mimosaConfig.jscs.copied || mimosaConfig.jscs.vendor) {
    result.push('js');
  }

  if (mimosaConfig.jscs.compiled) {
    mimosaConfig.extensions.javascript.forEach(function (extension) {
      extension !== 'js' && result.push(extension);
    });
  }

  return result;
}

/**
 * Called by Mimosa when the module should act during a build, see
 * Mimosa doc for details.
 */
function onMimosaBuildWorkflowCallback(mimosaConfig, options, next) {
  mimosaWorkflowLintFiles(mimosaConfig, options, next);
}

/**
 * Called by Mimosa when the module should act during watch, see
 * Mimosa doc for details.
 */
function onMimosaWatchWorkflowCallback(mimosaConfig, options, next) {
  // Force a new JSCS instance to be created. This will reset the
  // errors counter so that JSCS does not stop reporting if maxErrors
  // is reached if a file is linted again and again
  unloadJscs();
  mimosaWorkflowLintFiles(mimosaConfig, options, next);
}

/**
 * Lints files passed to the module as a Mimosa workflow step.
 */
function mimosaWorkflowLintFiles(mimosaConfig, options, next) {
  if (shouldProcessFilesBasedOnOptions(mimosaConfig.jscs, options)) {
    processFiles(mimosaConfig, options.files);
  } else {
    logSkippedFiles(options);
  }

  next();
}

/**
 * Decides whether a given set of files should be JSCS linted or not
 * based on module configuration and Mimosa options - Mimosa options
 * keeps track of if the files are vendor files, copied or compiled,
 * etc.
 */
function shouldProcessFilesBasedOnOptions(moduleConfig, mimosaOptions) {
  // Special treatment of vendor files - setting vendor to true lints
  // copied vendor files regardless of copy option, compiled vendor
  // files are never linted
  if (mimosaOptions.isVendor) {
    return moduleConfig.vendor && mimosaOptions.isCopy;
  }

  if (mimosaOptions.isCopy && !moduleConfig.copied) {
    return false;
  }

  if (mimosaOptions.isJavascript &&
      !mimosaOptions.isCopy &&
      !moduleConfig.compiled)
  {
    return false;
  }

  return true;
}

/**
 * Debug logs that all files included in a Mimosa options object has
 * been skipped.
 */
function logSkippedFiles(mimosaOptions) {
  mimosaOptions.files.forEach(function (file) {
    var message = 'Not JSCS linting ';
    mimosaOptions.isCopy && (message += 'copied ');
    !mimosaOptions.isCopy &&
      mimosaOptions.isJavascript &&
      (message += 'compiled ');
    mimosaOptions.isVendor && (message += 'vendor ');
    message += 'file [[ ' + file.inputFileName + ' ]]';
    logger.debug(message);
  });
}

/**
 * Lints the files in an array that should be linted based on the
 * module configuration.
 */
function processFiles(mimosaConfig, files) {
  files.forEach(function (file) {
    if (shouldProcessFile(mimosaConfig, file)) {
      processFile(mimosaConfig.jscs, file);
    } else {
      logger.debug('Excluding [[ ' + file.inputFileName +
                   ' ]] from JSCS linting');
    }
  });
}

/**
 * Returns true of a given file should be linted based on the
 * configuration.
 */
function shouldProcessFile(mimosaConfig, file) {
  var text = mimosaConfig.jscs.textToProcess(file);
  if (!text) {
    return false;
  }

  var relativePath = path.relative(mimosaConfig.watch.sourceDir,
                                   file.inputFileName);
  if (isFileExcludedBasedOnName(mimosaConfig.jscs,
                                file.inputFileName,
                                relativePath))
  {
    return false;
  }

  return true;
}

/**
 * Returns true if a file should be excluded based on file name
 * according to the module configuration.
 */
function isFileExcludedBasedOnName(moduleConfig, absolutePath, relativePath) {
  // Note that config validation has modified moduleConfig.exclude and
  // create moduleConfig.excludeRegex
  if ((moduleConfig.exclude || []).indexOf(absolutePath) !== -1) {
    logger.debug('Not JSCS linting [[ ' + absolutePath +
                 ' ]] because a string match was found in jscs.exclude');
    return true;
  }

  if (moduleConfig.excludeRegex &&
      relativePath.match(moduleConfig.excludeRegex))
  {
    logger.debug('Not JSCS linting [[ ' + absolutePath +
                 ' ]] because a regex match was found in jscs.exclude');
    return true;
  }

  var match = false;
  moduleConfig.excludeGlobs && moduleConfig.excludeGlobs.forEach(
    function (glob) {
      if (minimatch(relativePath, glob)) {
        match ||
          logger.debug('Not JSCS linting [[ ' + absolutePath +
                       ' ]] because it matches ' + glob +
                       ' from JSCS config excludeFiles');
        match = true;
      }
    });
  return match;
}

/**
 * JSCS lints a file.
 */
function processFile(moduleConfig, file) {
  var jscs = loadJscs(moduleConfig);
  var text = moduleConfig.textToProcess(file);
  var errors = checkString(jscs, text, file.inputFileName);
  errors.forEach(function (error) {
    logJscsError(file.inputFileName, error);
  });
}

/**
 * JSCS lints the contents of a file.
 */
function checkString(jscs, string, inputFileName) {
  try {
    var errors = jscs.checkString(string, inputFileName);
    return errors.getErrorList();
  } catch (error) {
    // Early JSCS versions throw an exception on syntax errors, later
    // versions report an error. For consistency, convert syntax error
    // exceptions to errors.
    var match = /Syntax error at .*: Line (\d): (.*)/.exec(error);
    if (match) {
      return [
        {
          message: match[2],
          line: match[1]
        }
      ];
    } else {
      // Unexpected exception, rethrow
      throw error;
    }
  }
}

/**
 * Logs a JSCS error.
 */
function logJscsError (fileName, error) {
  var msg = createErrorMessage(fileName,
                               error.message,
                               error.line,
                               error.column);
  logger.warn(msg);
}

/**
 * Creates an error message based on file name, line number, etc.
 */
function createErrorMessage(fileName, message, lineNumber, columnNumber) {
  message = 'JSCS Error: ' + message + ', in file [[ ' + fileName + ' ]]';
  lineNumber && (message += ', at line number [[ ' + lineNumber + ' ]]');
  columnNumber && (message += ' column [[ ' + columnNumber + ' ]]');
  return message;
}

/**
 * Returns a JSCS instance, loading and configuring it if
 * necessary. Calling this function repeatedly will return the same
 * instance, reusing it. unloadJscs can be used to trigger a reload.
 */
function loadJscs(moduleConfig) {
  if (!jscs) {
    jscs = new (require('jscs'))();
    jscs.registerDefaultRules();
    jscs.configure(moduleConfig.rules);
  }
  return jscs;
}

/**
 * Discards any jscs instance loaded by loadJscs.
 */
function unloadJscs() {
  jscs = undefined;
}

module.exports = {
  registration: registration,
  defaults: config.defaults,
  validate: config.validate
};
