### Version 0.12.0
- Update Kind 2 to version 2.3.0
- Update buttons for type decls
- Add syntax highlighting for polymorphism
- Add 'opaque' and 'transparent' keywords
- Fix patterns for 'param'

### Version 0.11.1
- Update the Simulator interface:
  - Change the default number of columns
  - Decrease the font size of node names

### Version 0.11.0
- Update Kind 2 to version 2.2.0 and Z3 to version 4.13.0
- Add support for the linux-arm64 platform
- Add syntax highlighting for refinement types
- Add support for realizability checks
- Filter out candidate properties from the final result
- Fix the display of some icons

### Version 0.10.0
- Update Kind 2 to version 2.1.1

### Version 0.9.0
- Update Kind 2 to version 2.1.0 and Z3 to version 4.12.4
- Update syntax highlighting:
  - Add `param` and `assuming` keywords
  - Replace `choose` keyword with `any`
- Update node packages

### Version 0.8.2
- Update kind2-language-server to v0.1.6 (includes fix)

### Version 0.8.1
- Include kind2-language-server (missing in v0.8.0)

### Version 0.8.0
- Update Kind 2 to version 2.0.0.
- Update syntax highlighting for subrange types with an open end
- Add SMTInterpol as backend SMT solver
- Add new IC3IA engine module
- Add `check_reach` and `check_nonvacuity` options
- Add option to set SMT QE Solver
- Add option to set SMT ITP Solver
- Add `ic3ia_max` option
- Remove `dump_cex` option

### Version 0.7.0
- Update Z3 to version 4.12.1 and Kind 2 to version 1.9.0.
- Update syntax highlighting: elsif, provided, choose.
- Update button for counterexamples.
- Remove protractor dependency from interpreter
- Update all node packages of interpreter to latest compatible version
- Replace TSLint with ESLint in interpreter.

### Version 0.6.2
- Force publication of universal version before platform-specific versions.
  Otherwise, `vsce` fails publishing universal version.

### Version 0.6.1
- Build static Z3 binary for universal version.

### Version 0.6.0
The last three releases (0.5.2 - 0.5.4) were published only for `linux-x64` and `darwin-x64`. This made hard (and sometimes impossible) to install the extension on Windows (through WSL2) and other platforms. This release fixes the issue by providing three versions:

1. A platform-specific version for `darwin-x64`, which includes x64 macOS binaries for Kind 2 and Z3.
2. A platform-specific version for `darwin-arm64`, which includes arm64 macOS binaries for Kind 2 and Z3.
3. A fallback/universal version, which includes x64 Linux binaries for Kind 2 and Z3.
   - This version can be used on Windows through WSL2.

This release also fixes a syntax highlighting bug.

### Version 0.5.4
- Fix syntax highlighting for if blocks without 'else' branch

### Version 0.5.3
- Update Z3 to version 4.12.0 and Kind 2 to version 1.8.0.
- Replace Boolector SMT solver with Bitwuzla.
- Add syntax highlighting for frame blocks, if-then-else blocks, and reachability properties
- Add experimental support for reachability properties

### Version 0.5.2
- Update Z3 to version 4.11.0 and Kind 2 to version 1.7.0.
- Replace CVC4 SMT solver backend with cvc5.
- Fix an issue where the simulation view is resized when the 'Simulate' button is pressed.

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
