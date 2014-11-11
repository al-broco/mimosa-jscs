var path = require('path');
var assert = require('assert');
var expect = require('expect');
var Promise = require('bluebird');
var MimosaProject = require('./MimosaProject');

describe('node-jscs', function(){
  var project;

  beforeEach(function () {
    project = new MimosaProject();
    project.mimosaConfig.modules.push('jscs');
    return project.exec('npm', 'install', path.normalize(process.cwd()));
  });

  // Helper function that, given a MimosaProject build result, returns
  // a resolved promise with an array of JSCS violations. Intended for
  // chaining after MimosaProject.build to get easy access to
  // violations.
  function extractJscsViolations(buildResult) {
    var violations = [];
    buildResult.warnings.forEach(function (warning) {
      warning.message.indexOf('JSCS Error:') === 0
        && violations.push(warning.message);
    });
    return Promise.resolve(violations, buildResult);
  }

  // Helper function that builds and invokes a test function with
  // violations, testResult as arguments
  function buildAndTest(testFunc) {
    return project.build()
      .then(extractJscsViolations)
      .then(testFunc);
  }

  describe('when linting a single JS asset', function () {
    it('default configuration produces no warnings ' +
       'for correct (but ugly) code',
       function () {
         project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

         return buildAndTest(function (violations) {
           expect(violations).toEqual([]);
         });
       });

    it('default configuration produces warnings ' +
       'for malformed code',
       function () {
         project.files.assets.javascripts['main.js'] = 'malformed code';

         return buildAndTest(function (violations) {
           expect(violations).toNotEqual([]);
         });
       });

    it('a preset can be used to enable rules', function () {
      project.mimosaConfig.jscs = { rules: { preset: 'crockford' } };

      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

      return buildAndTest(function (violations) {
        expect(violations).toNotEqual([]);
      });
    });

    it('a rule can be individually enabled', function () {
      project.mimosaConfig.jscs = { rules: { requireLineFeedAtFileEnd: true } };

      project.files.assets.javascripts['main.js'] = 'x=1;"ugly code"';

      return buildAndTest(function (violations) {
        expect(violations.length).toBe(1);
      });
    });
  });
});
