### Version 0.5.1
- Fix highlighting issues for line comments inside block comments.
- Fix go-to-definition bugs.

### Version 0.5.0
- Improve syntax highlighting for type definitions, contracts, machine integer casts, and type definitions.
- Add support for go-to-definition for top level constants, type definitions, (imported) functions, (imported) nodes, and contract nodes.
- Update Z3 to version 4.8.17 and Kind 2 to version 1.6.0.

### Version 0.4.0
- Add support for more Kind 2 options.
- (Advanced) Add an option to pass command-line arguments to Kind 2's executable.
- Replace file URIs displayed in Kind's view with unique path suffixes.
- Add icons for stopped and unknown results.
- Update Z3 to version 4.8.14 and Kind 2 to latest nightly release.

### Version 0.3.3
- Change default values for options to mirror Kind 2's defaults.
- Fix issues with white spaces in paths.
- Fix issues where the extension hangs when Kind 2 generates long outputs. This also fixes issues with high verbosity levels.
- Remove diagnostic messages when Lustre files are closed.

### Version 0.3.2
- Fix an issue where abstract nodes appear in both abstract and concrete sections.
- Hide `show source` button for analysis results.

### Version 0.3.1
- Fix an issue where codelens do not appear when a user opens a Lustre file.
- Cancel all checks when a user modifies a file.

### Version 0.3.0
- Add support for modular and compositional analysis.
- Add options to cancel running checks and specify timeout values.
- Change color of checkboxes for outputs and states.
- Add an option to specify the verbosity of Kind 2's output (unstable).

### Version 0.2.0
- Display an error icon for checked component when `kind2` terminates with an error and display the error message to the user.
- Improve highlighting for multi-line consts, vars, and component declarations.
- Update to the latest static nightly builds of `kind2` and drop `ZMQ` library requirement for MacOS.
- Fix an issue with fractions not being displayed in simulation view.
- Fix an issue with user-specified solver not being used by `kind2`.

### Version 0.1.0
Initial release.
