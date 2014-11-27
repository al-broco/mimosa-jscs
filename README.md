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
your project's `mimosa-config`. `mimosa-jscs` is configured similarly
as [Mimosa's built-in linting
tools](http://mimosa.io/configuration.html#lint). The configuration
options and the default values are as follows:

    jscs: {
        exclude: [],
        compiled: true,
        copied: true,
        vendor: false,
        configFile: undefined,
        rules: {}
    }

Which files are linted are controlled by the `jscs.exclude`,
`jscs.compiled`, `jscs.copied`, and `jscs.vendor` options. These
options work just like the corresponding options for the
[JSHint Mimosa plugin](http://mimosa.io/configuration.html#lint).

The `jscs.configFile` and `jscs.rules` controls JSCS linting, which
rules are enabled and how they are configured. JSCS configuration
options are described in detail in [the JSCS
documentation](https://github.com/jscs-dev/node-jscs#options). Currently,
the only options supported are
[`preset`](https://github.com/jscs-dev/node-jscs#preset) and
[configuration of individual
rules](https://github.com/jscs-dev/node-jscs#rules). Other options
(such as
[`excludeFiles`](https://github.com/jscs-dev/node-jscs#excludefiles)
and
[`fileExtensions`](https://github.com/jscs-dev/node-jscs#fileextensions))
may be supported in the future.

`jscs.configFile` is the file name of a JSCS configuration file,
absolute or relative to the project's root. In contrast to [running
JSCS from the command
line](https://github.com/jscs-dev/node-jscs#--config), `mimosa-jscs`
will not search other directories outside of your project for a
configuration file. In particular, it wll not search your home
directory or the project directory's ancestors for a file named
`.jscsrc` or `.jscs.json`. This is to make building independent of
external files not part of the Mimosa project.

`mimosa-jscs` reads configuration files the same way as JSCS does,
which means that the file format is determined from the file name:
* If the file extension is `.js` the file is read as a [Node
  module](http://nodejs.org/api/modules.html) using Node's require.
* If the file name is `package.json` the file is standard JSON and the
  configuration is in a property called `jscsConfig`.
* If the file name is anything else with the extension `.json` the
  file is standard JSON.
* Otherwise the file is commented JSON. Comments are standard
  Javascript comments and are stripped using
  [strip-json-comments](https://www.npmjs.org/package/strip-json-comments).

Both `configFile` and `rules` can be specified at the same time. In
that case the configuration passed to JSCS will be the configuration
found in the file overridden by anything found in `rules`. Note that
in JSCS rules always override presets meaning that a rule configured
in the file will still override a preset configured in `rules`.

### Examples

To lint your Javascript use to JSCS'
[Crockford](http://javascript.crockford.com/code.html) preset, add the
following to your project's Mimosa configuration:

    jscs: {
      rules: {
        preset: 'crockford',
      }
    }

The following configuration will lint according to the Crockford
preset and also check that all comments starts with a capital letter:

    jscs: {
      rules: {
        preset: 'crockford',
        requireCapitalizedComments: true
      }
    }

To disable a rule, set it to `null` (this is [standard JSCS
behavior](https://github.com/jscs-dev/node-jscs#example-1)). The
following configration will lint using the Crockford preset but
disable indentation checking:

    jscs: {
      rules: {
        preset: 'crockford',
        validateIndentation: null
      }
    }

The following module configuration will read the JSCS configuration
from the project's `package.json`:

    jscs: {
      configFile: 'package.json'
    }

To lint using the Crockford preset, add the following to your
`package.json`:

    jscsConfig: {
        preset: 'crockford'
    }


Compatibility
-------------

This module uses a version of JSCS compatible with 1.7.3.

It has been tested with Mimosa version 2.3.17 but should work with
other versions of Mimosa as well.
