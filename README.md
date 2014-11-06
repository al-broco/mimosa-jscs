mimosa-jscs
===========

This is a [Mimosa](http://mimosa.io) module for linting Javascript
code using [JSCS](https://github.com/jscs-dev/node-jscs).

Note: `mimosa-jscs` is not a part of Mimosa and it is not maintained by the
Mimosa maintainers.

This module is in early development and not yet in a releasable state.

Installation
------------

`mimosa-jscs` is not in the npm registry so it must be installed from
github. In the root directory of your project, type:

    npm install --save-dev "al-broco/mimosa-jscs"

Next, add `jscs` to your project's list of modules. 

Configuration
-------------

To customize the linting you need to add a `jscs` configuration to
your project's `mimosa-config`. `mimosa-jscs` is configured in the
same way as [Mimosa's built-in linting
tools](http://mimosa.io/configuration.html#lint):

    jscs: {
        exclude: [],
        compiled: true,
        copied: true,
        vendor: false,
        rules: {}
    }

### `jscs.exclude`, `jscs.compiled`, `jscs.copied`, `jscs.vendor`

These options behave just like the corresponding options for the
[http://mimosa.io/configuration.html#lint](JSHint Mimosa plugin) and
they have the same defaults.

### `jscs.rules`

Configures JSCS linting, see [the JSCS
documentation](https://github.com/jscs-dev/node-jscs) for details.

Rules and presets are supported. Options that control which files are
linted, such as `excludeFiles` and `fileExtensions` are not supported.

### Examples

To validate your Javascript use to JSCS' Crockford preset, add the
following configuration:

    jscs: {
      rules: {
        preset: 'crockford',
      }
    }

The following configuration will check according to the Crockford
preset and also check that all comments starts with a capital letter:

    jscs: {
      rules: {
        preset: 'crockford',
        requireCapitalizedComments: true
      }
    }

To disable a rule, set it to `null`. The following configration will
validate using the Crockford preset but disable indentation checking:

    jscs: {
      rules: {
        preset: 'crockford',
        validateIndentation: null
      }
    }


Compatibility
-------------

This module uses version 1.7.3 of JSCS.

It has been tested with Mimosa version 2.3.17 but should work with
other versions of Mimosa as well.
