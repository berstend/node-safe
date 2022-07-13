# node-safe 🤠

<!-- ![GitHub Workflow Status](https://img.shields.io/github/workflow/status/berstend/puppeteer-extra/Test/master) -->
[![Works with node-safe](https://img.shields.io/badge/%F0%9F%A4%A0%20node--safe-enabled-brightgreen)](https://github.com/berstend/node-safe#readme)
[![dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)](https://github.com/berstend/node-safe)
[![npm](https://img.shields.io/npm/v/@berstend/node-safe.svg)](https://www.npmjs.com/package/@berstend/node-safe)
![license](https://img.shields.io/npm/l/@berstend/node-safe)

> <sub><sup>_Jump to: [Permissions](#permissions), [Usage](#usage), [Shell integration](#implicit-usage), [Configuration](#configuration), [Project status](#project-status), [Package managers](#package-managers-npm-safe-yarn-safe), [Troubleshooting](#troubleshooting), [Contributing](#contributing)_</sup></sub>

Run Node.js code safely with permissions, preventing rogue dependencies from compromising your system.

`node-safe` is an easy to use companion for your regular `node` and uses native macOS sandboxing features to control file system access, networking and process spawning to keep your workstation safe.

## Motivation

As developers using Node.js and npm we routinely run _a lot_ of untrusted code directly on our workstations.

Let this sink in: **Any npm package you're using has full file system and network access and can exfiltrate your data at will. 😱** We kinda just close our eyes and hope for the best here, which seems to not work anymore:

- [Popular 'coa' NPM library hijacked to steal user passwords](https://www.bleepingcomputer.com/news/security/popular-coa-npm-library-hijacked-to-steal-user-passwords/)
- [NPM package ‘ua-parser-js’ with more than 7M weekly downloads is compromised](https://news.ycombinator.com/item?id=28962168)
- [Hacking 20 high-profile dev accounts could compromise half of the NPM ecosystem](https://www.zdnet.com/article/hacking-20-high-profile-dev-accounts-could-compromise-half-of-the-npm-ecosystem/)

<details>
  <summary><i>...and many more</i></summary>

- [Embedded malware in RC (NPM package)](https://news.ycombinator.com/item?id=29122098)
- [Popular npm Project Used by Millions Hijacked in Supply-Chain Attack](https://blog.sonatype.com/npm-project-used-by-millions-hijacked-in-supply-chain-attack)
- [Compromised eslint JavaScript Package Caught Stealing NPM Credentials](https://news.ycombinator.com/item?id=17517338)
- [Malicious NPM libraries install ransomware, password stealer](https://www.bleepingcomputer.com/news/security/malicious-npm-libraries-install-ransomware-password-stealer/)
- [Compromised npm Package: event-stream](https://medium.com/intrinsic-blog/compromised-npm-package-event-stream-d47d08605502)
- [NPM package "pac-resolver" with 3 million weekly downloads had a severe vulnerability](https://arstechnica.com/information-technology/2021/09/npm-package-with-3-million-weekly-downloads-had-a-severe-vulnerability/)
- [Google News: "npm package compromised"](https://www.google.com/search?q=npm+package+compromised&source=lnms&tbm=nws)
- [Research paper (PDF): Small World with High Risks: A Study of Security Threats in the npm Ecosystem](https://software-lab.org/publications/usenixSec2019-npm.pdf)
  - _"Up to 40% of all packages rely on code known to be vulnerable."_
  - _"The average npm package transitively relies on code published by 40 maintainers."_
  - _"More than 600 highly popular npm packages rely on code published by at least 100 maintainers."_
- [Security issue related to the NPM registry (Nov 2021)](https://news.ycombinator.com/item?id=29245080)
  - _"This is probably the worst security problem ever in the JS ecosystem. Any npm package could be corrupted, and we wouldn't even know it if the original maintainers don't pay attention to new releases anymore."_
  - _"Because this is buried in the post and people don't seem to be grokking it: They correctly authenticated the attacker and checked they were authorised to upload a new version of their own package, but a malicious payload allowed the attacker to then upload a new version of a completely unrelated package that they weren't authorised for. Ouch!"_
  - _"NPM keeps me up at night. We have a CRA with over 300k node_modules files and over 1700 dependencies. Just one compromised dep and suddenly someone else is driving your AWS/Heroku CLI, stealing your credentials, and etc. There was malicious dep version just a few weeks ago on an agent string parser."_

</details>

Deno (a Node.js alternative/competitor) has a built-in [permission system](#how-does-this-compare-to-denos-permissions) for running code, but besides running in a [slow VM or Docker container](#alternatives) there hasn't been a simple option available to run Node.js code safely.

## Quickstart

> _See [Usage](#usage) below for more ways to install and use `node-safe`. Note that only macOS is supported currently._

```bash
npm install --global @berstend/node-safe
# or use a temporary version:
npx @berstend/node-safe -e "console.log('hello world')"
```

### Example

Let's take this script as an example, which unceremoniously reads your private SSH key:

```js
// example.js
const fs = require("fs")
console.log(fs.readFileSync(process.env.HOME + "/.ssh/id_rsa").toString())
```

Regular `node` does not restrict file system access by default 😞

```bash
node example.js
# => -----BEGIN RSA PRIVATE KEY----- (...)
```

`node-safe` will block file system reads and writes by default 🤠

```bash
node-safe example.js
# => Error: EPERM: operation not permitted, open '/Users/foo/.ssh/id_rsa'
```

Simple command line options (like `--allow-read`) are supported to configure permissions:

```bash
# allow reading any file
node-safe --allow-read example.js
# => -----BEGIN RSA PRIVATE KEY----- (...)

# allow reading only that specific file
node-safe --allow-read="$HOME/.ssh/id_rsa" example.js
# => -----BEGIN RSA PRIVATE KEY----- (...)
```

<details>
  <summary>More examples with different permissions</summary>

### More examples

Wildcards (globs) and comma-separated lists of files and folders are supported as well:

```bash
node-safe --allow-read="/etc/*,./assets/*.png" -e "console.log(require('fs').readFileSync('/etc/hosts').toString())"
```

The ability to run child processes and accessing files is configured separately:

```bash
node-safe -e 'require("child_process").exec("touch /tmp/foo", console.log)'
# => Error: spawn EPERM

node-safe --allow-run="[bin]/touch" -e 'require("child_process").exec("touch /tmp/foo", console.log)'
# => touch: /tmp/foo: Operation not permitted

node-safe --allow-run="[bin]/touch" --allow-write="/tmp/foo" -e 'require("child_process").exec("touch /tmp/foo", console.log)'
# => success 🎉
```

Network access is disabled by default:

```bash
node-safe -e "require('https').get({host: 'example.com'}, (res) => res.on('data', (c) => console.log(c + '')))"
# => Error: getaddrinfo ENOTFOUND example.com

node-safe --allow-net-outbound -e "require('https').get({host: 'example.com'}, (res) => res.on('data', (c) => console.log(c + '')))"
# => <!doctype html> (...)
```

Be permissive when feeling lazy while still "containing" things to their own project directory:

```bash
# Allow network and node_module binaries but restrict read/write access to the project folder
node-safe --allow-read-write="[project]/**" --allow-run="[project]/node_modules/**" --allow-net
```

</details>

**Elevator pitch:**

- The [permissions](#permissions) will apply to all imports, nested dependencies and even spawned/forked child processes. 🔥
- Configure permissions with the command line, environment variables or convenient `.node-safe.json` files.
- You can use `node-safe` instead of `node` or teach your regular `node` command to support sandboxing.
- Package managers like `npm`, `npx` or `yarn` are supported as well.
- `node-safe` is a light-weight wrapper that uses your existing `node` version.

## How it works

The main reason why running Node.js code is so risky is the complete lack of restrictions, any npm package (or any of it's often hundreds of nested dependencies from a multitude of developers) has:

- unrestricted file system access
  - reading files can be used to steal your SSH keys, Bitcoin wallet, grab your 1Password archive or photos
  - writing files can be used to encrypt or destroy important data or in the worst case install rootkits
- unrestricted networking
  - which makes it easy for bad code to phone home, fetch malware or upload your private data to a server
- unrestricted process spawning
  - is often used as an attack vector to bypass firewalls, execute malware payload or modify system settings

The question arises why we allow our code to run with all these permissions, when most often they're not needed.

### Sandboxing to the rescue

macOS ships with a very robust [sandbox](<https://en.wikipedia.org/wiki/Sandbox_(computer_security)>) implementation (in fact most of your macOS apps run sandboxed). It's a little underdocumented (to put it mildly) but while looking into it more I realized it could be packaged in a neat way to enforce a variety of restrictions while working with Node.js, through easy to use configuration options.

`node-safe` is aiming at making these powerful sandbox features available on an everyday basis while working with Node.js: It acts as an API compatible "replacement" for `node`, with some additional command line options to configure permissions.

When `node-safe` is called it will dynamically generate, based on the desired permissions, a custom profile to instrument the macOS sandbox and run a sandboxed instance of your regular Node.js binary using that profile.

Package managers like `npm` or `yarn` can be used sandboxed as well, to contain post installation and package.json scripts.

## Usage

There's **two ways** how you can use `node-safe` and friends:

- **[Explicit](#explicit-usage):** You use `node-safe`, `npm-safe`, `yarn-safe` commands directly (installed globally or locally)
  - Quick and easy installation, it's clear what's happening but you need to re-train your muscle memory
  - **The sandboxing will be enabled by default** and can be configured (command line, env, config file)
- **[Implicit](#implicit-usage):** You continue using `node`, `npm`, `yarn` commands but with optional sandboxing
  - No need to remember using the `-safe` commands but requires modifying your `$PATH` once
  - **The sandboxing will be disabled by default** unless explicitly enabled through the command line, env or automatically when a `.node-safe.json` file is found in the project

Can't decide? See [Typical usage](#typical-usage) for an opinionated take on the preferred way to use `node-safe`.

### Explicit usage

> `node-safe` does not include `node`, it will use whichever `node` version you have installed in your system.
> To install Node.js and make switching between versions a breeze [`nvm`](https://github.com/nvm-sh/nvm/blob/master/README.md#installing-and-updating) is a good option.

#### Global installation

You can install `node-safe` as global script binary and run your code with `node-safe` instead of `node`:

```bash
npm install --global @berstend/node-safe
# then run a script
node-safe myscript.js
# or use Node's eval feature
node-safe -e "console.log('hello world')"
# or start an interactive REPL
node-safe
```

In addition to `node-safe` this will make `npm-safe`, `npx-safe` and `yarn-safe` available globally.

#### Temporary usage with `npx`

If you just want to try out `node-safe` without really installing it use `npx` (which ships with `npm`):

```bash
npx @berstend/node-safe -e "console.log(require('fs').readFileSync('/etc/hosts').toString())" # fails
npx @berstend/node-safe --allow-read -e "console.log(require('fs').readFileSync('/etc/hosts').toString())" # works
npx @berstend/node-safe --allow-read --allow-net myscript.js # run a script with file read + network permissions
npx @berstend/node-safe # start a REPL with no permissions (it can't even read it's own history file 😄)
npx @berstend/node-saf --allow-read-write="~/.node_repl_history" # sandboxed REPL with history
npx --ignore-existing @berstend/node-safe # to always use a freshly-installed temporary version
# To use the package manager binaries provided by node-safe:
npx --package @berstend/node-safe npm-safe
npx --package @berstend/node-safe npx-safe
npx --package @berstend/node-safe yarn-safe
```

#### Project specific installation

You can install `node-safe` as a local dev dependency in an existing Node.js project:

```bash
yarn add --dev @berstend/node-safe
# or
npm install --dev @berstend/node-safe
```

Run the following command from the root folder of that project:

```bash
$(npm bin)/node-safe -e "console.log('hello world')" # will use ./node_modules/.bin/node-safe
```

In addition to `node-safe` this will make `npm-safe`, `npx-safe` and `yarn-safe` available locally in the project.

#### Package manager scripts

In a typical project custom package.json scripts are used to run things and often implicitly call `node` (like a `mocha` test runner). To run package.json scripts safely make use of `npm-safe` or `yarn-safe`:

```bash
# before (not sandboxed)
yarn run build
npm run build

# run the build script defined in the package.json
yarn-safe run build
npm-safe run build

# allow writing to the ./dist folder during build
yarn-safe --allow-write="./dist/**" run build
npm-safe --allow-write="./dist/**" run build
```

or when `node-safe` has been installed as a dev dependency in the project:

```bash
# run the build script defined in the package.json
$(npm bin)/yarn-safe run build # will use ./node_modules/.bin/yarn-safe
$(npm bin)/npm-safe run build # will use ./node_modules/.bin/npm-safe
```

Everything that happens when running a package.json script (including nested commands, child processes, etc) will be sandboxed and restricted based on the configured permissions.

#### Package manager commands

Simply using npm or yarn to install dependencies can already compromise your machine as lifecycle scripts like `postinstall` are executed with unrestricted access. To run package manager commands sandboxed:

```bash
# Install all dependencies listed in package.json
yarn-safe install
npm-safe install

# Install 'got' as new dependency
yarn-safe add got
npm-safe install got

# prepublish hooks can execute arbitrary code as well
npm-safe publish

# or when installed as a dev dependency
$(npm bin)/yarn-safe install # will use ./node_modules/.bin/yarn-safe
$(npm bin)/npm-safe install # will use ./node_modules/.bin/npm-safe
```

`npm-safe` and `yarn-safe` are optimized for your happiness and will [allow certain permissions by default](#default-sandbox-permissions).

By using a `.node-safe.json` [configuration file](#config-file) it's possible to define (and share) sandbox permissions scoped to specific package manager scripts or commands.

### Implicit usage

> `node-safe` does not include `node`, it will use whichever `node` version you have installed in your system.
> To install Node.js and make switching between versions a breeze [`nvm`](https://github.com/nvm-sh/nvm/blob/master/README.md#installing-and-updating) is a good option.

#### Using regular `node`, `npm`, `yarn` commands with sandboxing

Wouldn't it be great if we could teach good old node and npm permission features? Well, we can! 🎉

You can use the shell integration below to make `node-safe`, `npm-safe`, `npx-safe` and `yarn-safe` the default when their respective `node`, `npm`, `npx`, `yarn` command is called.

We do this by prepending the `$PATH` variable (which tells your system in which folders binaries can be found) with our own folder containing small script binaries as shims. When these are invoked they will find and use the regular `node` binary to run `node-safe`, which takes it from there.

Things of note when using the regular `node`, `npm`, `yarn` commands with node-safe through the shell integration:

- the sandboxing will be disabled by default and commands behave as normal, as to not break your existing projects or workflow. To enable sandboxing use `--enable-sandbox` or toggle sandboxing automatically by using use per project `.node-safe.json` config files.
- it's not a replacement for your node, npm, yarn binaries, you still need to have them installed in your system
- the shell integration doesn't include node-safe, it still needs to be installed as global npm module (the shell integration will do that automatically for you if needed though)
- when using the shell integration all 📚 documentation and examples you read here using `node-safe`, `npm-safe`, `yarn-safe` commands will apply to your regular `node`, `npm`, `yarn` commands as well

```bash
node --enable-sandbox --allow-read="./comics/**" --allow-net # possible with the shell integration
```

#### Shell integration

To add the node-safe shell integration download [this file](./shell/env.sh) to `~/.node-safe/env.sh`:

```bash
mkdir ~/.node-safe
curl -o ~/.node-safe/env.sh https://raw.githubusercontent.com/berstend/node-safe/master/shell/env.sh
```

Add this line at the end of your `~/.bashrc`, `~/.profile`, or `~/.zshrc` file(s) to have it automatically sourced upon login:

```bash
# This loads the shell integration of node-safe
export NODE_SAFE_DIR="$HOME/.node-safe" && [ -s "$NODE_SAFE_DIR/env.sh" ] && source "$NODE_SAFE_DIR/env.sh"
```

If the files don't exist yet just create them:

```bash
touch ~/.zshrc && touch ~/.bashrc
```

Restart your terminal session for changes to have an effect. To verify everything works:

```bash
node --sandbox-version
# => 🤠 node-safe v0.1.2
```

To disable the shell integration just remove the line we added earlier and restart your terminal.

### Typical usage

#### Use a config file

I recommend using a `node-safe.json` [config file](#config-file) when working on projects. You don't need to remember to use commandline arguments and your team members get to enjoy the sandboxing permissions you've created as well.

Adding a config file to your project also allows you to add this cool badge to your readme 😄

```md
[![Works with node-safe](https://img.shields.io/badge/%F0%9F%A4%A0%20node--safe-enabled-brightgreen)](https://github.com/berstend/node-safe)
```

#### Use the implicit mode

As for the installation: Go for the [implicit usage](#implicit-usage) with the shell integration after you played with `node-safe` a bit. You can continue using `node` and package managers as normal but whenever a `.node-safe.json` file is found in one of your projects it will automatically keep you safe with sandboxing.

#### Sandbox new projects from the start

When creating a new project it's important to enable sandboxing from the start, so you're already safe when installing the first dependencies. When using the implicit mode you can do that by simply creating an empty `.node-safe.json` file:

```bash
# create a folder for a new project
mkdir new-project-idea && cd new-project-idea
# activate sandboxing with default permissions with an empty config file
touch .node-safe.json && yarn init --yes
# all node, npm, yarn commands executed in this project will now run sandboxed 🎉
```

Once you run into permission errors you can start whitelisting certain permissions in the `.node-safe.json` file as needed.

## Permissions

By default [most permissions are restricted](#default-sandbox-permissions) when running `node-safe`.

_The naming to configure permissions has been inspired by Deno:_

- **--allow-read=\<allow-read>** Allow file system read access. You can specify an optional, comma-separated list of directories or files to provide an allow-list of allowed file system access. Wildcard globs are supported.
- **--allow-write=\<allow-write>** Allow file system write access. You can specify an optional, comma-separated list of directories or files to provide an allow-list of allowed file system access. Wildcard globs are supported.
- **--allow-read-write=\<allow-read-write>** Allow file system read & write access. You can specify an optional, comma-separated list of directories or files to provide an allow-list of allowed file system access. Wildcard globs are supported.
- **--allow-run=\<allow-run>** Allow running subprocesses. You can specify an optional, comma-separated list of subprocesses to provide an allow-list of allowed subprocesses. Wildcard globs are supported. Be aware that subprocesses are subject to the same permissions as the Node.js app and file system or network access needs to be permitted for subprocesses as well.
- **--allow-net** Allow unrestricted network access (inbound & outbound).
- **--allow-net-inbound** Allow inbound network access. Allows binding to sockets and creating/listening local servers. Local network requests are not permitted.
- **--allow-net-outbound** Allow outbound network access. Allows binding to sockets and outgoing requests to the local network and internet.
- **--allow-all** Allow all permissions. This enables all security sensitive functions. Use with caution.

### Other options

- **--enable-sandbox** Will enable the sandboxing, only relevant if you don't use `-safe` commands but the [implicit](#implicit-usage) usage (when using the `-safe` commands sandboxing is already enabled by default)
- **--allow-unsupported-platforms** Running `node-safe` on an unsupported platform (Windows, Linux) will show an error by default, when this option is set sandboxing will be skipped and node executed normally
- **--disable-sandbox-hints** By default `node-safe` will print a short message to stdout to let you know it's running (only in interactive terminals, not when piping the output or similar)
- **--debug-sandbox** Enable verbose debug logging to stdout
- **--print-sandbox** Print the generated sandbox profile and exit
- **--sandbox-target** Specify a different target binary to be sandboxed (by default `node`)
- **--sandbox-help** / **--sandbox-version** Show version information and help

_Learn more about [Files & Folders](#files--folders) further down._ _Having trouble finding the right permissions to allow? See [Troubleshooting](#troubleshooting)_

## Configuration

`node-safe` is very configurable. It reads it's configuration options from 3 places:

- [Command line switches](#command-line-options)
- [Environment variables](#environment-variables)
- [A `.node-safe.json` config file](#config-file) (usually in the project directory next to the package.json)

<details>
  <summary>Options will be merged when provided from multiple places</summary>

### Merging

When it's the same permission or option:

- Command line switches take precedence over environment variables which take precedence over the config file
- If a list value is found in a config file, environment variable as well as command line their lists are merged
- If a config file defines an option with a list but a boolean is set through the command line the boolean will win

When it's different options provided from different places they'll all take effect.

</details>

All configuration options and permissions can be used with `npm-safe`, `npx-safe` and `yarn-safe` as well.
When using the shell integration the regular `node`, `npm`, `npx`, `yarn` commands will support these new options too.

### Command line options

`node-safe` is meant to be used instead of `node`, it supports all regular `node` arguments (it will pass them on) in addition to a few new ones to control the sandbox.

```bash
Usage: node-safe [permissions] [node options] [ script.js ] [arguments]
```

Multiple permissions can be configured at once:

```bash
node-safe --allow-read="./data/*.json" --allow-write="[temp]/**,./logs/*.txt" script.js
```

The package managers follow the same pattern:

```bash
npm-safe [permissions] <command> [arguments]
npx-safe [permissions] [options] <command>[@version] [command-arg]
yarn-safe [permissions] <command> [flags]
```

When using the shell integration and regular commands the sandboxing must be enabled (or toggled by a config file):

```bash
node --enable-sandbox --allow-read="./data/*.json"  script.js
npm --enable-sandbox --allow-write="[temp]/**" install electron
```

### Environment variables

All options can be defined as environment variables as well, prefixed with `NODE_SAFE_` and all uppercase:

```bash
NODE_SAFE_DEBUG_SANDBOX=true NODE_SAFE_ALLOW_READ="**.png" node-safe script.js
```

### Config file

`node-safe` and friends will check if a file named `.node-safe.json` exists in the current directory or it's parents.

> An empty `.node-safe.json` file will enable the sandboxing with default permissions when using the [implicit](#usage) mode where sandboxing is turned off by default.

Here's a simple `.node-safe.json`:

```json
{
  "$schema": "https://repo.node-safe.com/schema/node-safe.schema.json",
  "$readme": "https://github.com/berstend/node-safe#readme",

  "node": {
    "allow-read": "./data/**",
    "allow-read-write": "./build,./build/**",
    "allow-net-outbound": true
  }
}
```

`$schema` and `$readme` are optional, but the schema enables IntelliSense while typing in editors like VSCode 😍:

![config intellisense](https://i.imgur.com/kBGoIYh.png)

Relative paths in the config file will resolve from the directory containing the config file, not the directory from which you invoked node/npm/yarn (most often the same but not always).

The config file supports three (all optional) top level properties with permissions:

- `node` - Permissions that will apply to any node process run in that project (including package managers)
- `scripts` - Define extra permissions that apply when running package.json scripts
- `command` - Define extra permissions that apply when running package manager (npm, yarn) commands

Another example (comments are for explanation purposes only and not valid JSON):

```jsonc
{
  "$schema": "https://repo.node-safe.com/schema/node-safe.schema.json",
  "$readme": "https://github.com/berstend/node-safe#readme",

  // Custom sandbox permissions when running Node.js in this project
  "node": {
    // Allow reading all reports and assets
    "allow-read": "./reports/**.csv,./assets/**",
    // Allow writing files to the logs folder
    "allow-write": "./logs/**",
    // Internet access so the app can fetch the latest conversion rates
    "allow-net-outbound": true
  },
  // Extra permissions when running specific package.json scripts
  "scripts": {
    // Applies to any script
    "*": {
      // Required by rimraf (an npm package) to delete the results folder
      // We use "clean" in multiple scripts, so we allow it for all scripts
      "allow-read-write": "./results/,./results/**",
      // Allow executing rimraf
      "allow-run": "./node_modules/rimraf/**"
    },
    "generate-reports,delete-reports": {
      // Only allow write access when generating or deleting reports
      // Note: We could have used "*-reports" as well as wildcards are supported
      "allow-read-write": "./reports/,./reports"
    },
    "serve": {
      // Allow a local http server to run and bind to ports
      "allow-net-inbound": true,
      "allow-run": "./node_modules/http-server/**"
    }
  },
  // Extra permissions when running built-in package manager commands
  "commands": {
    // One of our dependencies has a `postinstall` script that downloads something to the temp folder
    // Note: For convenience any package manager command that installs packages will match "install"
    // So no need to list "add", "upgrade", etc individually
    "install": {
      "allow-read-write": "[temp]/**",
      // The dependency uses system curl for the download
      "allow-run": "[bin]/curl"
    }
  }
}
```

If multiple entries match (e.g. `npm run delete-reports` will match `node`, `scripts:*` and `scripts:delete-reports`) the permissions of the matching entries will be merged.

#### `node`

The underlying permissions affecting all invocations of `node-safe`, `npm-safe` or `yarn-safe`. If additional permissions for specific scripts or commands are defined and match they will be merged.

#### `scripts`

Add specific permissions when package.json scripts are called (e.g. `npm run-script foo`, `yarn run foo`, etc). Comma separated lists of script names and wildcards are supported. Only the first script invoked will be considered for matching.

#### `commands`

Add specific permissions when package manager commands are called (e.g. `npm whoami`, `yarn upgrade-interactive`, etc). Comma separated lists of script names and wildcards are supported. Without a space in the object property only the package manager command will be matched for portability ("info" will match `npm info` as well as `yarn info`). Commands that trigger package installations are additionally matched as "install" for convenience.

## Files & folders

`node-safe` tries to make it as convenient as possible to not just use a blanket `--allow-read` but be more specific.

Note: If you just specify a folder it's taken literally and won't match descendents unless globbing is used:

```bash
node-safe --allow-read="./assets/" # won't allow reading ./assets/foo.png
node-safe --allow-read="./assets/*" # will allow reading ./assets/foo.png
node-safe --allow-read="./assets/*" # won't allow reading ./assets/content/foo.png
node-safe --allow-read="./assets/**" # will allow reading ./assets/content/foo.png
```

### Relative paths

Relative paths are supported and will internally be resolved to absolute ones.

```bash
node-safe --allow-write="./logfile.txt" script.js # allows writing to that specific file
node-safe --allow-write="./logs/*" script.js # allows writing files to that specific folder
node-safe --allow-write="../../assets/screenshots/*.png" script.js # allows writing .png files to the screenshots folder
```

When used in commandline or environment options they're resolved relative to the current working directory (from which you invoked `node-safe` or the package managers), in config files they're resolved relative to the config file.

### Globbing

Globbing (aka wildcards) are supported and will internally be translated to regex.

```bash
node-safe --allow-read="./*.png" # allows reading .png files in the current directory
node-safe --allow-read="./**.png" # allows reading .png files in the current directory + nested directories
node-safe --allow-read="**.png" # allows reading .png files from anywhere
node-safe --allow-read-write="**/foo/*.png" # allows reading/writing .png files from directories named foo
node-safe --allow-write="**/foo/**.png" # allows writing .png files from foo directories and it's children
node-safe --allow-write="/Users/*/Documents/test/**" # allows writing in `~/Documents/test/` + sub folders
node-safe --allow-write="./assets/**" # allows deleting files in ./assets but not deleting the ./assets folder
node-safe --allow-write="./assets/**,./assets" # allows deleting files in ./assets and the ./assets folder
node-safe --allow-read-write="[project]/**" # full read/write file access but only in the project folder
```

Using a single star will not match sub directories, a double star (known as "globstar") can be used for that.

### Shorthands

A couple of shorthands are supported for convenience and will internally resolve to their absolute paths.

- `[cwd]` - resolves to the current working directory
- `[temp]` - resolves to the systems temporary directory
- `[home]` - resolves to the home directory (`~/` can be used as well)
- `[script]` - resolves to the directory containing the target script (if any)
- `[project]` - resolves to the closest directory (we traverse up) containing a `package.json` file
- `[config]` - resolves to the closest directory (we traverse up) containing a `.node-safe.json` file
- `[bin]` - resolves to a list of all directories found in the `$PATH` (not `./node_modules/.bin`)

The shorthands behave like regular folders and can be combined with globbing or used in lists:

```bash
node-safe --allow-write="[temp]/**" # allows writing anything in the temporary directory or subdirectories
node-safe --allow-write="[temp]/**.log" # allows writing only .log files in the temporary directory
node-safe --allow-read="[project]/assets/**" # allows reading anything from the project's assets directory
node-safe --allow-run="[bin]/curl" # allows running curl found at `/usr/bin/curl`
node-safe --allow-run="[bin]/**" # allows running any executable found in $PATH
```

### Lists

Instead of a single file or folder a comma separated list can be provided.

```bash
node-safe --allow-write="[temp]/**,./assets/**" # allows writing anything in the temporary directory + assets folder
node-safe --allow-read="./file1.txt,./file2.txt" # allows reading these two files
node-safe --allow-write="**/.png,/Users/foo/.bashrc" # allows writing .png files anywhere + the .bashrc file to be read
```

## Default sandbox permissions

If we would block _everything_ the node process wouldn't even be able to start. 😄 We try to strike a balance between usability and security with sane defaults, to protect your machine while not being annoying to use.

### `node-safe`

The default sandbox `node-safe` generates is locked down pretty heavily by default and whitelist (not blacklist) based.

**By default blocked:**

- Reading files (with few exceptions)
- Writing files
- Spawning child processes (except `node`)
- Network access (inbound/outbound/binding)
- Basically all low-level system write access (sysctls, etc)

**By default allowed:**

- Reading source files (`.js`/`.json`, etc.) from certain directories
  - This is needed to allow importing scripts and node modules by default. As source files shouldn't contain sensitive data this is considered safe. This is restricted to `node_modules` folders, the directory the script is in as well as the project directory.

### Package managers (`npm-safe`, `yarn-safe`)

We grant a few extra default permissions when sandboxing a package manager. If we don't they would not be usable out of the box. To still make this as safe as possible we do some light parsing of the command line arguments to understand the "intent" and only allow what is strictly needed to run that type of package manager command.

**By default allowed:**

- File read/write access to yarn/npm cache directories
- File read/write access to `./package.json` and `./node_modules/**`
- Outbound network access (only for known built-in commands, **not** when running package.json scripts)

**Note for package authors and private package users:**

`node-safe` will block access to your `~/.npmrc` by default. This is intentional: **If you're signed in it contains your npm access token that can be used to update/publish packages.** This file has been a juicy target in supply chain attacks and account takeovers before, hence the decision to block access by default.

If you need to be authenticated (while publishing or accessing private packages) you need to specifically allow access:

```bash
npm-safe --allow-read-write="~/.npmrc" login # or "whoami", "publish", etc
```

For even more security consider combining this with using a [`NPM_TOKEN`](https://stackoverflow.com/questions/53099434/using-auth-tokens-in-npmrc/61666885#61666885) environment variable.

## Q&A

### How does this compare to Deno's permissions?

Deno implemented a [permission system](https://deno.land/manual/getting_started/permissions) from the start (as one of it's main differentiators to Node.js). Interestingly `node-safe` has a huge advantage by using native sandboxing features baked into the OS: **Restrictions will apply to all child processes as well**, whereas Deno has no control over what spawned processes can do. 😄

`node-safe` borrowed it's CLI argument naming heavily from Deno though as to not reinvent the wheel.

One aspect where Deno allows more fine-grained control is networking: It supports a whitelist of domains/IPs, whereas `node-safe` can only enable/disable networking altogether (inbound & outbound separately though).

We also didn't implement an `--allow-env` equivalent to Deno, it's possible but I feel it'd be more annoying than useful.

## Project status

The concept works and the sandboxing is robust, though not everything is fully fleshed out yet - consider this iteration of `node-safe` "early access" of sorts and feedback is very welcome.

The main thing we want to work on is probably relaxing some (safe) defaults, as to make the out of the box experience nicer when working on typical projects involving a lot of the common tooling (linting, transpiling, building code, etc).

We could also consider adding something like a `--allow-project` flag, or shipping with presets.

Other things that might not be perfect yet:

- Not every use-case/edge-case of running Node.js might be supported yet
- The CLI parsing is not hardened yet and the code might choke on more exotic ways to invoke `node`
- Package manager integration: We try to group commands and use different sandbox defaults, this grouping is probably not complete yet as package managers feature a lot of commands
- The glob to regex part (when whitelisting files & folders) might contain bugs or not always behave like intended
- The user-experience might be suboptimal with the default sandbox too restrictive, we'll get a better feel for where we might want to ease up some defaults over time
- The cli options and sandbox defaults are not finalized yet and are subject to change until a more stable 1.0 release
- Housekeeping: Automated testing, building, releasing + switch to TS

Feedback, ideas, discussions and bug reports are welcome!

### Limitations

- **Currently macOS only**
  - `sandbox-exec` is macOS only, though there might be ways to support other platforms as well

### Other platforms

If there's sufficient interest I'll be looking into integrating a suitable sandbox implementation for **Windows** as well. [Sandboxie](https://github.com/sandboxie-plus/Sandboxie) seems like the most likely candidate here. Here's [documentation on their supported restrictions](https://sandboxie-plus.com/sandboxie/restrictionssettings/) and [file access](https://sandboxie-plus.com/sandboxie/resourceaccesssettings/). If you're a windows based dev feel free to play with Sandboxie and report your findings in an issue to start the discussion. 😄

**Linux** has the advantage that Docker/LXC runs natively with little performance overhead. Still, looking into a light-weight sandboxing option so `node-safe` works on all major plattforms with the same user-facing API could make sense.

- [App Armor](https://wiki.ubuntu.com/AppArmor) (MAC kernel module) has a near perfect syntax for our use-case (supports file path based globbing, sandboxes child processes) but unfortunately requires root to load/enforce profiles
- [Firejail](https://firejail.wordpress.com/) is a SUID based sandbox and could be an option, their (glibc based) [globbing](https://github.com/netblue30/firejail/blob/e2299b2a41fea9cc76b9bd79dd80d9133470579c/src/firejail/fs_whitelist.c#L249) is [rudimentary](https://github.com/netblue30/firejail/issues/216) though and child processes are not sandboxed
- Other options to look into: [bubblewrap](https://wiki.archlinux.org/title/Bubblewrap) (using user namespaces, though no globbing support) [sydbox](https://sr.ht/~alip/sydbox/) (seccomp-bpf based), [SELinux](https://man7.org/linux/man-pages/man8/sandbox.8.html) (though I doubt we can make it work for our purposes), [gVisor](https://gvisor.dev/docs/user_guide/quick_start/oci/) (use [`runsc do`](https://github.com/google/gvisor/issues/311) [without](https://github.com/google/gvisor/commit/356d1be140bb51f2a50d2c7fe24242cbfeedc9d6) Docker), LXC/LXD, chroots, etc

If you're interested in helping researching a suitable sandbox implementation for another platform: We're looking for a fast (no lengthy boot), non-root implementation we can control through the command line or environment. Minimum control we need is file system access (read/write separately), networking (at least outbound connections) and process forking. Ideally the filtering is file path based and supports extended (bash 4 like) globbing or regex.

## Troubleshooting

When using `node-safe` you'll eventually run into permission errors when only using the default permissions. This is perfectly fine as the idea is to exert control and only whitelist specific access when needed.

### Escape hatch

If you're in a pinch and don't have time to fine-tune the perfect permissions go with this:

```bash
node-safe --allow-read-write="[project]/**" --allow-run="[bin]/**,[project]/node_modules/**" --allow-net
```

This will allow reading/writing in the project directory, executing any binaries your system or dependencies might come with and network access. Even this is still _a whole lot better_ than unrestricted access to your whole system.

### Common errors

#### `Error: EPERM: operation not permitted, scandir '/Users/foobar/folder'`

This error can happen due to lack of read access to a folder. Make sure to use read/write permissions as write permissions alone don't allow the process to read files.

Also make sure you whitelist a folder if needed and not only it's contents:

```bash
"./folder/**" # does not give access to the folder itself, only files and folders in it
"./folder,./folder/**" # gives access to the folder itself as well as it's contents
```

If the errors from the Node.js process don't help you understand what needs whitelisting have a look at [Debugging](#debugging).

### Recipes

#### Allowing binaries in `./node_modules/.bin` to be executed

Assuming a package.json script using `rimraf` to clear a directory:

```json
  "scripts": {
    "clean": "rimraf dist/*"
  },
```

Running this script would result in an error when running sandboxed with default permissions:

```bash
yarn-safe run clean

/bin/sh: /Users/foobar/project/node_modules/.bin/rimraf: /usr/bin/env: bad interpreter: Operation not permitted
```

The error is a bit misleading, as `node_modules/.bin/rimraf` **is a symlink**. By using `ls -lh` or the macOS sandbox logs we learn the actual location of the script being blocked from executing is `./node_modules/rimraf/bin.js`.

We need to therefore whitelist `./node_modules/rimraf/` instead of `./node_modules/.bin/rimraf`:

```bash
NODE_SAFE_ALLOW_RUN="./node_modules/rimraf/**" NODE_SAFE_ALLOW_READ_WRITE="./dist,./dist/**" yarn-safe run clean
# => ✨  Done in 0.39s.
```

In the example we additionally allow file read/write access to that folder and it's contents so `rimraf` can delete it.

##### Allowing TypeScript

All binaries in `node_modules/.bin` are symlinks, when configuring permissions the real path must to be used here as well:

```bash
ls -lh ./node_modules/.bin/tsc
# => ./node_modules/.bin/tsc -> ../typescript/bin/tsc
```

```bash
# this is an example of the implict mode of using node-safe, we use `yarn run` with sandboxing enabled
yarn --enable-sandbox --allow-run="./node_modules/typescript/bin/tsc" --allow-write="./tsconfig.json" run tsc --init
# => "Created a new tsconfig.json file"
```

We will improve the default TS experience in a future update by whitelisting certain things by default.

#### Allowing postinstall hooks when installing packages

When packages are installed their postinstall lifecycle scripts will be executed (as long as it's only using the node binary). This is a pretty safe default as all permissions (restricted file system access, etc) are enforced for child processes as well.

Some packages (like `electron`) might run more elaborate postinstall scripts that will be blocked by the default sandbox:

```bash
yarn-safe add electron

error /Users/foobar/project/node_modules/electron: Command failed.
Exit code: 1
Command: node install.js
```

Looking at the macOS sandbox logs we see that electron tries to write some files to the temp folder as well as `~/Library/Caches` during installation, which we need to explicity allow:

```bash
NODE_SAFE_ALLOW_READ_WRITE="[temp]/**/electron**,[home]/Library/Caches/electron/**" yarn-safe add electron
```

It also tries to execute the `sysctl` binary for some reason but it's fine to keep that blocked. 😄

#### Sandboxed Google Chrome with Puppeteer or Playwright

Using a browser automation framework is a pretty extreme case, as the sandbox applies to any child processes as well we effectively sandbox a full Google Chrome browser when launching it through puppeteer or playwright. 😄

To make this work we need to whitelist the minimum permissions Chrome requires to be able to run.

Puppeteer will download the browser binaries to it's own `node_modules` folder after installation, hence we need to allow running binaries from that location:

```bash
--allow-run="**/node_modules/puppeteer/**,[bin]/**"
```

We additionally allow executing system binaries as Chrome is using some when launching.

Puppeteer will by default create and use a temporary browser profile folder in temp:

```bash
--allow-read-write="[temp]/**"
```

Chrome cannot launch when not being able to bind to sockets: `--allow-net`

**Special situation: Sandboxing a sandbox**

Chrome itself is using the macOS sandbox, we need to instruct Chrome not to use it as we'll already sandbox the process.
To make this convenient `node-safe` will expose an environment variable named `IS_SANBDOXED` that the code can check for.

All together now:

```js
// pptr-demo.js
const puppeteer = require("puppeteer")
const launchOptions = {
  headless: false,
  defaultViewport: null,
  args: [],
}

// Check if we're running in a sandbox already
if (process.env.IS_SANDBOXED) {
  launchOptions.args.push("--no-sandbox")
}

puppeteer.launch(launchOptions).then(async (browser) => {
  console.log("Starting..")
  const page = await browser.newPage()
  await page.goto("https://example.com")
  console.log("✨ Launched sandboxed browser!", await page._client.send("Browser.getVersion"))
  await page.screenshot({ path: "screenshot.png", fullPage: true })
  await browser.close()
})
```

```bash
node-safe --allow-write="[temp]/**,./screenshot.png" --allow-run="**/node_modules/puppeteer/**,[bin]/**" --allow-net pptr-demo.js
```

## Debugging

To debug a problem with node-safe itself you want to enable verbose debug logging:

```bash
NODE_SAFE_DEBUG_SANDBOX=true node-safe foobar.js
# or
node-safe --debug-sandbox foobar.js
```

### macOS sandbox

If you run into permission errors but can't figure out what the problem is you want to check the macOS sandbox logs.

You can either open `Console.app`, start recording and filter for "sandbox" or use this nifty terminal command:

```bash
log stream --style syslog --predicate 'process == "sandboxd"  && eventMessage CONTAINS[c] "deny"' --info | grep com.apple.sandbox.reporting
```

You will see entries like this one that should help you understand what to whitelist:

```
Sandbox: node(1071) deny(1) file-read-data /private/var/run/resolv.conf
```

In case you want to eject the sandbox profile that `node-safe` generates and use it directly:

```bash
node-safe --print-sandbox foobar.js > profile.sb
sandbox-exec -f profile.sb node foobar.js
```

Using `sandbox-exec` directly can be useful when occasionally debugging permissions of external processes :

```bash
# launch Chrome Canary with all permissions but only allow writing into the temp directory
sandbox-exec -p '(version 1) (allow default) (deny file-write*) (allow file-write* (subpath "/private/tmp/fooprofile/") (subpath "/private/var/"))' /Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary --no-sandbox --user-data-dir=/private/tmp/fooprofile
# or to deny everything
sandbox-exec -p '(version 1) (debug all) (deny default)' curl https://example.com
```

## Alternatives

- Running code in a virtual machine or Docker container is an option, but especially on macOS docker is quite slow as it runs in a Linux VM behind the scenes and file-mounting goes through many layers
  - Please note that Docker is not considered a security solution: [Containers are not a sandbox](https://security.stackexchange.com/questions/107850/docker-as-a-sandbox-for-untrusted-code)
- Writing & using custom macOS sandbox profiles manually (my sympathies 😅)
- Using Deno, but forked processes are not subject to restrictions and the ecosystem compared to Node.js is still small

## Contributing

Please create an issue to discuss what you have in mind before working on a PR. :-)

## References

### macOS sandbox reference

- https://reverse.put.as/wp-content/uploads/2011/09/Apple-Sandbox-Guide-v1.0.pdf
- https://github.com/0xbf00/simbple
- https://jmmv.dev/2019/11/macos-sandbox-exec.html
- https://wiki.mozilla.org/Sandbox/Mac/Debugging
- https://www.karltarvas.com/2020/10/25/macos-app-sandboxing-via-sandbox-exec.html
- https://chromium.googlesource.com/chromium/src/+/refs/heads/main/sandbox/mac/seatbelt_sandbox_design.md
- https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/com.apple.WebProcess.sb.in
- https://codechina.csdn.net/mirrors/chromium/chromium/-/blob/1419caba51dcb65d5f2bf9be15719f3f0414d601/sandbox/policy/mac/network.sb

## License

Copyright © 2021, [berstend̡̲̫̹̠̖͚͓̔̄̓̐̄͛̀͘](https://github.com/berstend). Released under the MIT License.
