# macOS sandbox

See the main readme for a list of references regarding the macOS sandbox.

This one can be considered the canonical reference though:
https://reverse.put.as/wp-content/uploads/2011/09/Apple-Sandbox-Guide-v1.0.pdf

## Syntax highlighting

The macOS sandbox profiles are written in a subset of `Scheme`.

## Gotchas

- (path "/path") - Match exactly this path.
- (subpath "/path") - Match this path and all subpaths of this path. (“/path”, “/path/foo”, etc.)

### Symlinks

Certain directories are symlinks to /private/ and need to be addressed with the /private/ prefix:

```bash
❯ ls -lh /
lrwxr-xr-x    1 root wheel   11 Nov  6  2018 etc -> private/etc
lrwxr-xr-x    1 root wheel   11 Nov  6  2018 tmp -> private/tmp
lrwxr-xr-x    1 root wheel   11 Nov  6  2018 var -> private/var
```
